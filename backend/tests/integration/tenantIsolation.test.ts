import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db, withTenant } from '../../src/db/connection';
import { AuditRepository } from '../../src/modules/audit/audit.repository';

/**
 * RNF-01 / RN-01 / KPI "0 vazamentos entre tenants": prova, contra o banco de
 * verdade e com o papel da aplicação (`nutrihub_app`), que as políticas de RLS
 * isolam cada tabela de negócio listada na RFC seção 5.4.2.
 *
 * Os dados são montados com o dono do schema, que ignora RLS, e as consultas
 * sob teste não filtram por tenant_id de propósito — é o cenário "a query
 * esqueceu o WHERE" que a seção 5.4.3 promete cobrir.
 */

const TABELAS = [
  'patients',
  'meal_plans',
  'meals',
  'meal_items',
  'availability',
  'appointments',
  'feedbacks',
  'notifications',
  'nps_pesquisas',
  'audit_logs',
] as const;

type Tabela = (typeof TABELAS)[number];
type Linhas = Record<Tabela, Record<string, unknown>>;

interface Consultorio {
  tenantId: string;
  linhas: Linhas;
}

// Gravação de audit_logs é revogada do papel da aplicação (imutável por design),
// então UPDATE/DELETE são testados à parte.
const TABELAS_EDITAVEIS = TABELAS.filter((tabela) => tabela !== 'audit_logs');

const owner: Knex = knexLib(knexConfig.test);
const sufixo = randomUUID().slice(0, 8);
let foodId: string;
let consultorioA: Consultorio;
let consultorioB: Consultorio;

async function inserir(tabela: string, dados: Record<string, unknown>): Promise<Record<string, unknown>> {
  const [linha] = await owner(tabela).insert(dados).returning('*');
  return linha;
}

async function criarConsultorio(rotulo: string): Promise<Consultorio> {
  const tenant = await inserir('tenants', {
    nome: `Nutri ${rotulo}`,
    email: `nutri-${rotulo}-${sufixo}@isolamento.test`,
    crn: 'CRN-3 00000',
    senha_hash: 'nao-usado',
  });
  const tenantId = tenant.id as string;

  const patients = await inserir('patients', {
    tenant_id: tenantId,
    nome: `Paciente ${rotulo}`,
    email: `paciente-${rotulo}-${sufixo}@isolamento.test`,
    data_nascimento: '1960-05-10',
    historico: `Histórico clínico do consultório ${rotulo}`,
  });
  const meal_plans = await inserir('meal_plans', { tenant_id: tenantId, patient_id: patients.id });
  const meals = await inserir('meals', {
    tenant_id: tenantId,
    meal_plan_id: meal_plans.id,
    nome: 'Café da manhã',
    horario: '08:00',
  });
  const meal_items = await inserir('meal_items', {
    tenant_id: tenantId,
    meal_id: meals.id,
    food_id: foodId,
    quantidade_g: 100,
    kcal: 100,
    proteina_g: 1,
    carb_g: 20,
    gordura_g: 1,
  });
  const availability = await inserir('availability', {
    tenant_id: tenantId,
    day_of_week: 1,
    start_time: '08:00',
    end_time: '12:00',
  });
  const appointments = await inserir('appointments', {
    tenant_id: tenantId,
    patient_id: patients.id,
    data_hora: '2030-01-07T11:00:00Z',
  });
  const feedbacks = await inserir('feedbacks', {
    tenant_id: tenantId,
    patient_id: patients.id,
    meal_plan_id: meal_plans.id,
    meal_id: meals.id,
    descricao: `Relato do consultório ${rotulo}`,
  });
  const notifications = await inserir('notifications', {
    tenant_id: tenantId,
    evento: 'FEEDBACK_REGISTRADO',
    canal: 'email',
    destino: `nutri-${rotulo}-${sufixo}@isolamento.test`,
    conteudo: { assunto: 'teste', texto: 'teste' },
    max_tentativas: 3,
    intervalo_segundos: 120,
  });
  const nps_pesquisas = await inserir('nps_pesquisas', {
    tenant_id: tenantId,
    patient_id: patients.id,
    meal_plan_id: meal_plans.id,
    nota: 9,
    comentario: `Avaliação do consultório ${rotulo}`,
    respondida_em: new Date(),
  });
  const audit_logs = await inserir('audit_logs', {
    evento: 'LOGIN_SUCESSO',
    tenant_id: tenantId,
    user_id: tenantId,
    ip: '203.0.113.7',
  });

  return {
    tenantId,
    linhas: {
      patients,
      meal_plans,
      meals,
      meal_items,
      availability,
      appointments,
      feedbacks,
      notifications,
      nps_pesquisas,
      audit_logs,
    },
  };
}

beforeAll(async () => {
  const food = await inserir('foods', {
    nome: `Alimento de teste ${sufixo}`,
    kcal_100g: 100,
    proteina_100g: 1,
    carb_100g: 20,
    gordura_100g: 1,
  });
  foodId = food.id as string;
  consultorioA = await criarConsultorio('a');
  consultorioB = await criarConsultorio('b');
});

afterAll(async () => {
  const tenantIds = [consultorioA?.tenantId, consultorioB?.tenantId].filter(Boolean);
  await owner('audit_logs').whereIn('tenant_id', tenantIds).orWhere('ip', `e06-${sufixo}`).delete();
  // ON DELETE CASCADE leva pacientes, planos, agenda, feedbacks e notificações.
  await owner('tenants').whereIn('id', tenantIds).delete();
  if (foodId) {
    await owner('foods').where({ id: foodId }).delete();
  }
  await owner.destroy();
  await db.destroy();
});

describe('Isolamento multi-tenant via RLS (RNF-01, RN-01)', () => {
  describe.each(TABELAS)('%s', (tabela) => {
    it('um SELECT sem filtro devolve só as linhas do tenant da sessão', async () => {
      const linhas = await withTenant(consultorioA.tenantId, (trx) => trx(tabela).select('id', 'tenant_id'));

      expect(linhas.map((linha) => linha.id)).toContain(consultorioA.linhas[tabela].id);
      expect(linhas.every((linha) => linha.tenant_id === consultorioA.tenantId)).toBe(true);
    });

    it('a linha de outro tenant não aparece nem buscando pelo id', async () => {
      const linha = await withTenant(consultorioA.tenantId, (trx) =>
        trx(tabela).where({ id: consultorioB.linhas[tabela].id }).first(),
      );

      expect(linha).toBeUndefined();
    });

    it('não aceita gravar uma linha em nome de outro tenant', async () => {
      if (tabela === 'audit_logs') {
        // O INSERT de audit_logs é livre de propósito (E-06), testado abaixo.
        return;
      }
      const copia = { ...consultorioB.linhas[tabela] };
      delete copia.id;
      delete copia.created_at;
      delete copia.updated_at;

      await expect(withTenant(consultorioA.tenantId, (trx) => trx(tabela).insert(copia))).rejects.toThrow(
        /row-level security/,
      );
    });
  });

  describe.each(TABELAS_EDITAVEIS)('%s — escrita em linha de outro tenant', (tabela) => {
    it('UPDATE e DELETE não alcançam a linha', async () => {
      const idDoOutro = consultorioB.linhas[tabela].id;

      const { atualizadas, apagadas } = await withTenant(consultorioA.tenantId, async (trx) => ({
        atualizadas: await trx(tabela).where({ id: idDoOutro }).update({ tenant_id: consultorioA.tenantId }),
        apagadas: await trx(tabela).where({ id: idDoOutro }).delete(),
      }));

      expect(atualizadas).toBe(0);
      expect(apagadas).toBe(0);
      expect(await owner(tabela).where({ id: idDoOutro, tenant_id: consultorioB.tenantId }).first()).toBeDefined();
    });
  });

  it('sem tenant na sessão a consulta falha em vez de devolver dados', async () => {
    await expect(db('patients').select('id')).rejects.toThrow();
  });

  describe('audit_logs (RNF-10)', () => {
    it('aceita o evento E-06 sem tenant, que nenhum tenant consegue ler depois', async () => {
      await new AuditRepository(db).register({ evento: 'TOKEN_TENANT_INVALIDO', ip: `e06-${sufixo}` });

      const visivel = await withTenant(consultorioA.tenantId, (trx) =>
        trx('audit_logs').where({ ip: `e06-${sufixo}` }).first(),
      );

      expect(visivel).toBeUndefined();
      expect(await owner('audit_logs').where({ ip: `e06-${sufixo}` }).first()).toBeDefined();
    });

    it('é imutável para a aplicação: nem o próprio tenant edita ou apaga um log', async () => {
      const idProprio = consultorioA.linhas.audit_logs.id;

      await expect(
        withTenant(consultorioA.tenantId, (trx) => trx('audit_logs').where({ id: idProprio }).update({ evento: 'X' })),
      ).rejects.toThrow(/permission denied/);
      await expect(
        withTenant(consultorioA.tenantId, (trx) => trx('audit_logs').where({ id: idProprio }).delete()),
      ).rejects.toThrow(/permission denied/);
    });
  });
});
