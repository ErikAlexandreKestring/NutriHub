import type { Knex } from 'knex';

// RF-04: cabeçalho do plano alimentar. Ciclo de vida rascunho -> ativo -> encerrado
// (RFC seção 3.3). RN-02: só um plano ativo por paciente por vez — garantido tanto
// na aplicação (mealPlans.service) quanto no banco (índice único parcial abaixo),
// como defesa em profundidade.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('meal_plans', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.enu('status', ['rascunho', 'ativo', 'encerrado']).notNullable().defaultTo('rascunho');
    table.timestamp('published_at', { useTz: true });
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id', 'patient_id']);
  });

  await knex.raw(`
    CREATE UNIQUE INDEX meal_plans_one_active_per_patient
    ON meal_plans (patient_id)
    WHERE status = 'ativo'
  `);

  await knex.raw('ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE meal_plans FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON meal_plans
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('meal_plans');
}
