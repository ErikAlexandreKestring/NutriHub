import { withTenant } from '../../db/connection';
import { CreateAvailabilityInput } from './availability.validation';

export interface AvailabilityRecord {
  id: string;
  tenant_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: Date;
  updated_at: Date;
}

export class AvailabilityRepository {
  async create(tenantId: string, input: CreateAvailabilityInput): Promise<AvailabilityRecord> {
    return withTenant(tenantId, async (trx) => {
      const [row] = await trx('availability')
        .insert({
          tenant_id: tenantId,
          day_of_week: input.dayOfWeek,
          start_time: input.startTime,
          end_time: input.endTime,
        })
        .returning('*');
      return row;
    });
  }

  async list(tenantId: string): Promise<AvailabilityRecord[]> {
    return withTenant(tenantId, (trx) => trx('availability').orderBy(['day_of_week', 'start_time']));
  }

  async findById(tenantId: string, id: string): Promise<AvailabilityRecord | undefined> {
    return withTenant(tenantId, (trx) => trx('availability').where({ id }).first());
  }

  // RN-08: intervalos cadastrados para um dia da semana específico (0 = domingo).
  async listByDay(tenantId: string, dayOfWeek: number): Promise<AvailabilityRecord[]> {
    return withTenant(tenantId, (trx) => trx('availability').where({ day_of_week: dayOfWeek }));
  }

  async delete(tenantId: string, id: string): Promise<number> {
    return withTenant(tenantId, (trx) => trx('availability').where({ id }).delete());
  }
}
