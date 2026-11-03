import type { Knex } from 'knex';

// UC-03 (RF-05): o paciente marca as refeições do dia como concluídas. Uma
// linha por refeição por dia — o plano se repete todo dia, então o "feito"
// vale só para a data em que foi marcado e o dia seguinte começa em branco.
//
// `data` é o dia no fuso de America/Sao_Paulo (shared/utils/timezone), e não
// um timestamp, para que "hoje" não dependa do fuso do servidor.
//
// Sem patient_id: a refeição já leva ao plano e o plano ao paciente, e o
// ON DELETE CASCADE de meals faz estas linhas sumirem junto com o plano.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('meal_completions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('meal_id').notNullable().references('id').inTable('meals').onDelete('CASCADE');
    table.date('data').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['meal_id', 'data']);
    table.index(['tenant_id', 'data']);
  });

  await knex.raw('ALTER TABLE meal_completions ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE meal_completions FORCE ROW LEVEL SECURITY');

  await knex.raw(`
    CREATE POLICY tenant_isolation ON meal_completions
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('meal_completions');
}
