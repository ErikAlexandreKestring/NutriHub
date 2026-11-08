import type { Knex } from 'knex';

// Confirmação do e-mail do nutricionista e recuperação de senha. Os dois
// fluxos mandam um link com um token de uso único; como no primeiro acesso do
// paciente, o banco guarda só o hash SHA-256 do token (shared/utils/accessToken)
// e a validade.
//
// `email_confirmado_em` nulo bloqueia o login. As contas que já existem nascem
// confirmadas (com a data de criação): elas foram usadas antes de a
// confirmação existir, e trancá-las agora deixaria os nutricionistas para fora
// sem aviso.
//
// `tenants` não tem RLS (o login e o cadastro a leem sem tenant na sessão),
// então o UPDATE roda direto.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (table) => {
    table.timestamp('email_confirmado_em', { useTz: true });
    table.string('confirmacao_token_hash', 64);
    table.timestamp('confirmacao_token_expira_em', { useTz: true });
    table.string('senha_token_hash', 64);
    table.timestamp('senha_token_expira_em', { useTz: true });
  });

  await knex('tenants').update({ email_confirmado_em: knex.ref('created_at') });

  await knex.raw(
    'CREATE UNIQUE INDEX tenants_confirmacao_token_hash ON tenants (confirmacao_token_hash) WHERE confirmacao_token_hash IS NOT NULL',
  );
  await knex.raw(
    'CREATE UNIQUE INDEX tenants_senha_token_hash ON tenants (senha_token_hash) WHERE senha_token_hash IS NOT NULL',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS tenants_senha_token_hash');
  await knex.raw('DROP INDEX IF EXISTS tenants_confirmacao_token_hash');
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('senha_token_expira_em');
    table.dropColumn('senha_token_hash');
    table.dropColumn('confirmacao_token_expira_em');
    table.dropColumn('confirmacao_token_hash');
    table.dropColumn('email_confirmado_em');
  });
}
