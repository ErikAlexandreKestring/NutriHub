import type { Knex } from 'knex';

// RF-03: cadastro de pacientes vinculados ao tenant (nutricionista).
// RNF-01 / RN-01: isolamento entre tenants garantido via Row-Level Security —
// mesmo se uma query da aplicação esquecer o filtro por tenant_id, o Postgres
// bloqueia o acesso a linhas de outro tenant (RFC, seção 5.4).
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('patients', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('tenant_id')
      .notNullable()
      .references('id')
      .inTable('tenants')
      .onDelete('CASCADE');
    table.string('nome', 100).notNullable();
    table.string('email', 255).notNullable();
    table.date('data_nascimento').notNullable();
    table.string('contato', 20);
    table.enu('status', ['ativo', 'inativo']).notNullable().defaultTo('ativo');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Um mesmo e-mail pode existir em tenants diferentes, mas não duas vezes
    // para o mesmo nutricionista.
    table.unique(['tenant_id', 'email']);
    table.index('tenant_id');
  });

  await knex.raw('ALTER TABLE patients ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE patients FORCE ROW LEVEL SECURITY');

  await knex.raw(`
    CREATE POLICY tenant_isolation ON patients
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('patients');
}
