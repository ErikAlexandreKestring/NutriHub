import type { Knex } from 'knex';

// RN-10: "cancelamento pelo paciente exige antecedência mínima configurável"
// pelo nutricionista. Guardamos como um valor por tenant, com um padrão
// razoável (24h); um endpoint para o nutricionista editar esse valor fica
// como próximo passo (hoje não existe rota de "configurações do tenant").
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (table) => {
    table.integer('cancelamento_antecedencia_horas').notNullable().defaultTo(24);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('cancelamento_antecedencia_horas');
  });
}
