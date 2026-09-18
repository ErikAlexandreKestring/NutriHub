import type { Knex } from 'knex';

// RF-05: o paciente deve ver "metas calóricas e orientações do nutricionista".
// Nenhum dos dois existia no schema: `meal_items` guarda o que foi prescrito
// (consumo previsto), que não é a mesma coisa que a meta definida pelo
// nutricionista — um plano pode somar 1.850 kcal mirando uma meta de 1.800.
// Sem esta coluna a tela teria de apresentar a soma dos itens como se fosse a
// meta, que é justamente a leitura errada.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('meal_plans', (table) => {
    table.decimal('meta_kcal', 7, 2);
    table.text('orientacoes');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('meal_plans', (table) => {
    table.dropColumn('meta_kcal');
    table.dropColumn('orientacoes');
  });
}
