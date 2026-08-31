import type { Knex } from 'knex';
import { env } from '../config/env';

// RN-06 / RNF-01: banco único multi-tenant, isolamento garantido via RLS (ver migration 0001).
const baseConnection = {
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
};

const config: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: baseConnection,
    migrations: { directory: './migrations', extension: 'ts' },
    seeds: { directory: './seeds', extension: 'ts' },
  },

  test: {
    client: 'pg',
    connection: {
      ...baseConnection,
      database: process.env.DB_NAME_TEST ?? `${env.db.database}_test`,
    },
    migrations: { directory: './migrations', extension: 'ts' },
    seeds: { directory: './seeds', extension: 'ts' },
  },

  production: {
    client: 'pg',
    connection: baseConnection,
    pool: { min: 2, max: 10 },
    migrations: { directory: './migrations', extension: 'ts' },
    seeds: { directory: './seeds', extension: 'ts' },
  },
};

export default config;
