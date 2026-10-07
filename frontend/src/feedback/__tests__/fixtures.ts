import type { PlanoAtivo } from '@/plano/tipos';
import type { Feedback, FeedbackDoConsultorio } from '../tipos';

export function feedback(sobrescritas: Partial<Feedback> = {}): Feedback {
  return {
    id: 'fb-1',
    patient_id: 'patient-1',
    meal_plan_id: 'plan-1',
    meal_id: 'meal-1',
    meal_nome: 'Café da manhã',
    descricao: 'Alergia: sou alérgico a aveia.',
    status: 'pendente',
    resposta: null,
    resolvido_em: null,
    created_at: '2026-09-30T17:30:00.000Z',
    updated_at: '2026-09-30T17:30:00.000Z',
    ...sobrescritas,
  };
}

export function doConsultorio(sobrescritas: Partial<FeedbackDoConsultorio> = {}): FeedbackDoConsultorio {
  return { ...feedback(), patient_nome: 'João Silva', ...sobrescritas };
}

/** Plano ativo com duas refeições, para o seletor de "Reportar problema". */
export function planoAtivo(): PlanoAtivo {
  const refeicao = (id: string, nome: string, horario: string) => ({ id, nome, horario, items: [] });
  return {
    id: 'plan-1',
    patient_id: 'patient-1',
    status: 'ativo',
    meta_kcal: null,
    orientacoes: null,
    published_at: '2026-09-10T12:00:00.000Z',
    meals: [refeicao('meal-1', 'Café da manhã', '07:00:00'), refeicao('meal-2', 'Almoço', '12:00:00')],
    totais: { kcal: 0, proteina_g: 0, carb_g: 0, gordura_g: 0 },
  };
}
