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

export class AppointmentsRepository {
  async create(tenantId: string, patientId: string, dataHora: Date): Promise<AppointmentRecord> {
    return withTenant(tenantId, async (trx) => {
      const [row] = await trx('appointments')
        .insert({ tenant_id: tenantId, patient_id: patientId, data_hora: dataHora, status: 'confirmado' })
        .returning('*');
      return row;
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
