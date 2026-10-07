import type { Knex } from 'knex';

// RF-06 / RF-07: o alerta de feedback chega ao nutricionista também por
// WhatsApp, e o cadastro (RF-01) só guardava e-mail. Opcional: sem telefone o
// nutricionista continua recebendo tudo por e-mail.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (table) => {
    table.string('telefone', 20).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('telefone');
  });
}
