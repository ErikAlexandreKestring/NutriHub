import type { Knex } from 'knex';

// RF-04: refeições dentro de um plano alimentar (ex.: "Café da manhã", 07:30).
// tenant_id é redundante em relação a meal_plans (poderia ser obtido via join),
// mas é mantido aqui para que a política de RLS valha diretamente nesta tabela
// também, sem depender de a query lembrar de fazer o join (RFC seção 5.4).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('meals', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('meal_plan_id').notNullable().references('id').inTable('meal_plans').onDelete('CASCADE');
    table.string('nome', 60).notNullable();
    table.time('horario').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id', 'meal_plan_id']);
  });

  await knex.raw('ALTER TABLE meals ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE meals FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON meals
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('meals');
}
