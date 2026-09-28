import type { Knex } from 'knex';

// RF-04: prescrever "1 unidade de banana" em vez de "75 g". A gramatura de cada
// medida caseira vem da Tabela de Medidas Referidas da POF/IBGE, ligada à TACO
// por curadoria manual (os códigos das duas tabelas não se correspondem — ver
// seeds/data/FONTES.md). O cálculo de macros continua em gramas (RN-03): a
// medida só converte a quantidade antes da conta.
export async function up(knex: Knex): Promise<void> {
  // `taco_numero` identifica o alimento na publicação oficial e é a chave de
  // upsert do seed. Fica nulo nos alimentos do recorte antigo, que continuam
  // existindo porque planos já publicados apontam para eles.
  await knex.schema.alterTable('foods', (table) => {
    table.integer('taco_numero').unique();
    table.string('categoria', 60);
  });

  // Catálogo compartilhado, como `foods`: sem tenant_id nem RLS.
  await knex.schema.createTable('food_measures', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('food_id').notNullable().references('id').inTable('foods').onDelete('CASCADE');
    table.string('nome', 40).notNullable();
    table.decimal('gramas', 8, 2).notNullable();

    table.unique(['food_id', 'nome']);
  });
  await knex.raw('ALTER TABLE food_measures ADD CONSTRAINT food_measures_gramas_positivas CHECK (gramas > 0)');

  // Retrato da medida no momento da prescrição: se a gramatura do catálogo for
  // corrigida depois, o plano que o paciente já recebeu não muda sozinho.
  // `quantidade_g` continua sendo a base dos macros (= quantidade_medida × medida_g).
  await knex.schema.alterTable('meal_items', (table) => {
    table.string('medida_nome', 40);
    table.decimal('medida_g', 8, 2);
    table.decimal('quantidade_medida', 8, 2);
  });
  await knex.raw(`
    ALTER TABLE meal_items ADD CONSTRAINT meal_items_medida_completa CHECK (
      (medida_nome IS NULL AND medida_g IS NULL AND quantidade_medida IS NULL)
      OR (medida_nome IS NOT NULL AND medida_g IS NOT NULL AND quantidade_medida IS NOT NULL)
    )
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE meal_items DROP CONSTRAINT IF EXISTS meal_items_medida_completa');
  await knex.schema.alterTable('meal_items', (table) => {
    table.dropColumn('medida_nome');
    table.dropColumn('medida_g');
    table.dropColumn('quantidade_medida');
  });
  await knex.schema.dropTableIfExists('food_measures');
  await knex.schema.alterTable('foods', (table) => {
    table.dropColumn('taco_numero');
    table.dropColumn('categoria');
  });
}
