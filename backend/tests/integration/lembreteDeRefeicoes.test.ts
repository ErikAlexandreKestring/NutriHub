import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db } from '../../src/db/connection';
import { MealRemindersService } from '../../src/modules/meal-reminders/mealReminders.service';

/**
 * Lembrete diário de refeições (RF-07) contra o banco de verdade: quem recebe,
 * o que entra no e-mail e a garantia de um lembrete por paciente por dia.
 */

const owner: Knex = knexLib(knexConfig.test);
const service = new MealRemindersService();
const sufixo = randomUUID().slice(0, 8);
const tenants: string[] = [];
let contador = 0;

const HOJE = '2026-11-10';
const AS_19H = new Date('2026-11-10T22:00:00Z'); // 19:00 em Brasília
const AMANHA_AS_19H = new Date('2026-11-11T22:00:00Z');

async function criarConsultorio(): Promise<string> {
  contador += 1;
  const [tenant] = await owner('tenants')
    .insert({
      nome: `Nutri ${contador}`,
      email: `lembrete-${contador}-${sufixo}@nutri.test`,
      crn: 'CRN-3 1',
      senha_hash: 'x',
    })
    .returning('id');
  tenants.push(tenant.id);
  return tenant.id;
}

interface OpcoesDoPaciente {
  comAcesso?: boolean;
  status?: 'ativo' | 'inativo';
  lembrete?: boolean;
  comPlano?: boolean;
}

/** Paciente com plano ativo: café 07:30, almoço 12:00 e ceia 21:30. */
async function criarPaciente(tenantId: string, opcoes: OpcoesDoPaciente = {}) {
  contador += 1;
  const email = `paciente-${contador}-${sufixo}@paciente.test`;
  const [paciente] = await owner('patients')
    .insert({
      tenant_id: tenantId,
      nome: `Paciente ${contador}`,
      email,
      data_nascimento: '1962-07-15',
      senha_hash: opcoes.comAcesso === false ? null : 'hash',
      status: opcoes.status ?? 'ativo',
      lembrete_refeicoes: opcoes.lembrete ?? true,
    })
    .returning('id');

  const refeicoes: Record<string, string> = {};
  if (opcoes.comPlano !== false) {
    const [plano] = await owner('meal_plans')
      .insert({ tenant_id: tenantId, patient_id: paciente.id, status: 'ativo', published_at: new Date() })
      .returning('id');
    const meals = await owner('meals')
      .insert([
        { tenant_id: tenantId, meal_plan_id: plano.id, nome: 'Café da manhã', horario: '07:30' },
        { tenant_id: tenantId, meal_plan_id: plano.id, nome: 'Almoço', horario: '12:00' },
        { tenant_id: tenantId, meal_plan_id: plano.id, nome: 'Ceia', horario: '21:30' },
      ])
      .returning(['id', 'nome']);
    for (const meal of meals) refeicoes[meal.nome] = meal.id;
  }
  return { id: paciente.id as string, email, refeicoes };
}

async function lembretesDe(email: string) {
  return owner('notifications').where({ destino: email, evento: 'LEMBRETE_REFEICOES' });
}

afterAll(async () => {
  await owner('tenants').whereIn('id', tenants).delete();
  await owner.destroy();
  await db.destroy();
});

describe('Lembrete diário de refeições (RF-07)', () => {
  it('lista só as refeições que já passaram e não foram marcadas', async () => {
    const tenantId = await criarConsultorio();
    const paciente = await criarPaciente(tenantId);
    await owner('meal_completions').insert({
      tenant_id: tenantId,
      meal_id: paciente.refeicoes['Café da manhã'],
      data: HOJE,
    });

    await service.enviarDoDia(AS_19H);

    const [lembrete] = await lembretesDe(paciente.email);
    expect(lembrete.conteudo.texto).toContain('12:00 — Almoço');
    expect(lembrete.conteudo.texto).not.toContain('Café da manhã');
    // A ceia das 21:30 ainda não chegou às 19:00.
    expect(lembrete.conteudo.texto).not.toContain('Ceia');
    expect(lembrete).toMatchObject({ canal: 'email', status: 'pendente', referencia_id: paciente.id });
  });

  it('marcação de outro dia não conta como feita hoje', async () => {
    const tenantId = await criarConsultorio();
    const paciente = await criarPaciente(tenantId);
    await owner('meal_completions').insert({
      tenant_id: tenantId,
      meal_id: paciente.refeicoes['Almoço'],
      data: '2026-11-09',
    });

    await service.enviarDoDia(AS_19H);

    const [lembrete] = await lembretesDe(paciente.email);
    expect(lembrete.conteudo.texto).toContain('Almoço');
  });

  it('não manda nada para quem marcou tudo o que já passou', async () => {
    const tenantId = await criarConsultorio();
    const paciente = await criarPaciente(tenantId);
    await owner('meal_completions').insert([
      { tenant_id: tenantId, meal_id: paciente.refeicoes['Café da manhã'], data: HOJE },
      { tenant_id: tenantId, meal_id: paciente.refeicoes['Almoço'], data: HOJE },
    ]);

    await service.enviarDoDia(AS_19H);

    expect(await lembretesDe(paciente.email)).toHaveLength(0);
  });

  it('manda um lembrete por dia, mesmo que a varredura rode de novo', async () => {
    const tenantId = await criarConsultorio();
    const paciente = await criarPaciente(tenantId);

    await service.enviarDoDia(AS_19H);
    await service.enviarDoDia(new Date('2026-11-10T23:00:00Z'));
    expect(await lembretesDe(paciente.email)).toHaveLength(1);

    await service.enviarDoDia(AMANHA_AS_19H);
    expect(await lembretesDe(paciente.email)).toHaveLength(2);
  });

  it('pula quem desligou o lembrete, quem está inativo, quem não tem acesso e quem não tem plano', async () => {
    const tenantId = await criarConsultorio();
    const desligado = await criarPaciente(tenantId, { lembrete: false });
    const inativo = await criarPaciente(tenantId, { status: 'inativo' });
    const semAcesso = await criarPaciente(tenantId, { comAcesso: false });
    const semPlano = await criarPaciente(tenantId, { comPlano: false });

    await service.enviarDoDia(AS_19H);

    for (const paciente of [desligado, inativo, semAcesso, semPlano]) {
      expect(await lembretesDe(paciente.email)).toHaveLength(0);
    }
  });

  it('cada consultório enfileira os lembretes no próprio tenant', async () => {
    const tenantA = await criarConsultorio();
    const tenantB = await criarConsultorio();
    const deA = await criarPaciente(tenantA);
    const deB = await criarPaciente(tenantB);

    await service.enviarDoDia(AS_19H);

    expect(await lembretesDe(deA.email)).toEqual([expect.objectContaining({ tenant_id: tenantA })]);
    expect(await lembretesDe(deB.email)).toEqual([expect.objectContaining({ tenant_id: tenantB })]);
  });

  it('o paciente desliga e religa o lembrete; outro consultório não enxerga a preferência', async () => {
    const tenantId = await criarConsultorio();
    const outro = await criarConsultorio();
    const paciente = await criarPaciente(tenantId);

    await expect(service.preferencia(tenantId, paciente.id)).resolves.toEqual({ ativo: true });
    await expect(service.definirPreferencia(tenantId, paciente.id, false)).resolves.toEqual({ ativo: false });
    await service.enviarDoDia(AS_19H);
    expect(await lembretesDe(paciente.email)).toHaveLength(0);

    await expect(service.definirPreferencia(outro, paciente.id, true)).rejects.toThrow('Paciente não encontrado');
    expect(await owner('patients').where({ id: paciente.id }).first()).toMatchObject({ lembrete_refeicoes: false });
  });
});
