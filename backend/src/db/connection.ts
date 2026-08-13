import knexLib, { Knex } from 'knex';
import knexConfig from './knexfile';
import { env } from '../config/env';

const environment = env.nodeEnv === 'test' ? 'test' : env.nodeEnv === 'production' ? 'production' : 'development';

export const db: Knex = knexLib(knexConfig[environment]);

/**
 * RNF-01 / RN-01: define o tenant_id da sessão PostgreSQL antes de qualquer query,
 * ativando as políticas de Row-Level Security (RLS) descritas na seção 5.4 do RFC.
 *
 * IMPORTANTE: precisa ser chamado dentro da MESMA conexão/transação que executa
 * a query de negócio — por isso usamos db.transaction() nos repositórios.
 */
export async function withTenant<T>(
  tenantId: string,
  callback: (trx: Knex.Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (trx) => {
    await trx.raw('SET LOCAL app.current_tenant = ?', [tenantId]);
    return callback(trx);
  });
}
