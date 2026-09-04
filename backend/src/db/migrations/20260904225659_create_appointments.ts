import type { Knex } from 'knex';

// RF-08/11/12: agendamentos de consulta. RN-09 ("proibido agendar dois
// pacientes no mesmo horário") é garantida na aplicação e reforçada aqui por
// um índice único parcial — só um agendamento confirmado por tenant/horário.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('appointments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    table.timestamp('data_hora', { useTz: true }).notNullable();
    table.enu('status', ['confirmado', 'cancelado']).notNullable().defaultTo('confirmado');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['tenant_id', 'patient_id']);
  });

  await knex.raw(`
    CREATE UNIQUE INDEX appointments_no_conflict
    ON appointments (tenant_id, data_hora)
    WHERE status = 'confirmado'
  `);

  await knex.raw('ALTER TABLE appointments ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE appointments FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON appointments
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('appointments');
}
