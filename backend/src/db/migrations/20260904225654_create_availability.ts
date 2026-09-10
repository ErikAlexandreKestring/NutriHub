import type { Knex } from 'knex';

// RF-08: grade de disponibilidade do nutricionista, usada pelo RN-08 para
// validar se um agendamento cai dentro do período de atendimento cadastrado.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('availability', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.integer('day_of_week').notNullable();
    table.time('start_time').notNullable();
    table.time('end_time').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id', 'day_of_week']);
  });

  await knex.raw('ALTER TABLE availability ADD CONSTRAINT availability_day_of_week_range CHECK (day_of_week BETWEEN 0 AND 6)');
  await knex.raw('ALTER TABLE availability ADD CONSTRAINT availability_start_before_end CHECK (start_time < end_time)');

  await knex.raw('ALTER TABLE availability ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE availability FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON availability
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('availability');
}
