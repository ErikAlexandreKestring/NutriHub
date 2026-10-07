export type StatusDoFeedback = 'pendente' | 'resolvido';

/**
 * Espelha o FeedbackWithMeal de /api/patients/:patientId/feedbacks
 * (feedbacks.repository): o feedback com o nome da refeição, quando houver.
 */
export interface Feedback {
  id: string;
  patient_id: string;
  meal_plan_id: string;
  meal_id: string | null;
  /** Nulo quando o relato é sobre o plano em geral ou a refeição saiu do plano. */
  meal_nome: string | null;
  descricao: string;
  status: StatusDoFeedback;
  resposta: string | null;
  resolvido_em: string | null;
  /**
   * E-17: o alerta por e-mail ao nutricionista esgotou as tentativas. Opcional
   * porque só existe com o módulo de notificações no backend.
   */
  notificacao_falhou?: boolean;
  created_at: string;
  updated_at: string;
}

/** Linha de GET /api/feedbacks: a caixa de entrada do consultório. */
export interface FeedbackDoConsultorio extends Feedback {
  patient_nome: string;
}
