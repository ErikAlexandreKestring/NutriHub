import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db } from '../../src/db/connection';
import { MealPlansService } from '../../src/modules/meal-plans/mealPlans.service';
import { MealPlanNotFoundError } from '../../src/shared/errors/AppError';

/**
 * Copiar um plano publicado para o rascunho de outro paciente, contra o banco
 * de verdade: a cópia leva refeições e itens, o original não muda, e o RLS
 * impede copiar o plano de outro consultório.
 */

const owner: Knex = knexLib(knexConfig.test);
const service = new MealPlansService();
const sufixo = randomUUID().slice(0, 8);
let contador = 0;
let foodId: string;
const tenants: string[] = [];

async function criarConsultorio(): Promise<string> {
  contador += 1;
  const [tenant] = await owner('tenants')
    .insert({ nome: `Nutri ${contador}`, email: `copia-${contador}-${sufixo}@plano.test`, crn: 'CRN-3 1', senha_hash: 'x' })
    .returning('id');
  tenants.push(tenant.id);
  return tenant.id;
}

async function criarPaciente(tenantId: string, nome: string): Promise<string> {
  contador += 1;
  const [patient] = await owner('patients')
    .insert({
      tenant_id: tenantId,
      nome,
      email: `paciente-${contador}-${sufixo}@plano.test`,
      data_nascimento: '1962-07-15',
    })
    .returning('id');
  return patient.id;
}

/** Plano publicado com duas refeições: café (2 itens, um em medida caseira) e almoço (1 item). */
async function criarPlanoPublicado(tenantId: string, patientId: string, status = 'ativo'): Promise<string> {
  const [plan] = await owner('meal_plans')
    .insert({
      tenant_id: tenantId,
      patient_id: patientId,
      status,
      meta_kcal: 1300,
      orientacoes: 'Paciente diabético: evitar açúcar.',
      published_at: new Date(),
    })
    .returning('id');
  const [cafe, almoco] = await owner('meals')
    .insert([
      { tenant_id: tenantId, meal_plan_id: plan.id, nome: 'Café da manhã', horario: '07:30' },
      { tenant_id: tenantId, meal_plan_id: plan.id, nome: 'Almoço', horario: '12:00' },
    ])
    .returning('id');
  const macros = { proteina_g: 1, carb_g: 20, gordura_g: 1 };
  await owner('meal_items').insert([
    { tenant_id: tenantId, meal_id: cafe.id, food_id: foodId, quantidade_g: 50, kcal: 50, ...macros },
    {
      tenant_id: tenantId,
      meal_id: cafe.id,
      food_id: foodId,
      quantidade_g: 60,
      medida_nome: 'fatia',
      medida_g: 30,
      quantidade_medida: 2,
      kcal: 60,
      ...macros,
    },
    { tenant_id: tenantId, meal_id: almoco.id, food_id: foodId, quantidade_g: 150, kcal: 150, ...macros },
  ]);
  return plan.id;
}

async function lerPlano(planId: string) {
  const meals = await owner('meals').where({ meal_plan_id: planId }).orderBy('horario');
  const items = await owner('meal_items')
    .whereIn(
      'meal_id',
      meals.map((meal) => meal.id),
    )
    .orderBy('quantidade_g');
  return { meals, items };
}

beforeAll(async () => {
  const [food] = await owner('foods')
    .insert({ nome: `Alimento de cópia ${sufixo}`, kcal_100g: 100, proteina_100g: 1, carb_100g: 20, gordura_100g: 1 })
    .returning('id');
  foodId = food.id;
});

afterAll(async () => {
  await owner('tenants').whereIn('id', tenants).delete();
  await owner('foods').where({ id: foodId }).delete();
  await owner.destroy();
  await db.destroy();
});

describe('Copiar plano alimentar para outro paciente', () => {
  it('cria um rascunho com as mesmas refeições e itens, sem meta nem orientações', async () => {
    const tenantId = await criarConsultorio();
    const origemId = await criarPlanoPublicado(tenantId, await criarPaciente(tenantId, 'Maria'));
    const destinoId = await criarPaciente(tenantId, 'José');

    const copia = await service.createDraft(tenantId, destinoId, { copiarDe: origemId });

    expect(copia).toMatchObject({ patient_id: destinoId, status: 'rascunho', meta_kcal: null, orientacoes: null });
    const { meals, items } = await lerPlano(copia.id);
    expect(meals.map((meal) => [meal.nome, meal.horario])).toEqual([
      ['Café da manhã', '07:30:00'],
      ['Almoço', '12:00:00'],
    ]);
    expect(items.map((item) => [Number(item.quantidade_g), Number(item.kcal), item.medida_nome])).toEqual([
      [50, 50, null],
      [60, 60, 'fatia'],
      [150, 150, null],
    ]);
    expect(items.every((item) => item.tenant_id === tenantId)).toBe(true);
  });

  it('o plano de origem continua igual, e mexer na cópia não o afeta', async () => {
    const tenantId = await criarConsultorio();
    const pacienteOrigem = await criarPaciente(tenantId, 'Ana');
    const origemId = await criarPlanoPublicado(tenantId, pacienteOrigem);
    const antes = await lerPlano(origemId);

    const copia = await service.createDraft(tenantId, await criarPaciente(tenantId, 'Bia'), { copiarDe: origemId });
    const [refeicaoDaCopia] = (await lerPlano(copia.id)).meals;
    await service.removeMeal(tenantId, copia.id, refeicaoDaCopia.id);

    expect(await lerPlano(origemId)).toEqual(antes);
    expect(await owner('meal_plans').where({ id: origemId }).first()).toMatchObject({
      patient_id: pacienteOrigem,
      status: 'ativo',
    });
  });

  it('aceita um plano encerrado como origem', async () => {
    const tenantId = await criarConsultorio();
    const origemId = await criarPlanoPublicado(tenantId, await criarPaciente(tenantId, 'Caio'), 'encerrado');

    const copia = await service.createDraft(tenantId, await criarPaciente(tenantId, 'Davi'), { copiarDe: origemId });

    expect((await lerPlano(copia.id)).items).toHaveLength(3);
  });

  it('não copia o plano de outro consultório', async () => {
    const tenantA = await criarConsultorio();
    const tenantB = await criarConsultorio();
    const planoDeB = await criarPlanoPublicado(tenantB, await criarPaciente(tenantB, 'Eva'));
    const pacienteDeA = await criarPaciente(tenantA, 'Fábio');

    await expect(service.createDraft(tenantA, pacienteDeA, { copiarDe: planoDeB })).rejects.toThrow(
      MealPlanNotFoundError,
    );
    expect(await owner('meal_plans').where({ patient_id: pacienteDeA })).toHaveLength(0);
  });

  it('lista os planos publicados do consultório com paciente, refeições e kcal', async () => {
    const tenantId = await criarConsultorio();
    const pacienteId = await criarPaciente(tenantId, 'Gabi');
    const ativoId = await criarPlanoPublicado(tenantId, pacienteId);
    const encerradoId = await criarPlanoPublicado(tenantId, pacienteId, 'encerrado');
    await owner('meal_plans').insert({ tenant_id: tenantId, patient_id: pacienteId, status: 'rascunho' });
    const outro = await criarConsultorio();
    await criarPlanoPublicado(outro, await criarPaciente(outro, 'Hugo'));

    const planos = await service.listCopySources(tenantId);

    expect(planos.map((plano) => plano.id)).toEqual([ativoId, encerradoId]);
    expect(planos[0]).toMatchObject({ patient_nome: 'Gabi', status: 'ativo', refeicoes: 2, kcal: 260 });
  });
});
