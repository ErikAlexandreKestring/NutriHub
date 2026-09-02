import type { Knex } from 'knex';

// RF-04: item de uma refeição — um alimento da base TACO com uma quantidade em
// gramas. Os macronutrientes (kcal, proteina_g, carb_g, gordura_g) são calculados
// a partir de foods.*_100g no momento da inserção e persistidos aqui, evitando
// recálculo em tempo de leitura (RFC seção 5.3, decisões de modelagem).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('meal_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('meal_id').notNullable().references('id').inTable('meals').onDelete('CASCADE');
    table.uuid('food_id').notNullable().references('id').inTable('foods');
    table.decimal('quantidade_g', 8, 2).notNullable();
    table.decimal('kcal', 8, 2).notNullable();
    table.decimal('proteina_g', 8, 2).notNullable();
    table.decimal('carb_g', 8, 2).notNullable();
    table.decimal('gordura_g', 8, 2).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id', 'meal_id']);
  });

  await knex.raw('ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE meal_items FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON meal_items
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('meal_items');
}
