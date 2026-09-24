import { withTenant } from '../../db/connection';

export type MealPlanStatus = 'rascunho' | 'ativo' | 'encerrado';

export interface MealPlanRecord {
  id: string;
  tenant_id: string;
  patient_id: string;
  status: MealPlanStatus;
  meta_kcal: string | null;
  orientacoes: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface MealRecord {
  id: string;
  tenant_id: string;
  meal_plan_id: string;
  nome: string;
  horario: string;
  created_at: Date;
}

export interface MealItemRecord {
  id: string;
  tenant_id: string;
  meal_id: string;
  food_id: string;
  quantidade_g: string;
  kcal: string;
  proteina_g: string;
  carb_g: string;
  gordura_g: string;
  created_at: Date;
}

export interface MealItemInput {
  foodId: string;
  quantidadeG: number;
  kcal: number;
  proteinaG: number;
  carbG: number;
  gorduraG: number;
}

/**
 * Reúne meal_plans, meals e meal_items: as três tabelas da hierarquia RF-04 são
 * sempre lidas/gravadas juntas dentro da mesma transação com tenant (RLS ativo
 * nas três — ver migrations create_meal_plans/meals/meal_items).
 */
export class MealPlansRepository {
  async createDraft(tenantId: string, patientId: string): Promise<MealPlanRecord> {
    return withTenant(tenantId, async (trx) => {
      const [plan] = await trx('meal_plans')
        .insert({ tenant_id: tenantId, patient_id: patientId, status: 'rascunho' })
        .returning('*');
      return plan;
    });
  }

  async listByPatient(tenantId: string, patientId: string): Promise<MealPlanRecord[]> {
    return withTenant(tenantId, (trx) =>
      trx('meal_plans').where({ patient_id: patientId }).orderBy('created_at', 'desc'),
    );
  }

  /**
   * RF-05: o plano que o paciente enxerga. O índice parcial
   * `meal_plans_one_active_per_patient` garante no banco que há no máximo uma
   * linha com status 'ativo' por paciente (RN-02), então o `first()` aqui não
   * está escolhendo arbitrariamente entre candidatos.
   */
  async findActiveByPatient(tenantId: string, patientId: string): Promise<MealPlanRecord | undefined> {
    return withTenant(tenantId, (trx) => trx('meal_plans').where({ patient_id: patientId, status: 'ativo' }).first());
  }

  async findById(tenantId: string, id: string): Promise<MealPlanRecord | undefined> {
    return withTenant(tenantId, (trx) => trx('meal_plans').where({ id }).first());
  }

  async addMeal(tenantId: string, mealPlanId: string, input: { nome: string; horario: string }): Promise<MealRecord> {
    return withTenant(tenantId, async (trx) => {
      const [meal] = await trx('meals')
        .insert({ tenant_id: tenantId, meal_plan_id: mealPlanId, nome: input.nome, horario: input.horario })
        .returning('*');
      return meal;
    });
  }

  async findMealById(tenantId: string, id: string): Promise<MealRecord | undefined> {
    return withTenant(tenantId, (trx) => trx('meals').where({ id }).first());
  }

  async addItem(tenantId: string, mealId: string, item: MealItemInput): Promise<MealItemRecord> {
    return withTenant(tenantId, async (trx) => {
      const [mealItem] = await trx('meal_items')
        .insert({
          tenant_id: tenantId,
          meal_id: mealId,
          food_id: item.foodId,
          quantidade_g: item.quantidadeG,
          kcal: item.kcal,
          proteina_g: item.proteinaG,
          carb_g: item.carbG,
          gordura_g: item.gorduraG,
        })
        .returning('*');
      return mealItem;
    });
  }

  async getMealsWithItems(
    tenantId: string,
    mealPlanId: string,
  ): Promise<Array<MealRecord & { items: Array<MealItemRecord & { food_nome: string }> }>> {
    return withTenant(tenantId, async (trx) => {
      const meals = await trx('meals').where({ meal_plan_id: mealPlanId }).orderBy('horario');
      if (meals.length === 0) {
        return [];
      }

      const items = await trx('meal_items')
        .whereIn(
          'meal_id',
          meals.map((meal) => meal.id),
        )
        .join('foods', 'foods.id', 'meal_items.food_id')
        .select('meal_items.*', 'foods.nome as food_nome');

      return meals.map((meal) => ({
        ...meal,
        items: items.filter((item) => item.meal_id === meal.id),
      }));
    });
  }

  async countItems(tenantId: string, mealPlanId: string): Promise<number> {
    return withTenant(tenantId, async (trx) => {
      const meals = await trx('meals').where({ meal_plan_id: mealPlanId }).select('id');
      if (meals.length === 0) {
        return 0;
      }

      const [{ count }] = await trx('meal_items')
        .whereIn(
          'meal_id',
          meals.map((meal) => meal.id),
        )
        .count<{ count: string }[]>('id as count');
      return Number(count);
    });
  }

  // RN-02: publicar encerra o plano ativo anterior do mesmo paciente na mesma transação.
  async publish(
    tenantId: string,
    mealPlanId: string,
    patientId: string,
    dados: { metaKcal: number | null; orientacoes: string | null },
  ): Promise<MealPlanRecord> {
    return withTenant(tenantId, async (trx) => {
      await trx('meal_plans')
        .where({ patient_id: patientId, status: 'ativo' })
        .update({ status: 'encerrado', updated_at: trx.fn.now() });

      const [plan] = await trx('meal_plans')
        .where({ id: mealPlanId })
        .update({
          status: 'ativo',
          meta_kcal: dados.metaKcal,
          orientacoes: dados.orientacoes,
          published_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
        .returning('*');
      return plan;
    });
  }

  /**
   * Corrige meta/orientações de um plano vigente sem republicá-lo: não encerra
   * nada (RN-02 não se aplica) e preserva `published_at`. O filtro por status
   * na própria query cobre a corrida com um `publish` concorrente que encerre o
   * plano entre a leitura no serviço e este update — nesse caso nada é gravado
   * e o retorno é `undefined`.
   */
  async updateActiveDetails(
    tenantId: string,
    mealPlanId: string,
    dados: { metaKcal?: number | null; orientacoes?: string | null },
  ): Promise<MealPlanRecord | undefined> {
    return withTenant(tenantId, async (trx) => {
      const updates: Record<string, unknown> = { updated_at: trx.fn.now() };
      if (dados.metaKcal !== undefined) updates.meta_kcal = dados.metaKcal;
      if (dados.orientacoes !== undefined) updates.orientacoes = dados.orientacoes;

      const [plan] = await trx('meal_plans').where({ id: mealPlanId, status: 'ativo' }).update(updates).returning('*');
      return plan;
    });
  }
}
