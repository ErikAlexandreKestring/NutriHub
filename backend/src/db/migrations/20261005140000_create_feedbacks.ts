import type { Knex } from 'knex';

// RF-06, fluxo 3.5: dificuldade do paciente com a dieta. Vinculado ao
// paciente, ao plano e ao tenant (passo 3), e opcionalmente à refeição em que
// o paciente clicou em "Reportar Problema" (passo 1).
//
// `meal_id` vira nulo se a refeição sair do plano: o feedback continua sendo
// histórico do paciente mesmo que o nutricionista ajuste o plano depois.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('feedbacks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.uuid('meal_plan_id').notNullable().references('id').inTable('meal_plans').onDelete('CASCADE');
    table.uuid('meal_id').references('id').inTable('meals').onDelete('SET NULL');
    table.text('descricao').notNullable();
    table.enu('status', ['pendente', 'resolvido']).notNullable().defaultTo('pendente');
    table.text('resposta');
    table.timestamp('resolvido_em', { useTz: true });
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Painel do nutricionista (RF-10: "feedbacks pendentes") e histórico do paciente.
    table.index(['tenant_id', 'status', 'created_at']);
    table.index(['tenant_id', 'patient_id']);
  });

  await knex.raw('ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE feedbacks FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON feedbacks
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('feedbacks');
}
