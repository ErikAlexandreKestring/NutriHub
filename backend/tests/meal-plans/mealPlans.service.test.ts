import { MealPlansService } from '../../src/modules/meal-plans/mealPlans.service';
import { MealPlansRepository, MealPlanRecord, MealRecord } from '../../src/modules/meal-plans/mealPlans.repository';
import { FoodsRepository, FoodRecord } from '../../src/modules/foods/foods.repository';
import { PatientsRepository, PatientRecord } from '../../src/modules/patients/patients.repository';
import {
  EmptyMealPlanError,
  FoodNotFoundError,
  InvalidMealPlanStateError,
  MealNotFoundError,
  MealPlanNotFoundError,
  NoActiveMealPlanError,
  PatientNotFoundError,
} from '../../src/shared/errors/AppError';

function buildPlan(overrides: Partial<MealPlanRecord> = {}): MealPlanRecord {
  return {
    id: 'plan-1',
    tenant_id: 'tenant-1',
    patient_id: 'patient-1',
    status: 'rascunho',
    meta_kcal: null,
    orientacoes: null,
    published_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildMeal(overrides: Partial<MealRecord> = {}): MealRecord {
  return {
    id: 'meal-1',
    tenant_id: 'tenant-1',
    meal_plan_id: 'plan-1',
    nome: 'Café da manhã',
    horario: '07:30',
    created_at: new Date(),
    ...overrides,
  };
}

function buildFood(overrides: Partial<FoodRecord> = {}): FoodRecord {
  return {
    id: 'food-1',
    nome: 'Arroz branco cozido',
    kcal_100g: '128.00',
    proteina_100g: '2.50',
    carb_100g: '28.10',
    gordura_100g: '0.20',
    ...overrides,
  };
}

function buildPatient(overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    id: 'patient-1',
    tenant_id: 'tenant-1',
    nome: 'João Silva',
    email: 'joao@nutrihub.com',
    data_nascimento: '1990-05-20',
    contato: null,
    historico: null,
    status: 'ativo',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const VAZIO = { metaKcal: null, orientacoes: null };

describe('MealPlansService (RF-04)', () => {
  let repository: jest.Mocked<MealPlansRepository>;
  let foodsRepository: jest.Mocked<FoodsRepository>;
  let patientsRepository: jest.Mocked<PatientsRepository>;
  let service: MealPlansService;

  beforeEach(() => {
    repository = {
      createDraft: jest.fn(),
      listByPatient: jest.fn(),
      findById: jest.fn(),
      addMeal: jest.fn(),
      findMealById: jest.fn(),
      addItem: jest.fn(),
      getMealsWithItems: jest.fn(),
      countItems: jest.fn(),
      findActiveByPatient: jest.fn(),
      publish: jest.fn(),
      updateActiveDetails: jest.fn(),
    } as unknown as jest.Mocked<MealPlansRepository>;

    foodsRepository = {
      list: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<FoodsRepository>;

    patientsRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      inactivate: jest.fn(),
    } as unknown as jest.Mocked<PatientsRepository>;

    service = new MealPlansService(repository, foodsRepository, patientsRepository);
  });

  describe('createDraft', () => {
    it('cria o plano em rascunho quando o paciente existe', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      repository.createDraft.mockResolvedValue(buildPlan());

      const result = await service.createDraft('tenant-1', 'patient-1');

      expect(result.status).toBe('rascunho');
      expect(repository.createDraft).toHaveBeenCalledWith('tenant-1', 'patient-1');
    });

    it('lança PatientNotFoundError se o paciente não existe no tenant', async () => {
      patientsRepository.findById.mockResolvedValue(undefined);

      await expect(service.createDraft('tenant-1', 'inexistente')).rejects.toThrow(PatientNotFoundError);
      expect(repository.createDraft).not.toHaveBeenCalled();
    });
  });

  describe('addMeal', () => {
    it('adiciona refeição a um plano em rascunho', async () => {
      repository.findById.mockResolvedValue(buildPlan());
      repository.addMeal.mockResolvedValue(buildMeal());

      const result = await service.addMeal('tenant-1', 'plan-1', { nome: 'Café da manhã', horario: '07:30' });

      expect(result.nome).toBe('Café da manhã');
    });

    it('rejeita adicionar refeição a um plano que já foi publicado', async () => {
      repository.findById.mockResolvedValue(buildPlan({ status: 'ativo' }));

      await expect(
        service.addMeal('tenant-1', 'plan-1', { nome: 'Almoço', horario: '12:00' }),
      ).rejects.toThrow(InvalidMealPlanStateError);
    });

    it('lança MealPlanNotFoundError para plano inexistente', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(
        service.addMeal('tenant-1', 'inexistente', { nome: 'Almoço', horario: '12:00' }),
      ).rejects.toThrow(MealPlanNotFoundError);
    });
  });

  describe('addItem — cálculo de macronutrientes (RN-03)', () => {
    it('calcula kcal/proteína/carboidrato/gordura proporcionalmente à quantidade em gramas', async () => {
      repository.findById.mockResolvedValue(buildPlan());
      repository.findMealById.mockResolvedValue(buildMeal());
      foodsRepository.findById.mockResolvedValue(buildFood());
      repository.addItem.mockImplementation(async (_tenantId, _mealId, item) => ({
        id: 'item-1',
        tenant_id: 'tenant-1',
        meal_id: 'meal-1',
        food_id: item.foodId,
        quantidade_g: String(item.quantidadeG),
        kcal: String(item.kcal),
        proteina_g: String(item.proteinaG),
        carb_g: String(item.carbG),
        gordura_g: String(item.gorduraG),
        created_at: new Date(),
      }));

      // 150g de um alimento com 128 kcal/100g -> 192 kcal
      const result = await service.addItem('tenant-1', 'plan-1', 'meal-1', { foodId: 'food-1', quantidadeG: 150 });

      expect(result.kcal).toBe('192');
      expect(result.proteina_g).toBe('3.75');
      expect(result.carb_g).toBe('42.15');
      expect(result.gordura_g).toBe('0.3');
    });

    it('lança FoodNotFoundError (E-07) quando o alimento não está na base TACO', async () => {
      repository.findById.mockResolvedValue(buildPlan());
      repository.findMealById.mockResolvedValue(buildMeal());
      foodsRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.addItem('tenant-1', 'plan-1', 'meal-1', { foodId: 'inexistente', quantidadeG: 100 }),
      ).rejects.toThrow(FoodNotFoundError);
    });

    it('lança MealNotFoundError quando a refeição não pertence ao plano informado', async () => {
      repository.findById.mockResolvedValue(buildPlan());
      repository.findMealById.mockResolvedValue(buildMeal({ meal_plan_id: 'outro-plano' }));

      await expect(
        service.addItem('tenant-1', 'plan-1', 'meal-1', { foodId: 'food-1', quantidadeG: 100 }),
      ).rejects.toThrow(MealNotFoundError);
    });
  });

  describe('publish (RN-02, E-08)', () => {
    it('publica o plano quando há ao menos um item', async () => {
      repository.findById.mockResolvedValue(buildPlan());
      repository.countItems.mockResolvedValue(1);
      repository.publish.mockResolvedValue(buildPlan({ status: 'ativo' }));

      const result = await service.publish('tenant-1', 'plan-1', { metaKcal: 1800, orientacoes: 'Beba 2L de água.' });

      expect(result.status).toBe('ativo');
      expect(repository.publish).toHaveBeenCalledWith('tenant-1', 'plan-1', 'patient-1', {
        metaKcal: 1800,
        orientacoes: 'Beba 2L de água.',
      });
    });

    it('lança EmptyMealPlanError (E-08) ao publicar plano sem nenhum item', async () => {
      repository.findById.mockResolvedValue(buildPlan());
      repository.countItems.mockResolvedValue(0);

      await expect(service.publish('tenant-1', 'plan-1', VAZIO)).rejects.toThrow(EmptyMealPlanError);
      expect(repository.publish).not.toHaveBeenCalled();
    });

    it('rejeita publicar um plano que já não está em rascunho', async () => {
      repository.findById.mockResolvedValue(buildPlan({ status: 'encerrado' }));

      await expect(service.publish('tenant-1', 'plan-1', VAZIO)).rejects.toThrow(InvalidMealPlanStateError);
    });
  });

  describe('updateActive (issue #10)', () => {
    it('corrige as orientações de um plano ativo e devolve o plano completo', async () => {
      const publicadoEm = new Date('2026-09-01T10:00:00Z');
      repository.findById.mockResolvedValue(buildPlan({ status: 'ativo', published_at: publicadoEm }));
      repository.updateActiveDetails.mockResolvedValue(
        buildPlan({ status: 'ativo', orientacoes: 'Beba 2L de água.', published_at: publicadoEm }),
      );
      repository.getMealsWithItems.mockResolvedValue([]);

      const result = await service.updateActive('tenant-1', 'plan-1', { orientacoes: 'Beba 2L de água.' });

      expect(result.orientacoes).toBe('Beba 2L de água.');
      expect(result.published_at).toBe(publicadoEm);
      expect(result.totais).toEqual({ kcal: 0, proteina_g: 0, carb_g: 0, gordura_g: 0 });
      expect(repository.updateActiveDetails).toHaveBeenCalledWith('tenant-1', 'plan-1', {
        orientacoes: 'Beba 2L de água.',
      });
      // Corrigir texto não é republicar: nada de encerrar plano (RN-02).
      expect(repository.publish).not.toHaveBeenCalled();
    });

    it.each(['rascunho', 'encerrado'] as const)('rejeita corrigir plano com status %s', async (status) => {
      repository.findById.mockResolvedValue(buildPlan({ status }));

      await expect(service.updateActive('tenant-1', 'plan-1', { metaKcal: 1800 })).rejects.toThrow(
        InvalidMealPlanStateError,
      );
      expect(repository.updateActiveDetails).not.toHaveBeenCalled();
    });

    it('lança MealPlanNotFoundError para plano inexistente', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(service.updateActive('tenant-1', 'inexistente', { metaKcal: 1800 })).rejects.toThrow(
        MealPlanNotFoundError,
      );
    });

    it('lança InvalidMealPlanStateError se o plano foi encerrado entre a leitura e o update', async () => {
      repository.findById.mockResolvedValue(buildPlan({ status: 'ativo' }));
      repository.updateActiveDetails.mockResolvedValue(undefined);

      await expect(service.updateActive('tenant-1', 'plan-1', { metaKcal: 1800 })).rejects.toThrow(
        InvalidMealPlanStateError,
      );
    });
  });

  describe('getActiveForPatient (RF-05)', () => {
    it('devolve o plano ativo do paciente com metas e orientações', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      repository.findActiveByPatient.mockResolvedValue(
        buildPlan({ status: 'ativo', meta_kcal: '1800.00', orientacoes: 'Evite frituras.' }),
      );
      repository.getMealsWithItems.mockResolvedValue([]);

      const result = await service.getActiveForPatient('tenant-1', 'patient-1');

      expect(result.status).toBe('ativo');
      expect(result.meta_kcal).toBe('1800.00');
      expect(result.orientacoes).toBe('Evite frituras.');
      expect(repository.findActiveByPatient).toHaveBeenCalledWith('tenant-1', 'patient-1');
    });

    it('lança NoActiveMealPlanError quando nenhum plano foi publicado ainda', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      repository.findActiveByPatient.mockResolvedValue(undefined);

      await expect(service.getActiveForPatient('tenant-1', 'patient-1')).rejects.toThrow(NoActiveMealPlanError);
    });

    it('lança PatientNotFoundError para paciente fora do tenant', async () => {
      patientsRepository.findById.mockResolvedValue(undefined);

      await expect(service.getActiveForPatient('tenant-1', 'de-outro-tenant')).rejects.toThrow(PatientNotFoundError);
      expect(repository.findActiveByPatient).not.toHaveBeenCalled();
    });

    // A meta é do nutricionista; os totais vêm dos itens. A tela compara os dois,
    // então o serviço não pode derivar um do outro.
    it('mantém a meta separada da soma dos itens', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      repository.findActiveByPatient.mockResolvedValue(buildPlan({ status: 'ativo', meta_kcal: '1800.00' }));
      repository.getMealsWithItems.mockResolvedValue([
        {
          ...buildMeal(),
          items: [
            {
              id: 'item-1',
              tenant_id: 'tenant-1',
              meal_id: 'meal-1',
              food_id: 'food-1',
              quantidade_g: '150',
              kcal: '192',
              proteina_g: '3.75',
              carb_g: '42.15',
              gordura_g: '0.3',
              created_at: new Date(),
              food_nome: 'Arroz branco cozido',
            },
          ],
        },
      ]);

      const result = await service.getActiveForPatient('tenant-1', 'patient-1');

      expect(result.meta_kcal).toBe('1800.00');
      expect(result.totais.kcal).toBe(192);
    });
  });

  describe('getById', () => {
    it('agrega os totais de macronutrientes a partir dos itens já persistidos', async () => {
      repository.findById.mockResolvedValue(buildPlan());
      repository.getMealsWithItems.mockResolvedValue([
        {
          ...buildMeal(),
          items: [
            {
              id: 'item-1',
              tenant_id: 'tenant-1',
              meal_id: 'meal-1',
              food_id: 'food-1',
              quantidade_g: '150.00',
              kcal: '192.00',
              proteina_g: '3.75',
              carb_g: '42.15',
              gordura_g: '0.30',
              created_at: new Date(),
              food_nome: 'Arroz branco cozido',
            },
          ],
        },
      ]);

      const result = await service.getById('tenant-1', 'plan-1');

      expect(result.totais).toEqual({ kcal: 192, proteina_g: 3.75, carb_g: 42.15, gordura_g: 0.3 });
    });

    it('lança MealPlanNotFoundError para plano inexistente', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(service.getById('tenant-1', 'inexistente')).rejects.toThrow(MealPlanNotFoundError);
    });
  });
});
