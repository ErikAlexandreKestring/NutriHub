import type { Knex } from 'knex';

// RNF-10 / E-06: log de auditoria das ações críticas, com timestamp, usuário e
// IP de origem.
//
// Sem RLS e sem chave estrangeira para `tenants`, de propósito: o evento que
// abre esta tabela (E-06) é justamente um token cujo tenant_id não existe ou
// não confere — exigir o tenant válido impediria registrar o caso que mais
// interessa. Pelo mesmo motivo user_id e tenant_id podem ser nulos.
//
// O papel da aplicação só grava e lê: sem UPDATE e DELETE, um log de
// auditoria que a própria aplicação consegue reescrever não serve de prova.
const APP_ROLE = 'nutrihub_app';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('evento', 50).notNullable();
    table.uuid('user_id');
    table.uuid('tenant_id');
    table.string('ip', 45);
    table.jsonb('detalhes');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id', 'created_at']);
    table.index('evento');
  });

  await knex.raw(`REVOKE UPDATE, DELETE ON audit_logs FROM ${APP_ROLE}`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
}
