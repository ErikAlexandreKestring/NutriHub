import knexLib, { Knex } from 'knex';
import path from 'path';
import knexConfig from '../../src/db/knexfile';

/**
 * Cria o banco de teste se ainda não existir e aplica as migrations com o
 * usuário dono do schema — o mesmo caminho do `npm run migrate`, então as
 * políticas de RLS testadas são as que vão para produção.
 */
export default async function globalSetup(): Promise<void> {
  const config = knexConfig.test;
  const connection = config.connection as Knex.PgConnectionConfig;
  const database = connection.database as string;

  const admin = knexLib({ client: 'pg', connection: { ...connection, database: 'postgres' } });
  try {
    const existe = await admin.raw('SELECT 1 FROM pg_database WHERE datname = ?', [database]);
    if (existe.rowCount === 0) {
      await admin.raw('CREATE DATABASE ??', [database]);
    }
  } finally {
    await admin.destroy();
  }

  const owner = knexLib(config);
  try {
    await owner.migrate.latest({ directory: path.join(__dirname, '../../src/db/migrations') });
  } finally {
    await owner.destroy();
  }
}
