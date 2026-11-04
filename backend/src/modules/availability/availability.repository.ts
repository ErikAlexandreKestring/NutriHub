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

export type ResultadoDaCriacao =
  | { criado: AvailabilityRecord; conflito?: undefined }
  | { conflito: AvailabilityRecord; criado?: undefined };

export class AvailabilityRepository {
  /**
   * RF-08: grava o intervalo só se ele não se sobrepõe a outro do mesmo dia.
   * Encostar não é sobrepor: 08:00–12:00 e 12:00–13:00 convivem. A conferência
   * e a inserção correm sob um lock por tenant + dia, para que dois cadastros
   * simultâneos (duas abas) não passem os dois pela conferência.
   */
  async create(tenantId: string, input: CreateAvailabilityInput): Promise<ResultadoDaCriacao> {
    return withTenant(tenantId, async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`availability:${tenantId}:${input.dayOfWeek}`]);

      const conflito: AvailabilityRecord | undefined = await trx('availability')
        .where({ day_of_week: input.dayOfWeek })
        .where('start_time', '<', input.endTime)
        .where('end_time', '>', input.startTime)
        .orderBy('start_time')
        .first();
      if (conflito) return { conflito };

      const [row] = await trx('availability')
        .insert({
          tenant_id: tenantId,
          day_of_week: input.dayOfWeek,
          start_time: input.startTime,
          end_time: input.endTime,
        })
        .returning('*');
      return { criado: row };
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
