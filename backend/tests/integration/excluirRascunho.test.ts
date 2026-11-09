import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db } from '../../src/db/connection';
import { MealPlansService } from '../../src/modules/meal-plans/mealPlans.service';
import { InvalidMealPlanStateError, MealPlanNotFoundError } from '../../src/shared/errors/AppError';

/**
 * Excluir rascunho contra o banco de verdade: as refeições e os itens saem
 * junto (ON DELETE CASCADE), e plano publicado ou de outro consultório fica.
 */

const owner: Knex = knexLib(knexConfig.test);
const mealPlans = new MealPlansService();
const sufixo = randomUUID().slice(0, 8);
const tenants: string[] = [];
let contador = 0;
let foodId: string;

async function criarPaciente(): Promise<{ tenantId: string; pacienteId: string }> {
  contador += 1;
  const [tenant] = await owner('tenants')
    .insert({
      nome: `Nutri ${contador}`,
      email: `rascunho-${contador}-${sufixo}@nutri.test`,
      crn: 'CRN-3 1',
      senha_hash: 'x',
    })
    .returning('id');
  tenants.push(tenant.id);
  const [paciente] = await owner('patients')
    .insert({
      tenant_id: tenant.id,
      nome: `Paciente ${contador}`,
      email: `p-${contador}-${sufixo}@paciente.test`,
      data_nascimento: '1962-07-15',
    })
    .returning('id');
  return { tenantId: tenant.id, pacienteId: paciente.id };
}

async function criarPlano(
  tenantId: string,
  pacienteId: string,
  status: string,
): Promise<{ planoId: string; mealId: string }> {
  const [plano] = await owner('meal_plans')
    .insert({
      tenant_id: tenantId,
      patient_id: pacienteId,
      status,
      published_at: status === 'rascunho' ? null : new Date(),
    })
    .returning('id');
  const [meal] = await owner('meals')
    .insert({ tenant_id: tenantId, meal_plan_id: plano.id, nome: 'Almoço', horario: '12:00' })
    .returning('id');
  await owner('meal_items').insert({
    tenant_id: tenantId,
    meal_id: meal.id,
    food_id: foodId,
    quantidade_g: 100,
    kcal: 128,
    proteina_g: 2.5,
    carb_g: 28.1,
    gordura_g: 0.2,
  });
  return { planoId: plano.id, mealId: meal.id };
}

beforeAll(async () => {
  const [food] = await owner('foods')
    .insert({
      nome: `Alimento de rascunho ${sufixo}`,
      kcal_100g: 128,
      proteina_100g: 2.5,
      carb_100g: 28.1,
      gordura_100g: 0.2,
    })
    .returning('id');
  foodId = food.id;
});

afterAll(async () => {
  await owner('tenants').whereIn('id', tenants).delete();
  await owner('foods').where({ id: foodId }).delete();
  await owner.destroy();
  await db.destroy();
});

describe('Excluir rascunho de plano alimentar', () => {
  it('apaga o rascunho com as refeições e os itens, sem mexer no plano ativo', async () => {
    const { tenantId, pacienteId } = await criarPaciente();
    const ativo = await criarPlano(tenantId, pacienteId, 'ativo');
    const rascunho = await criarPlano(tenantId, pacienteId, 'rascunho');

    await mealPlans.deleteDraft(tenantId, rascunho.planoId);

    expect(await owner('meal_plans').where({ id: rascunho.planoId })).toHaveLength(0);
    expect(await owner('meals').where({ id: rascunho.mealId })).toHaveLength(0);
    expect(await owner('meal_items').where({ meal_id: rascunho.mealId })).toHaveLength(0);
    expect(await owner('meal_plans').where({ id: ativo.planoId }).first()).toMatchObject({ status: 'ativo' });
    expect(await owner('meal_items').where({ meal_id: ativo.mealId })).toHaveLength(1);
  });

  it.each(['ativo', 'encerrado'])('não apaga plano %s', async (status) => {
    const { tenantId, pacienteId } = await criarPaciente();
    const { planoId } = await criarPlano(tenantId, pacienteId, status);

    await expect(mealPlans.deleteDraft(tenantId, planoId)).rejects.toThrow(InvalidMealPlanStateError);
    expect(await owner('meal_plans').where({ id: planoId }).first()).toMatchObject({ status });
  });

  it('não apaga rascunho de outro consultório', async () => {
    const a = await criarPaciente();
    const b = await criarPaciente();
    const { planoId } = await criarPlano(b.tenantId, b.pacienteId, 'rascunho');

    await expect(mealPlans.deleteDraft(a.tenantId, planoId)).rejects.toThrow(MealPlanNotFoundError);
    expect(await owner('meal_plans').where({ id: planoId })).toHaveLength(1);
  });
});
