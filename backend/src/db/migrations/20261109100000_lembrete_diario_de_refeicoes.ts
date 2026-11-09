import type { Knex } from 'knex';

// RF-07: lembrete diário, por e-mail, das refeições que o paciente ainda não
// marcou como feitas.
//
// - `lembrete_refeicoes`: o próprio paciente desliga pela PWA. Começa ligado,
//   inclusive para quem já existe.
// - `lembrete_refeicoes_em`: o dia (fuso de America/Sao_Paulo) em que o
//   lembrete já foi processado. O job reserva o paciente com um UPDATE
//   condicionado a esta coluna, então reiniciar a API ou ter duas instâncias
//   não manda o lembrete duas vezes no mesmo dia.
//
// ALTER TABLE não passa pelo RLS: não é preciso percorrer os tenants.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patients', (table) => {
    table.boolean('lembrete_refeicoes').notNullable().defaultTo(true);
    table.date('lembrete_refeicoes_em');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patients', (table) => {
    table.dropColumn('lembrete_refeicoes_em');
    table.dropColumn('lembrete_refeicoes');
  });
}
