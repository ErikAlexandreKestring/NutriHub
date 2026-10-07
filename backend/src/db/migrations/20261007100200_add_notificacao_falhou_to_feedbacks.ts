import type { Knex } from 'knex';

// E-17: depois de 3 tentativas de e-mail sem sucesso, o feedback aparece como
// "notificação falha" no painel do nutricionista. É um campo à parte, e não um
// terceiro valor de `status`: o feedback continua pendente de resolução.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feedbacks', (table) => {
    table.boolean('notificacao_falhou').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('feedbacks', (table) => {
    table.dropColumn('notificacao_falhou');
  });
}
