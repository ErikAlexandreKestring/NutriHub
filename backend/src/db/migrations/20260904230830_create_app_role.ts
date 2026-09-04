import type { Knex } from 'knex';

// RN-01 / RNF-01: a aplicação vinha se conectando ao Postgres como o usuário
// `postgres` (superusuário), e superusuário tem BYPASSRLS por padrão — ou seja,
// TODA política de RLS das tabelas de negócio (patients, meal_plans, meals,
// meal_items, availability, appointments) estava sendo silenciosamente
// ignorada desde que essas tabelas existem. As migrations continuam rodando
// como `postgres` (dono do schema); a aplicação em tempo de execução passa a
// usar este novo papel, que não é superusuário e portanto respeita RLS.
const APP_ROLE = 'nutrihub_app';
const APP_ROLE_PASSWORD = 'nutrihub_app_dev_password'; // dev apenas — trocar via secret em produção

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_ROLE_PASSWORD}';
      END IF;
    END
    $$;
  `);

  await knex.raw(`GRANT USAGE ON SCHEMA public TO ${APP_ROLE}`);
  await knex.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`);
  await knex.raw(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE}`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${APP_ROLE}`);
  await knex.raw(`DROP ROLE IF EXISTS ${APP_ROLE}`);
}
