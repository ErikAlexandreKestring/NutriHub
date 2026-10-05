import { Knex } from 'knex';
import { db, withTenant } from '../db/connection';

/**
 * E-06: confere se o tenant_id do JWT ainda corresponde a um vínculo real.
 *
 * A assinatura só prova que o token foi emitido por nós — não que o tenant
 * continua existindo, nem que o portador pertence a ele. Um tenant excluído
 * com tokens ainda dentro das 8h/24h passaria pela assinatura.
 */
export class TokenScopeRepository {
  constructor(private readonly connection: Knex = db) {}

  async tenantExists(tenantId: string): Promise<boolean> {
    const tenant = await this.connection('tenants').where({ id: tenantId }).first('id');
    return Boolean(tenant);
  }

  // Dentro de withTenant(): se o paciente for de outro tenant, o RLS de
  // `patients` simplesmente não devolve a linha.
  async patientBelongsToTenant(tenantId: string, patientId: string): Promise<boolean> {
    const patient = await withTenant(tenantId, (trx) =>
      trx('patients').where({ id: patientId }).first('id'),
    );
    return Boolean(patient);
  }
}
