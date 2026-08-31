import type { Knex } from 'knex';

// RF-04 / RN-03: subconjunto representativo da Tabela TACO (UNICAMP, 2011),
// valores por 100g. A RFC (seção 6) prevê "Base de alimentos importada uma vez
// ao banco" a partir da tabela oficial completa (~600 itens); aqui semeamos um
// recorte de alimentos comuns o suficiente para demonstrar o construtor de
// plano alimentar. Importação completa da planilha oficial fica como próximo
// passo, sem mudança de schema.
const FOODS: Array<{
  nome: string;
  kcal_100g: number;
  proteina_100g: number;
  carb_100g: number;
  gordura_100g: number;
}> = [
  { nome: 'Arroz branco cozido', kcal_100g: 128, proteina_100g: 2.5, carb_100g: 28.1, gordura_100g: 0.2 },
  { nome: 'Feijão carioca cozido', kcal_100g: 76, proteina_100g: 4.8, carb_100g: 13.6, gordura_100g: 0.5 },
  { nome: 'Peito de frango grelhado', kcal_100g: 159, proteina_100g: 32.0, carb_100g: 0.0, gordura_100g: 2.5 },
  { nome: 'Ovo de galinha cozido', kcal_100g: 146, proteina_100g: 13.3, carb_100g: 0.6, gordura_100g: 9.5 },
  { nome: 'Batata inglesa cozida', kcal_100g: 52, proteina_100g: 1.2, carb_100g: 11.9, gordura_100g: 0.1 },
  { nome: 'Batata doce cozida', kcal_100g: 77, proteina_100g: 0.6, carb_100g: 18.4, gordura_100g: 0.1 },
  { nome: 'Alface crespa crua', kcal_100g: 11, proteina_100g: 1.3, carb_100g: 1.7, gordura_100g: 0.2 },
  { nome: 'Tomate cru', kcal_100g: 15, proteina_100g: 1.1, carb_100g: 3.1, gordura_100g: 0.2 },
  { nome: 'Banana prata', kcal_100g: 98, proteina_100g: 1.3, carb_100g: 26.0, gordura_100g: 0.1 },
  { nome: 'Maçã com casca', kcal_100g: 56, proteina_100g: 0.3, carb_100g: 15.2, gordura_100g: 0.0 },
  { nome: 'Aveia em flocos', kcal_100g: 394, proteina_100g: 13.9, carb_100g: 66.6, gordura_100g: 8.5 },
  { nome: 'Leite integral', kcal_100g: 61, proteina_100g: 2.9, carb_100g: 4.3, gordura_100g: 3.2 },
  { nome: 'Iogurte natural integral', kcal_100g: 51, proteina_100g: 4.1, carb_100g: 1.9, gordura_100g: 3.0 },
  { nome: 'Pão francês', kcal_100g: 300, proteina_100g: 8.0, carb_100g: 58.6, gordura_100g: 3.1 },
  { nome: 'Pão de forma integral', kcal_100g: 253, proteina_100g: 9.4, carb_100g: 49.9, gordura_100g: 3.4 },
  { nome: 'Queijo minas frescal', kcal_100g: 264, proteina_100g: 17.4, carb_100g: 3.2, gordura_100g: 20.2 },
  { nome: 'Carne bovina (patinho) grelhada', kcal_100g: 219, proteina_100g: 35.9, carb_100g: 0.0, gordura_100g: 7.3 },
  { nome: 'Tilápia grelhada', kcal_100g: 128, proteina_100g: 26.2, carb_100g: 0.0, gordura_100g: 1.7 },
  { nome: 'Brócolis cozido', kcal_100g: 25, proteina_100g: 2.1, carb_100g: 4.4, gordura_100g: 0.5 },
  { nome: 'Cenoura crua', kcal_100g: 34, proteina_100g: 1.3, carb_100g: 7.7, gordura_100g: 0.2 },
  { nome: 'Abacate', kcal_100g: 96, proteina_100g: 1.2, carb_100g: 6.0, gordura_100g: 8.4 },
  { nome: 'Azeite de oliva', kcal_100g: 884, proteina_100g: 0.0, carb_100g: 0.0, gordura_100g: 100.0 },
  { nome: 'Amendoim torrado', kcal_100g: 606, proteina_100g: 27.2, carb_100g: 20.3, gordura_100g: 49.2 },
  { nome: 'Macarrão cozido', kcal_100g: 158, proteina_100g: 5.8, carb_100g: 30.9, gordura_100g: 0.9 },
  { nome: 'Laranja pera', kcal_100g: 37, proteina_100g: 1.0, carb_100g: 8.9, gordura_100g: 0.1 },
  { nome: 'Whey protein (pó, concentrado)', kcal_100g: 405, proteina_100g: 80.0, carb_100g: 8.0, gordura_100g: 5.0 },
];

export async function seed(knex: Knex): Promise<void> {
  const [{ count }] = await knex('foods').count<{ count: string }[]>('id as count');
  if (Number(count) > 0) {
    return;
  }

  await knex('foods').insert(FOODS);
}
