import { withTenant } from '../../db/connection';
import { FeedbackStatus } from './feedbacks.validation';

export interface FeedbackRecord {
  id: string;
  tenant_id: string;
  patient_id: string;
  meal_plan_id: string;
  meal_id: string | null;
  descricao: string;
  status: FeedbackStatus;
  resposta: string | null;
  resolvido_em: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Com o nome da refeição, para a tela mostrar onde foi a dificuldade. */
export interface FeedbackWithMeal extends FeedbackRecord {
  meal_nome: string | null;
}

/** Visão do nutricionista: o feedback de qualquer paciente do consultório. */
export interface FeedbackWithPatient extends FeedbackWithMeal {
  patient_nome: string;
}

export interface CreateFeedbackValues {
  patientId: string;
  mealPlanId: string;
  mealId?: string;
  descricao: string;
}

export class FeedbacksRepository {
  async create(tenantId: string, values: CreateFeedbackValues): Promise<FeedbackRecord> {
    return withTenant(tenantId, async (trx) => {
      const [feedback] = await trx('feedbacks')
        .insert({
          tenant_id: tenantId,
          patient_id: values.patientId,
          meal_plan_id: values.mealPlanId,
          meal_id: values.mealId ?? null,
          descricao: values.descricao,
        })
        .returning('*');
      return feedback;
    });
  }

  async findById(tenantId: string, id: string): Promise<FeedbackRecord | undefined> {
    return withTenant(tenantId, (trx) => trx('feedbacks').where({ id }).first());
  }

  // Pendentes primeiro: é o que o nutricionista precisa tratar (fluxo 3.5, passo 5).
  async listForTenant(tenantId: string, status?: FeedbackStatus): Promise<FeedbackWithPatient[]> {
    return withTenant(tenantId, (trx) => {
      const query = trx('feedbacks')
        .join('patients', 'patients.id', 'feedbacks.patient_id')
        .leftJoin('meals', 'meals.id', 'feedbacks.meal_id')
        .select('feedbacks.*', 'patients.nome as patient_nome', 'meals.nome as meal_nome')
        .orderByRaw("feedbacks.status = 'pendente' DESC")
        .orderBy('feedbacks.created_at', 'desc');

      if (status) query.where('feedbacks.status', status);
      return query;
    });
  }

  async listByPatient(tenantId: string, patientId: string): Promise<FeedbackWithMeal[]> {
    return withTenant(tenantId, (trx) =>
      trx('feedbacks')
        .leftJoin('meals', 'meals.id', 'feedbacks.meal_id')
        .where('feedbacks.patient_id', patientId)
        .select('feedbacks.*', 'meals.nome as meal_nome')
        .orderBy('feedbacks.created_at', 'desc'),
    );
  }

  /**
   * A condição `status = 'pendente'` vai no próprio UPDATE: duas resoluções
   * concorrentes não sobrescrevem a resposta uma da outra — a segunda não
   * alcança linha nenhuma e devolve undefined.
   */
  async resolve(tenantId: string, id: string, resposta?: string): Promise<FeedbackRecord | undefined> {
    return withTenant(tenantId, async (trx) => {
      const [feedback] = await trx('feedbacks')
        .where({ id, status: 'pendente' })
        .update({
          status: 'resolvido',
          resposta: resposta ?? null,
          resolvido_em: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
        .returning('*');
      return feedback;
    });
  }
}
