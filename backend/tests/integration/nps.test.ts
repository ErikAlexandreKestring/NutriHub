import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db } from '../../src/db/connection';
import { NpsRepository } from '../../src/modules/nps/nps.repository';
import { MealPlansRepository } from '../../src/modules/meal-plans/mealPlans.repository';

/**
 * RF-09 / RN-05 contra o banco de verdade: o que só o Postgres garante — a
 * regra do trimestre sob publicações simultâneas, a resposta única e as
 * contagens do painel.
 */

const owner: Knex = knexLib(knexConfig.test);
const repository = new NpsRepository();
const mealPlans = new MealPlansRepository();
const sufixo = randomUUID().slice(0, 8);
let tenantId: string;
let contador = 0;

async function inserir(tabela: string, dados: Record<string, unknown>): Promise<Record<string, unknown>> {
  const [linha] = await owner(tabela).insert(dados).returning('*');
  return linha;
}

async function criarPaciente(): Promise<{ patientId: string; planId: string }> {
  contador += 1;
  const patient = await inserir('patients', {
    tenant_id: tenantId,
    nome: `Paciente ${contador}`,
    email: `paciente-${contador}-${sufixo}@nps.test`,
    data_nascimento: '1962-07-15',
  });
  const plan = await inserir('meal_plans', { tenant_id: tenantId, patient_id: patient.id });
  return { patientId: patient.id as string, planId: plan.id as string };
}

beforeAll(async () => {
  const tenant = await inserir('tenants', {
    nome: 'Nutri NPS',
    email: `nutri-${sufixo}@nps.test`,
    crn: 'CRN-3 00000',
    senha_hash: 'nao-usado',
  });
  tenantId = tenant.id as string;
});

afterAll(async () => {
  await owner('tenants').where({ id: tenantId }).delete();
  await owner.destroy();
  await db.destroy();
});

describe('NPS no banco (RF-09, RN-05)', () => {
  it('cria a pesquisa e barra uma segunda no mesmo trimestre', async () => {
    const { patientId, planId } = await criarPaciente();

    const primeira = await repository.criarSeForaDoTrimestre(tenantId, patientId, planId);
    const segunda = await repository.criarSeForaDoTrimestre(tenantId, patientId, planId);

    expect(primeira).toMatchObject({ patient_id: patientId, meal_plan_id: planId, nota: null });
    expect(segunda).toBeUndefined();
  });

  it('libera uma nova pesquisa passados três meses da anterior', async () => {
    const { patientId, planId } = await criarPaciente();
    await inserir('nps_pesquisas', {
      tenant_id: tenantId,
      patient_id: patientId,
      meal_plan_id: planId,
      enviada_em: owner.raw("now() - interval '3 months 1 day'"),
    });

    await expect(repository.criarSeForaDoTrimestre(tenantId, patientId, planId)).resolves.toBeDefined();
  });

  // Duas publicações simultâneas: a segunda espera o lock da primeira e só
  // então confere o trimestre — enxergando a pesquisa que a primeira gravou.
  it('confere o trimestre só depois de obter o lock do paciente', async () => {
    const { patientId, planId } = await criarPaciente();
    const concorrente = await owner.transaction();
    await concorrente.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`nps:${patientId}`]);

    const tentativa = repository.criarSeForaDoTrimestre(tenantId, patientId, planId);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await concorrente('nps_pesquisas').insert({ tenant_id: tenantId, patient_id: patientId, meal_plan_id: planId });
    await concorrente.commit();

    await expect(tentativa).resolves.toBeUndefined();
    expect(await owner('nps_pesquisas').where({ patient_id: patientId })).toHaveLength(1);
  });

  it('aceita uma resposta só, e só do próprio paciente', async () => {
    const { patientId, planId } = await criarPaciente();
    const outro = await criarPaciente();
    const pesquisa = await repository.criarSeForaDoTrimestre(tenantId, patientId, planId);

    expect(await repository.responder(tenantId, pesquisa!.id, outro.patientId, 0, null)).toBeUndefined();
    const respondida = await repository.responder(tenantId, pesquisa!.id, patientId, 10, 'Excelente');
    const repetida = await repository.responder(tenantId, pesquisa!.id, patientId, 2, null);

    expect(respondida).toMatchObject({ nota: 10, comentario: 'Excelente' });
    expect(respondida!.respondida_em).not.toBeNull();
    expect(repetida).toBeUndefined();
    expect(await repository.findPendenteByPatient(tenantId, patientId)).toBeUndefined();
  });

  it('o banco recusa nota fora de 0 a 10 e nota sem data de resposta', async () => {
    const { patientId } = await criarPaciente();
    const base = { tenant_id: tenantId, patient_id: patientId };

    await expect(inserir('nps_pesquisas', { ...base, nota: 11, respondida_em: new Date() })).rejects.toThrow(
      /nps_pesquisas_nota_check/,
    );
    await expect(inserir('nps_pesquisas', { ...base, nota: 8 })).rejects.toThrow(/nps_pesquisas_resposta_check/);
  });

  it('o painel conta promotores, neutros, detratores e pesquisas em aberto', async () => {
    const antes = await repository.contar(tenantId);
    for (const nota of [10, 9, 8, 3]) {
      const { patientId, planId } = await criarPaciente();
      const pesquisa = await repository.criarSeForaDoTrimestre(tenantId, patientId, planId);
      await repository.responder(tenantId, pesquisa!.id, patientId, nota, null);
    }
    const { patientId, planId } = await criarPaciente();
    await repository.criarSeForaDoTrimestre(tenantId, patientId, planId);

    const depois = await repository.contar(tenantId);

    expect({
      enviadas: depois.enviadas - antes.enviadas,
      respostas: depois.respostas - antes.respostas,
      promotores: depois.promotores - antes.promotores,
      neutros: depois.neutros - antes.neutros,
      detratores: depois.detratores - antes.detratores,
    }).toEqual({ enviadas: 5, respostas: 4, promotores: 2, neutros: 1, detratores: 1 });

    const recentes = await repository.listarRespostas(tenantId, 2);
    expect(recentes).toHaveLength(2);
    expect(recentes[0]).toHaveProperty('patient_nome');
  });

  it('publicar devolve o plano encerrado, e nada no primeiro plano do paciente', async () => {
    const { patientId, planId } = await criarPaciente();
    const sem = { metaKcal: null, orientacoes: null };

    const primeiro = await mealPlans.publish(tenantId, planId, patientId, sem);
    const segundoPlano = await inserir('meal_plans', { tenant_id: tenantId, patient_id: patientId });
    const segundo = await mealPlans.publish(tenantId, segundoPlano.id as string, patientId, sem);

    expect(primeiro.encerradoId).toBeNull();
    expect(segundo.encerradoId).toBe(planId);
    expect(segundo.plano.status).toBe('ativo');
  });
});
