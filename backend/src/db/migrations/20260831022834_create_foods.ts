import type { Knex } from 'knex';

// RF-04 / RN-03: base de alimentos (Tabela TACO — UNICAMP). Tabela de referência
// compartilhada por todos os tenants (catálogo, não dado de negócio de um tenant
// específico), por isso não tem tenant_id nem RLS — RFC seção 5.3.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('foods', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('nome', 150).notNullable().unique();
    table.decimal('kcal_100g', 8, 2).notNullable();
    table.decimal('proteina_100g', 8, 2).notNullable();
    table.decimal('carb_100g', 8, 2).notNullable();
    table.decimal('gordura_100g', 8, 2).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('foods');
}
