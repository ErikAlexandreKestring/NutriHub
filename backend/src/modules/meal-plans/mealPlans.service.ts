import { MealPlansRepository } from './mealPlans.repository';
import { FoodsRepository } from '../foods/foods.repository';
import { PatientsRepository } from '../patients/patients.repository';
import { AddMealInput, AddMealItemInput } from './mealPlans.validation';
import {
  EmptyMealPlanError,
  FoodNotFoundError,
  InvalidMealPlanStateError,
  MealNotFoundError,
  MealPlanNotFoundError,
  PatientNotFoundError,
} from '../../shared/errors/AppError';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export class MealPlansService {
  constructor(
    private readonly repository: MealPlansRepository = new MealPlansRepository(),
    private readonly foodsRepository: FoodsRepository = new FoodsRepository(),
    private readonly patientsRepository: PatientsRepository = new PatientsRepository(),
  ) {}

  // RF-04, passo 2-3 do fluxo: cria o plano em rascunho vinculado ao paciente e ao tenant.
  async createDraft(tenantId: string, patientId: string) {
    await this.assertPatientExists(tenantId, patientId);
    return this.repository.createDraft(tenantId, patientId);
  }

  async listByPatient(tenantId: string, patientId: string) {
    await this.assertPatientExists(tenantId, patientId);
    return this.repository.listByPatient(tenantId, patientId);
  }

  // Retorna o plano com refeições, itens e totais agregados (soma dos valores já
  // persistidos em meal_items — não recalcula a partir da TACO na leitura).
  async getById(tenantId: string, id: string) {
    const plan = await this.repository.findById(tenantId, id);
    if (!plan) {
      throw new MealPlanNotFoundError();
    }

    const meals = await this.repository.getMealsWithItems(tenantId, id);
    const totais = meals.reduce(
      (acc, meal) => {
        for (const item of meal.items) {
          acc.kcal += Number(item.kcal);
          acc.proteina_g += Number(item.proteina_g);
          acc.carb_g += Number(item.carb_g);
          acc.gordura_g += Number(item.gordura_g);
        }
        return acc;
      },
      { kcal: 0, proteina_g: 0, carb_g: 0, gordura_g: 0 },
    );

    return { ...plan, meals, totais };
  }

  // RF-04, passo 4: adiciona refeição — só permitido enquanto o plano é rascunho.
  async addMeal(tenantId: string, mealPlanId: string, input: AddMealInput) {
    const plan = await this.getDraftOrThrow(tenantId, mealPlanId);
    return this.repository.addMeal(tenantId, plan.id, input);
  }

  // RF-04, passo 4-5: adiciona alimento da TACO à refeição e calcula/persiste os macros.
  async addItem(tenantId: string, mealPlanId: string, mealId: string, input: AddMealItemInput) {
    await this.getDraftOrThrow(tenantId, mealPlanId);

    const meal = await this.repository.findMealById(tenantId, mealId);
    if (!meal || meal.meal_plan_id !== mealPlanId) {
      throw new MealNotFoundError();
    }

    // E-07 / RN-03: só alimentos cadastrados na base TACO podem entrar no plano.
    const food = await this.foodsRepository.findById(input.foodId);
    if (!food) {
      throw new FoodNotFoundError();
    }

    const factor = input.quantidadeG / 100;
    return this.repository.addItem(tenantId, mealId, {
      foodId: food.id,
      quantidadeG: input.quantidadeG,
      kcal: round2(Number(food.kcal_100g) * factor),
      proteinaG: round2(Number(food.proteina_100g) * factor),
      carbG: round2(Number(food.carb_100g) * factor),
      gorduraG: round2(Number(food.gordura_100g) * factor),
    });
  }

  // RF-04, passos 6-7: publica o plano, encerrando o anterior (RN-02).
  async publish(tenantId: string, mealPlanId: string) {
    const plan = await this.getDraftOrThrow(tenantId, mealPlanId);

    // E-08: não publica plano sem nenhuma refeição/item.
    const itemCount = await this.repository.countItems(tenantId, mealPlanId);
    if (itemCount === 0) {
      throw new EmptyMealPlanError();
    }

    return this.repository.publish(tenantId, mealPlanId, plan.patient_id);
  }

  private async getDraftOrThrow(tenantId: string, mealPlanId: string) {
    const plan = await this.repository.findById(tenantId, mealPlanId);
    if (!plan) {
      throw new MealPlanNotFoundError();
    }
    if (plan.status !== 'rascunho') {
      throw new InvalidMealPlanStateError('Só é possível alterar um plano em rascunho');
    }
    return plan;
  }

  private async assertPatientExists(tenantId: string, patientId: string) {
    const patient = await this.patientsRepository.findById(tenantId, patientId);
    if (!patient) {
      throw new PatientNotFoundError();
    }
  }
}
