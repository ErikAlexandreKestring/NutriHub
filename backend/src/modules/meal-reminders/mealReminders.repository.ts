import { Knex } from 'knex';
import { db, withTenant } from '../../db/connection';

export interface RefeicaoPendente {
  nome: string;
  /** HH:MM:SS, como o Postgres devolve a coluna `time`. */
  horario: string;
}

export interface LembreteDoDia {
  patientId: string;
  nome: string;
  email: string;
  refeicoes: RefeicaoPendente[];
}

export class MealRemindersRepository {
  constructor(private readonly connection: Knex = db) {}

  /** `tenants` não tem RLS: é por ela que o job percorre os consultórios. */
  async listTenantIds(): Promise<string[]> {
    return this.connection('tenants').pluck('id');
  }

  /**
   * Reserva, para `hoje`, os pacientes do tenant que devem receber o lembrete:
   * ativos, com acesso ao app, com o lembrete ligado e com plano ativo. A
   * reserva vale mesmo para quem não tem nada pendente — assim o paciente sai
   * da varredura do dia.
   *
   * Devolve só quem tem refeição pendente: horário até `horaAtual` e sem
   * marcação de concluída em `hoje`.
   */
  async reservarDoDia(tenantId: string, hoje: string, horaAtual: string): Promise<LembreteDoDia[]> {
    return withTenant(tenantId, async (trx) => {
      const reservados: { id: string; nome: string; email: string }[] = await trx('patients')
        .where({ status: 'ativo', lembrete_refeicoes: true })
        .whereNotNull('senha_hash')
        .where((q) => q.whereNull('lembrete_refeicoes_em').orWhere('lembrete_refeicoes_em', '<', hoje))
        .whereExists(
          trx('meal_plans')
            .whereRaw('meal_plans.patient_id = patients.id')
            .where('meal_plans.status', 'ativo')
            .select(trx.raw('1')),
        )
        .update({ lembrete_refeicoes_em: hoje })
        .returning(['id', 'nome', 'email']);

      if (reservados.length === 0) return [];

      const pendentes: { patient_id: string; nome: string; horario: string }[] = await trx('meals')
        .join('meal_plans', 'meal_plans.id', 'meals.meal_plan_id')
        .leftJoin('meal_completions', (join) => {
          join.on('meal_completions.meal_id', 'meals.id').andOn('meal_completions.data', trx.raw('?::date', [hoje]));
        })
        .where('meal_plans.status', 'ativo')
        .whereIn(
          'meal_plans.patient_id',
          reservados.map((paciente) => paciente.id),
        )
        .whereNull('meal_completions.id')
        .where('meals.horario', '<=', horaAtual)
        .orderBy('meals.horario')
        .select('meal_plans.patient_id', 'meals.nome', 'meals.horario');

      return reservados
        .map((paciente) => ({
          patientId: paciente.id,
          nome: paciente.nome,
          email: paciente.email,
          refeicoes: pendentes
            .filter((refeicao) => refeicao.patient_id === paciente.id)
            .map(({ nome, horario }) => ({ nome, horario })),
        }))
        .filter((lembrete) => lembrete.refeicoes.length > 0);
    });
  }

  async getPreferencia(tenantId: string, patientId: string): Promise<boolean | undefined> {
    const linha = await withTenant(tenantId, (trx) =>
      trx('patients').where({ id: patientId }).first('lembrete_refeicoes'),
    );
    return linha?.lembrete_refeicoes;
  }

  async setPreferencia(tenantId: string, patientId: string, ativo: boolean): Promise<boolean | undefined> {
    const [linha] = await withTenant(tenantId, (trx) =>
      trx('patients').where({ id: patientId }).update({ lembrete_refeicoes: ativo }).returning('lembrete_refeicoes'),
    );
    return linha?.lembrete_refeicoes;
  }
}
