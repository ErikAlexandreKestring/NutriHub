import { db } from '../../db/connection';

// Catálogo compartilhado (Tabela TACO) — sem tenant_id/RLS, ver migration create_foods.
export interface FoodRecord {
  id: string;
  nome: string;
  categoria: string | null;
  kcal_100g: string;
  proteina_100g: string;
  carb_100g: string;
  gordura_100g: string;
}

/** Medida caseira de um alimento (ex.: 1 unidade = 75 g). */
export interface FoodMeasureRecord {
  id: string;
  food_id: string;
  nome: string;
  gramas: string;
}

export type FoodWithMeasures = FoodRecord & { medidas: Array<Omit<FoodMeasureRecord, 'food_id'>> };

/** Com a TACO inteira, uma busca curta devolveria centenas de linhas que a tela não mostra. */
const LIMITE_DA_BUSCA = 30;

// Sem a extensão `unaccent` (que o Azure exige liberar à parte): o nutricionista
// digita "maca" e precisa achar "Maçã".
const COM_ACENTO = 'áàâãäéèêëíìîïóòôõöúùûüç';
const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuuc';

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** `%` e `_` digitados são texto, não curinga do LIKE. */
function escaparLike(texto: string): string {
  return texto.replace(/[%_\\]/g, '\\$&');
}

export class FoodsRepository {
  /**
   * Cada palavra do termo precisa aparecer no nome, em qualquer ordem: os nomes
   * da TACO são "Banana, prata, crua", e quem busca digita "banana prata".
   * Os alimentos do recorte antigo (sem `taco_numero`) não entram: continuam
   * no banco só porque planos já publicados apontam para eles.
   */
  async list(search?: string): Promise<FoodWithMeasures[]> {
    const query = db('foods')
      .whereNotNull('taco_numero')
      .select('id', 'nome', 'categoria', 'kcal_100g', 'proteina_100g', 'carb_100g', 'gordura_100g')
      .limit(LIMITE_DA_BUSCA);

    const palavras = search ? normalizar(search).split(/\s+/).filter(Boolean).map(escaparLike) : [];
    for (const palavra of palavras) {
      query.whereRaw('translate(lower(nome), ?, ?) LIKE ?', [COM_ACENTO, SEM_ACENTO, `%${palavra}%`]);
    }
    // Quem digita "ovo" quer "Ovo, de galinha…" antes de "Macarrão… com ovos".
    if (palavras.length > 0) {
      query.orderByRaw('translate(lower(nome), ?, ?) LIKE ? DESC', [COM_ACENTO, SEM_ACENTO, `${palavras[0]}%`]);
    }
    query.orderBy('nome');

    return this.comMedidas(await query);
  }

  /** Um alimento com suas medidas — o construtor carrega o alimento atual ao editar um item. */
  async findByIdWithMeasures(id: string): Promise<FoodWithMeasures | undefined> {
    const food: FoodRecord | undefined = await db('foods')
      .where({ id })
      .select('id', 'nome', 'categoria', 'kcal_100g', 'proteina_100g', 'carb_100g', 'gordura_100g')
      .first();
    if (!food) {
      return undefined;
    }
    const [comMedidas] = await this.comMedidas([food]);
    return comMedidas;
  }

  private async comMedidas(foods: FoodRecord[]): Promise<FoodWithMeasures[]> {
    if (foods.length === 0) {
      return [];
    }

    const medidas: FoodMeasureRecord[] = await db('food_measures')
      .whereIn(
        'food_id',
        foods.map((food) => food.id),
      )
      .orderBy('gramas');

    return foods.map((food) => ({
      ...food,
      medidas: medidas
        .filter((medida) => medida.food_id === food.id)
        .map(({ id, nome, gramas }) => ({ id, nome, gramas })),
    }));
  }

  async findById(id: string): Promise<FoodRecord | undefined> {
    return db('foods').where({ id }).first();
  }

  async findMeasure(foodId: string, measureId: string): Promise<FoodMeasureRecord | undefined> {
    return db('food_measures').where({ id: measureId, food_id: foodId }).first();
  }
}
