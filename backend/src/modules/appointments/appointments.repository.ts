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

export class AppointmentsRepository {
  async create(tenantId: string, patientId: string, dataHora: Date): Promise<AppointmentRecord> {
    return withTenant(tenantId, async (trx) => {
      const [row] = await trx('appointments')
        .insert({ tenant_id: tenantId, patient_id: patientId, data_hora: dataHora, status: 'confirmado' })
        .returning('*');
      return row;
    });
  }

  /**
   * #42: agenda só se o paciente tiver menos de `limite` consultas confirmadas
   * a partir de agora. A contagem e a inserção correm sob um lock por paciente:
   * sem ele, dois pedidos simultâneos (clique duplo, duas abas) contariam zero
   * ao mesmo tempo e os dois seriam gravados.
   *
   * Devolve a consulta criada ou, se o limite já foi atingido, a próxima
   * consulta do paciente, para a mensagem de erro dizer qual é.
   */
  async createWithinPatientLimit(
    tenantId: string,
    patientId: string,
    dataHora: Date,
    limite: number,
  ): Promise<{ criada: AppointmentRecord } | { proxima: AppointmentRecord }> {
    return withTenant(tenantId, async (trx) => {
      // Lock de transação: some sozinho no COMMIT/ROLLBACK.
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`consultas:${patientId}`]);

      const futuras: AppointmentRecord[] = await trx('appointments')
        .where({ patient_id: patientId, status: 'confirmado' })
        .andWhere('data_hora', '>', trx.fn.now())
        .orderBy('data_hora', 'asc')
        .limit(limite);
      if (futuras.length >= limite) return { proxima: futuras[0] };

      const [criada] = await trx('appointments')
        .insert({ tenant_id: tenantId, patient_id: patientId, data_hora: dataHora, status: 'confirmado' })
        .returning('*');
      return { criada };
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

  // RN-09: existe outro agendamento confirmado para o mesmo horário no tenant?
  async findConflict(tenantId: string, dataHora: Date, excludeId?: string): Promise<AppointmentRecord | undefined> {
    return withTenant(tenantId, (trx) => {
      const query = trx('appointments').where({ data_hora: dataHora, status: 'confirmado' });
      if (excludeId) {
        query.whereNot({ id: excludeId });
      }
      return query.first();
    });
  }

  async updateStatus(tenantId: string, id: string, status: AppointmentStatus): Promise<AppointmentRecord> {
    return withTenant(tenantId, async (trx) => {
      const [row] = await trx('appointments').where({ id }).update({ status, updated_at: trx.fn.now() }).returning('*');
      return row;
    });
  }

  async reschedule(tenantId: string, id: string, dataHora: Date): Promise<AppointmentRecord> {
    return withTenant(tenantId, async (trx) => {
      const [row] = await trx('appointments')
        .where({ id })
        .update({ data_hora: dataHora, updated_at: trx.fn.now() })
        .returning('*');
      return row;
    });
  }
}
