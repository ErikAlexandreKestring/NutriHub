import { FeedbacksService } from '../../src/modules/feedbacks/feedbacks.service';
import { FeedbackRecord, FeedbacksRepository } from '../../src/modules/feedbacks/feedbacks.repository';
import {
  MealPlanRecord,
  MealPlansRepository,
  MealRecord,
} from '../../src/modules/meal-plans/mealPlans.repository';
import { PatientRecord, PatientsRepository } from '../../src/modules/patients/patients.repository';
import {
  FeedbackAlreadyResolvedError,
  FeedbackNotFoundError,
  MealNotFoundError,
  NoActiveMealPlanError,
  PatientNotFoundError,
} from '../../src/shared/errors/AppError';

function buildPlan(overrides: Partial<MealPlanRecord> = {}): MealPlanRecord {
  return {
    id: 'plan-1',
    tenant_id: 'tenant-1',
    patient_id: 'patient-1',
    status: 'ativo',
    meta_kcal: null,
    orientacoes: null,
    published_at: new Date(),
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
    horario: '07:00',
    created_at: new Date(),
    ...overrides,
  };
}

function buildFeedback(overrides: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    id: 'feedback-1',
    tenant_id: 'tenant-1',
    patient_id: 'patient-1',
    meal_plan_id: 'plan-1',
    meal_id: null,
    descricao: 'Não encontrei aveia no mercado',
    status: 'pendente',
    resposta: null,
    resolvido_em: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('FeedbacksService (RF-06)', () => {
  let repository: jest.Mocked<FeedbacksRepository>;
  let mealPlansRepository: jest.Mocked<MealPlansRepository>;
  let patientsRepository: jest.Mocked<PatientsRepository>;
  let service: FeedbacksService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      listForTenant: jest.fn(),
      listByPatient: jest.fn(),
      resolve: jest.fn(),
    } as unknown as jest.Mocked<FeedbacksRepository>;

    mealPlansRepository = {
      findActiveByPatient: jest.fn(),
      findMealById: jest.fn(),
    } as unknown as jest.Mocked<MealPlansRepository>;

    patientsRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<PatientsRepository>;

    service = new FeedbacksService(repository, mealPlansRepository, patientsRepository);
  });

  describe('create (fluxo 3.5, passos 2 e 3)', () => {
    it('cria o feedback preso ao plano ativo do paciente', async () => {
      mealPlansRepository.findActiveByPatient.mockResolvedValue(buildPlan());
      const created = buildFeedback();
      repository.create.mockResolvedValue(created);

      const result = await service.create('tenant-1', 'patient-1', { descricao: 'Não encontrei aveia no mercado' });

      expect(result).toBe(created);
      expect(mealPlansRepository.findActiveByPatient).toHaveBeenCalledWith('tenant-1', 'patient-1');
      expect(repository.create).toHaveBeenCalledWith('tenant-1', {
        patientId: 'patient-1',
        mealPlanId: 'plan-1',
        mealId: undefined,
        descricao: 'Não encontrei aveia no mercado',
      });
    });

    it('aceita a refeição quando ela é do plano ativo', async () => {
      mealPlansRepository.findActiveByPatient.mockResolvedValue(buildPlan());
      mealPlansRepository.findMealById.mockResolvedValue(buildMeal());
      repository.create.mockResolvedValue(buildFeedback({ meal_id: 'meal-1' }));

      await service.create('tenant-1', 'patient-1', { descricao: 'Tenho alergia a amendoim', mealId: 'meal-1' });

      expect(repository.create).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ mealId: 'meal-1' }));
    });

    it('recusa quando o paciente não tem plano ativo', async () => {
      mealPlansRepository.findActiveByPatient.mockResolvedValue(undefined);

      await expect(
        service.create('tenant-1', 'patient-1', { descricao: 'Não encontrei aveia no mercado' }),
      ).rejects.toBeInstanceOf(NoActiveMealPlanError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('recusa refeição que não existe', async () => {
      mealPlansRepository.findActiveByPatient.mockResolvedValue(buildPlan());
      mealPlansRepository.findMealById.mockResolvedValue(undefined);

      await expect(
        service.create('tenant-1', 'patient-1', { descricao: 'Tenho alergia a amendoim', mealId: 'meal-x' }),
      ).rejects.toBeInstanceOf(MealNotFoundError);
    });

    it('recusa refeição de outro plano, mesmo que seja do mesmo consultório', async () => {
      mealPlansRepository.findActiveByPatient.mockResolvedValue(buildPlan());
      mealPlansRepository.findMealById.mockResolvedValue(buildMeal({ meal_plan_id: 'plan-de-outro-paciente' }));

      await expect(
        service.create('tenant-1', 'patient-1', { descricao: 'Tenho alergia a amendoim', mealId: 'meal-1' }),
      ).rejects.toBeInstanceOf(MealNotFoundError);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('listByPatient', () => {
    it('lista o histórico do paciente', async () => {
      patientsRepository.findById.mockResolvedValue({ id: 'patient-1' } as PatientRecord);
      repository.listByPatient.mockResolvedValue([]);

      await expect(service.listByPatient('tenant-1', 'patient-1')).resolves.toEqual([]);
      expect(repository.listByPatient).toHaveBeenCalledWith('tenant-1', 'patient-1');
    });

    it('responde 404 para paciente fora do tenant', async () => {
      patientsRepository.findById.mockResolvedValue(undefined);

      await expect(service.listByPatient('tenant-1', 'patient-x')).rejects.toBeInstanceOf(PatientNotFoundError);
      expect(repository.listByPatient).not.toHaveBeenCalled();
    });
  });

  describe('listForTenant', () => {
    it('repassa o filtro de status', async () => {
      repository.listForTenant.mockResolvedValue([]);

      await service.listForTenant('tenant-1', { status: 'pendente' });

      expect(repository.listForTenant).toHaveBeenCalledWith('tenant-1', 'pendente');
    });
  });

  describe('resolve (fluxo 3.5, passo 6)', () => {
    it('marca o feedback como resolvido com a resposta', async () => {
      const resolved = buildFeedback({ status: 'resolvido', resposta: 'Troque por farelo de aveia' });
      repository.resolve.mockResolvedValue(resolved);

      const result = await service.resolve('tenant-1', 'feedback-1', { resposta: 'Troque por farelo de aveia' });

      expect(result).toBe(resolved);
      expect(repository.resolve).toHaveBeenCalledWith('tenant-1', 'feedback-1', 'Troque por farelo de aveia');
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('responde 404 quando o feedback não existe no tenant', async () => {
      repository.resolve.mockResolvedValue(undefined);
      repository.findById.mockResolvedValue(undefined);

      await expect(service.resolve('tenant-1', 'feedback-x', {})).rejects.toBeInstanceOf(FeedbackNotFoundError);
    });

    it('responde 409 quando o feedback já estava resolvido', async () => {
      repository.resolve.mockResolvedValue(undefined);
      repository.findById.mockResolvedValue(buildFeedback({ status: 'resolvido' }));

      await expect(service.resolve('tenant-1', 'feedback-1', {})).rejects.toBeInstanceOf(
        FeedbackAlreadyResolvedError,
      );
    });
  });
});
