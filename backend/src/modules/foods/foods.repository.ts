import { db } from '../../db/connection';

// Catálogo compartilhado (Tabela TACO) — sem tenant_id/RLS, ver migration create_foods.
export interface FoodRecord {
  id: string;
  nome: string;
  kcal_100g: string;
  proteina_100g: string;
  carb_100g: string;
  gordura_100g: string;
}

export class FoodsRepository {
  async list(search?: string): Promise<FoodRecord[]> {
    const query = db('foods').orderBy('nome');
    if (search) {
      query.whereILike('nome', `%${search}%`);
    }
    return query;
  }

  async findById(id: string): Promise<FoodRecord | undefined> {
    return db('foods').where({ id }).first();
  }
}
