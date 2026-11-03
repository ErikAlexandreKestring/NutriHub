import type { Knex } from 'knex';
import { decryptSensitive, encryptSensitive, isEncrypted } from '../../shared/utils/sensitiveData';

// RNF-03: a partir daqui `patients.historico` é gravado cifrado (ver
// shared/utils/sensitiveData). Esta migration cifra os históricos que já
// existiam em texto claro, com a DATA_ENCRYPTION_KEY do ambiente.
//
// Percorre tenant a tenant com app.current_tenant definido: `patients` tem
// FORCE ROW LEVEL SECURITY, e no Azure Database for PostgreSQL o usuário
// administrador não é superusuário — sem o tenant na sessão, não veria linha
// nenhuma.
async function reescrever(knex: Knex, transformar: (historico: string) => string | null): Promise<void> {
  const tenants: Array<{ id: string }> = await knex('tenants').select('id');

  for (const tenant of tenants) {
    await knex.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.current_tenant', ?, true)", [tenant.id]);
      const pacientes: Array<{ id: string; historico: string }> = await trx('patients')
        .select('id', 'historico')
        .whereNotNull('historico');

      for (const paciente of pacientes) {
        const novo = transformar(paciente.historico);
        if (novo !== null) {
          await trx('patients').where({ id: paciente.id }).update({ historico: novo });
        }
      }
    });
  }
}

export async function up(knex: Knex): Promise<void> {
  await reescrever(knex, (historico) => (isEncrypted(historico) ? null : encryptSensitive(historico)));
}

export async function down(knex: Knex): Promise<void> {
  await reescrever(knex, (historico) => (isEncrypted(historico) ? decryptSensitive(historico) : null));
}
