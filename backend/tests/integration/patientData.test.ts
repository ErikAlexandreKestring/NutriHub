import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db } from '../../src/db/connection';
import { down, up } from '../../src/db/migrations/20261102100000_encrypt_patients_historico';
import { PatientsRepository } from '../../src/modules/patients/patients.repository';

/**
 * RNF-03 / RFC 6.3 e 6.4, contra o banco de verdade: o histórico clínico fica
 * cifrado em repouso e a exclusão a pedido do titular não deixa dado pessoal
 * para trás — nem na fila de notificações, que não tem chave estrangeira para
 * o paciente.
 */

const HISTORICO = 'Hipertensão controlada. Intolerância à lactose.';

const owner: Knex = knexLib(knexConfig.test);
const repository = new PatientsRepository();
const sufixo = randomUUID().slice(0, 8);
const tenantIds: string[] = [];

async function inserir(tabela: string, dados: Record<string, unknown>): Promise<Record<string, unknown>> {
  const [linha] = await owner(tabela).insert(dados).returning('*');
  return linha;
}

async function criarTenant(rotulo: string): Promise<string> {
  const tenant = await inserir('tenants', {
    nome: `Nutri ${rotulo}`,
    email: `nutri-${rotulo}-${sufixo}@lgpd.test`,
    crn: 'CRN-3 00000',
    senha_hash: 'nao-usado',
  });
  tenantIds.push(tenant.id as string);
  return tenant.id as string;
}

async function criarPaciente(tenantId: string, rotulo: string, historico: string | null = null) {
  return inserir('patients', {
    tenant_id: tenantId,
    nome: `Paciente ${rotulo}`,
    email: `paciente-${rotulo}-${sufixo}@lgpd.test`,
    data_nascimento: '1958-03-21',
    historico,
  });
}

function notificacao(tenantId: string, referenciaId: unknown, destino: string) {
  return inserir('notifications', {
    tenant_id: tenantId,
    evento: 'FEEDBACK_REGISTRADO',
    canal: 'email',
    destino,
    conteudo: { assunto: 'teste', texto: 'relato do paciente' },
    referencia_id: referenciaId,
    max_tentativas: 3,
    intervalo_segundos: 120,
  });
}

afterAll(async () => {
  await owner('tenants').whereIn('id', tenantIds).delete();
  await owner.destroy();
  await db.destroy();
});

describe('Histórico clínico cifrado em repouso (RNF-03)', () => {
  it('grava cifrado no banco e devolve em claro para a aplicação', async () => {
    const tenantId = await criarTenant('cifra');

    const criado = await repository.create(tenantId, {
      nome: 'Maria',
      email: `maria-${sufixo}@lgpd.test`,
      dataNascimento: '1960-01-01',
      historico: HISTORICO,
    });

    const noBanco = await owner('patients').where({ id: criado.id }).first();
    expect(noBanco.historico).toMatch(/^enc:v1:/);
    expect(noBanco.historico).not.toContain('Hipertensão');

    expect(criado.historico).toBe(HISTORICO);
    expect((await repository.findById(tenantId, criado.id))?.historico).toBe(HISTORICO);
    expect((await repository.list(tenantId))[0].historico).toBe(HISTORICO);
  });

  it('cifra também na edição', async () => {
    const tenantId = await criarTenant('edicao');
    const paciente = await criarPaciente(tenantId, 'edicao');

    const editado = await repository.update(tenantId, paciente.id as string, { historico: 'Novo histórico' });

    const noBanco = await owner('patients').where({ id: paciente.id }).first();
    expect(noBanco.historico).toMatch(/^enc:v1:/);
    expect(editado?.historico).toBe('Novo histórico');
  });

  it('a migration cifra os históricos que já existiam e o down desfaz', async () => {
    const tenantId = await criarTenant('migration');
    const antigo = await criarPaciente(tenantId, 'antigo', HISTORICO);
    const semHistorico = await criarPaciente(tenantId, 'sem-historico');

    await up(owner);

    const cifrado = await owner('patients').where({ id: antigo.id }).first();
    expect(cifrado.historico).toMatch(/^enc:v1:/);
    expect((await repository.findById(tenantId, antigo.id as string))?.historico).toBe(HISTORICO);
    expect((await owner('patients').where({ id: semHistorico.id }).first()).historico).toBeNull();

    // Rodar de novo não cifra duas vezes.
    await up(owner);
    expect((await repository.findById(tenantId, antigo.id as string))?.historico).toBe(HISTORICO);

    await down(owner);
    expect((await owner('patients').where({ id: antigo.id }).first()).historico).toBe(HISTORICO);
    await up(owner);
  });
});

describe('Exclusão dos dados do paciente (RNF-03, RFC 6.4)', () => {
  let tenantId: string;
  let paciente: Record<string, unknown>;
  let outroPaciente: Record<string, unknown>;
  let notificacaoDoOutro: Record<string, unknown>;

  beforeAll(async () => {
    tenantId = await criarTenant('exclusao');
    paciente = await criarPaciente(tenantId, 'excluido', 'enc:v1:nao:usado:aqui');
    outroPaciente = await criarPaciente(tenantId, 'fica');

    const plano = await inserir('meal_plans', { tenant_id: tenantId, patient_id: paciente.id });
    const refeicao = await inserir('meals', {
      tenant_id: tenantId,
      meal_plan_id: plano.id,
      nome: 'Almoço',
      horario: '12:00',
    });
    const consulta = await inserir('appointments', {
      tenant_id: tenantId,
      patient_id: paciente.id,
      data_hora: '2030-02-04T13:00:00Z',
    });
    const feedback = await inserir('feedbacks', {
      tenant_id: tenantId,
      patient_id: paciente.id,
      meal_plan_id: plano.id,
      meal_id: refeicao.id,
      descricao: 'Tenho alergia a amendoim',
    });

    await notificacao(tenantId, plano.id, paciente.email as string);
    await notificacao(tenantId, consulta.id, paciente.email as string);
    await notificacao(tenantId, feedback.id, `nutri-exclusao-${sufixo}@lgpd.test`);

    const planoDoOutro = await inserir('meal_plans', { tenant_id: tenantId, patient_id: outroPaciente.id });
    notificacaoDoOutro = await notificacao(tenantId, planoDoOutro.id, outroPaciente.email as string);
  });

  it('outro consultório não consegue excluir o paciente', async () => {
    const outroTenant = await criarTenant('intruso');

    expect(await repository.deleteWithData(outroTenant, paciente.id as string)).toBe(false);
    expect(await owner('patients').where({ id: paciente.id }).first()).toBeDefined();
  });

  it('apaga o paciente, os planos, as consultas, os feedbacks e as notificações dele', async () => {
    expect(await repository.deleteWithData(tenantId, paciente.id as string)).toBe(true);

    expect(await owner('patients').where({ id: paciente.id }).first()).toBeUndefined();
    for (const tabela of ['meal_plans', 'appointments', 'feedbacks']) {
      expect(await owner(tabela).where({ patient_id: paciente.id })).toHaveLength(0);
    }
    expect(await owner('notifications').where({ tenant_id: tenantId, destino: paciente.email })).toHaveLength(0);
    expect(await owner('notifications').where({ tenant_id: tenantId }).whereNot({ id: notificacaoDoOutro.id })).toHaveLength(0);
  });

  it('não toca nos dados dos outros pacientes do consultório', async () => {
    expect(await owner('patients').where({ id: outroPaciente.id }).first()).toBeDefined();
    expect(await owner('notifications').where({ id: notificacaoDoOutro.id }).first()).toBeDefined();
  });

  it('devolve false quando o paciente já não existe', async () => {
    expect(await repository.deleteWithData(tenantId, paciente.id as string)).toBe(false);
  });
});
