import type { Knex } from 'knex';
import { withTenant } from '../../db/connection';

export type AppointmentStatus = 'confirmado' | 'cancelado';

export interface AppointmentRecord {
  id: string;
  tenant_id: string;
  patient_id: string;
  data_hora: Date;
  status: AppointmentStatus;
  created_at: Date;
  updated_at: Date;
}

export interface AppointmentWithPatient extends AppointmentRecord {
  patient_nome: string;
}

/**
 * #47: trava a agenda do consultório até o fim da transação (o lock some
 * sozinho no COMMIT/ROLLBACK). Toda gravação de horário passa por aqui, então
 * a checagem de sobreposição e a gravação viram uma operação só: sem o lock,
 * dois pedidos simultâneos para 10:00 e 10:30 não veriam um ao outro e os dois
 * seriam gravados. O índice único appointments_no_conflict só pega o mesmo
 * minuto exato.
 */
async function travarAgenda(trx: Knex.Transaction, tenantId: string): Promise<void> {
  await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`agenda:${tenantId}`]);
}

/** RN-09: consulta confirmada que ocupa parte de [dataHora, dataHora + duração). */
function consultaSobreposta(
  trx: Knex.Transaction,
  dataHora: Date,
  duracaoMin: number,
  excludeId?: string,
): Promise<AppointmentRecord | undefined> {
  const duracaoMs = duracaoMin * 60 * 1000;
  const query = trx('appointments')
    .where({ status: 'confirmado' })
    .andWhere('data_hora', '>', new Date(dataHora.getTime() - duracaoMs))
    .andWhere('data_hora', '<', new Date(dataHora.getTime() + duracaoMs));
  if (excludeId) {
    query.whereNot({ id: excludeId });
  }
  return query.first();
}

export type ResultadoDoAgendamento =
  | { criada: AppointmentRecord }
  | { proxima: AppointmentRecord }
  | { conflito: AppointmentRecord };

export class AppointmentsRepository {
  /**
   * Agenda se o horário estiver livre (RN-09, #47) e, quando `limiteDoPaciente`
   * vem preenchido, se o paciente tiver menos consultas confirmadas futuras
   * que isso (#42). Tudo sob o lock da agenda do consultório.
   *
   * Devolve a consulta criada, a próxima consulta do paciente (limite
   * atingido, para a mensagem dizer qual é) ou a consulta que ocupa o horário.
   */
  async createIfFree(
    tenantId: string,
    patientId: string,
    dataHora: Date,
    duracaoMin: number,
    limiteDoPaciente?: number,
  ): Promise<ResultadoDoAgendamento> {
    return withTenant(tenantId, async (trx) => {
      await travarAgenda(trx, tenantId);

      if (limiteDoPaciente !== undefined) {
        const futuras: AppointmentRecord[] = await trx('appointments')
          .where({ patient_id: patientId, status: 'confirmado' })
          .andWhere('data_hora', '>', trx.fn.now())
          .orderBy('data_hora', 'asc')
          .limit(limiteDoPaciente);
        if (futuras.length >= limiteDoPaciente) return { proxima: futuras[0] };
      }

      const conflito = await consultaSobreposta(trx, dataHora, duracaoMin);
      if (conflito) return { conflito };

      const [criada] = await trx('appointments')
        .insert({ tenant_id: tenantId, patient_id: patientId, data_hora: dataHora, status: 'confirmado' })
        .returning('*');
      return { criada };
    });
  }

  /** Remarca se o novo horário estiver livre, ignorando a própria consulta. Mesmo lock do agendamento. */
  async rescheduleIfFree(
    tenantId: string,
    id: string,
    dataHora: Date,
    duracaoMin: number,
  ): Promise<{ remarcada: AppointmentRecord } | { conflito: AppointmentRecord }> {
    return withTenant(tenantId, async (trx) => {
      await travarAgenda(trx, tenantId);

      const conflito = await consultaSobreposta(trx, dataHora, duracaoMin, id);
      if (conflito) return { conflito };

      const [remarcada] = await trx('appointments')
        .where({ id })
        .update({ data_hora: dataHora, updated_at: trx.fn.now() })
        .returning('*');
      return { remarcada };
    });
  }

  async findById(tenantId: string, id: string): Promise<AppointmentRecord | undefined> {
    return withTenant(tenantId, (trx) => trx('appointments').where({ id }).first());
  }

  async listByPatient(tenantId: string, patientId: string): Promise<AppointmentRecord[]> {
    return withTenant(tenantId, (trx) =>
      trx('appointments').where({ patient_id: patientId }).orderBy('data_hora', 'desc'),
    );
  }

  // RF-08/RF-10: agenda do consultório a partir de `from`, com o nome do
  // paciente para a tela não precisar buscar um por um.
  async listConfirmedFrom(tenantId: string, from: Date): Promise<AppointmentWithPatient[]> {
    return withTenant(tenantId, (trx) =>
      trx('appointments')
        .join('patients', 'patients.id', 'appointments.patient_id')
        .where('appointments.status', 'confirmado')
        .andWhere('appointments.data_hora', '>=', from)
        .select('appointments.*', 'patients.nome as patient_nome')
        .orderBy('appointments.data_hora', 'asc'),
    );
  }

  // Horários já tomados no período, para descontá-los da grade. Só o horário:
  // quem consulta pode ser o paciente, e ele não deve saber de quem é a consulta.
  async listConfirmedTimesBetween(tenantId: string, from: Date, to: Date): Promise<Date[]> {
    return withTenant(tenantId, async (trx) => {
      const rows: Array<{ data_hora: Date }> = await trx('appointments')
        .where({ status: 'confirmado' })
        .andWhere('data_hora', '>=', from)
        .andWhere('data_hora', '<', to)
        .select('data_hora');
      return rows.map((row) => row.data_hora);
    });
  }

  async updateStatus(tenantId: string, id: string, status: AppointmentStatus): Promise<AppointmentRecord> {
    return withTenant(tenantId, async (trx) => {
      const [row] = await trx('appointments').where({ id }).update({ status, updated_at: trx.fn.now() }).returning('*');
      return row;
    });
  }
}
