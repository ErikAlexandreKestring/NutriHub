import type { Knex } from 'knex';

// RF-03: "Cada paciente deve ter nome, data de nascimento, contato e histórico."
// Campo ausente na migration original de `patients` — adicionado à parte porque
// aquela migration já foi mesclada na main (não deve ser reescrita).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patients', (table) => {
    table.text('historico');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patients', (table) => {
    table.dropColumn('historico');
  });
}
