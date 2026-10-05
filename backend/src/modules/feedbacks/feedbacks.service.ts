import { FeedbacksRepository } from './feedbacks.repository';
import { MealPlansRepository } from '../meal-plans/mealPlans.repository';
import { PatientsRepository } from '../patients/patients.repository';
import { CreateFeedbackInput, ListFeedbacksQuery, ResolveFeedbackInput } from './feedbacks.validation';
import {
  FeedbackAlreadyResolvedError,
  FeedbackNotFoundError,
  MealNotFoundError,
  NoActiveMealPlanError,
  PatientNotFoundError,
} from '../../shared/errors/AppError';

export class FeedbacksService {
  constructor(
    private readonly repository: FeedbacksRepository = new FeedbacksRepository(),
    private readonly mealPlansRepository: MealPlansRepository = new MealPlansRepository(),
    private readonly patientsRepository: PatientsRepository = new PatientsRepository(),
  ) {}

  /**
   * RF-06, fluxo 3.5 passo 3: o feedback nasce 'pendente' e preso ao plano
   * vigente — é sobre ele que o nutricionista vai agir. A refeição, quando
   * vem, precisa ser desse mesmo plano.
   *
   * O aviso ao nutricionista (passo 4) entra com o módulo de notificações.
   */
  async create(tenantId: string, patientId: string, input: CreateFeedbackInput) {
    const plan = await this.mealPlansRepository.findActiveByPatient(tenantId, patientId);
    if (!plan) {
      throw new NoActiveMealPlanError();
    }

    if (input.mealId) {
      const meal = await this.mealPlansRepository.findMealById(tenantId, input.mealId);
      if (!meal || meal.meal_plan_id !== plan.id) {
        throw new MealNotFoundError();
      }
    }

    return this.repository.create(tenantId, {
      patientId,
      mealPlanId: plan.id,
      mealId: input.mealId,
      descricao: input.descricao,
    });
  }

  async listByPatient(tenantId: string, patientId: string) {
    const patient = await this.patientsRepository.findById(tenantId, patientId);
    if (!patient) {
      throw new PatientNotFoundError();
    }
    return this.repository.listByPatient(tenantId, patientId);
  }

  async listForTenant(tenantId: string, query: ListFeedbacksQuery) {
    return this.repository.listForTenant(tenantId, query.status);
  }

  // Fluxo 3.5 passo 6. O aviso ao paciente também entra com as notificações.
  async resolve(tenantId: string, id: string, input: ResolveFeedbackInput) {
    const resolved = await this.repository.resolve(tenantId, id, input.resposta);
    if (resolved) return resolved;

    // O UPDATE não alcançou a linha: ou ela não existe (ou é de outro tenant,
    // o que o RLS faz parecer igual), ou já estava resolvida.
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new FeedbackNotFoundError();
    }
    throw new FeedbackAlreadyResolvedError();
  }
}
