import { chamarApi } from '@/lib/api';
import type { Feedback, FeedbackDoConsultorio, StatusDoFeedback } from './tipos';

/** RF-06, fluxo 3.5 passos 2-3: só o próprio paciente registra. */
export function enviarFeedback(patientId: string, dados: { descricao: string; meal_id?: string }): Promise<Feedback> {
  return chamarApi<Feedback>(`/patients/${patientId}/feedbacks`, { metodo: 'POST', corpo: dados });
}

/** Histórico de um paciente, do mais recente ao mais antigo — serve aos dois papéis. */
export function listarFeedbacksDoPaciente(patientId: string, sinal?: AbortSignal): Promise<Feedback[]> {
  return chamarApi<Feedback[]>(`/patients/${patientId}/feedbacks`, { sinal });
}

/** Caixa de entrada do nutricionista: pendentes primeiro, depois os mais recentes. */
export function listarFeedbacksDoConsultorio(
  status?: StatusDoFeedback,
  sinal?: AbortSignal,
): Promise<FeedbackDoConsultorio[]> {
  return chamarApi<FeedbackDoConsultorio[]>(status ? `/feedbacks?status=${status}` : '/feedbacks', { sinal });
}

/** Fluxo 3.5 passo 6. A resposta é opcional; vazia, o backend grava sem texto. */
export function resolverFeedback(id: string, resposta: string): Promise<Feedback> {
  return chamarApi<Feedback>(`/feedbacks/${id}/resolve`, { metodo: 'POST', corpo: { resposta } });
}

/**
 * Os tipos do mockup "Reportar problema". O backend guarda só a descrição, então
 * o tipo escolhido vira o começo do texto ("Alergia: …") — é assim que ele chega
 * ao nutricionista na caixa de entrada, no e-mail e no WhatsApp.
 */
export const TIPOS_DE_PROBLEMA = ['Alergia', 'Falta de ingrediente', 'Não gostei', 'Outro'] as const;
export type TipoDeProblema = (typeof TIPOS_DE_PROBLEMA)[number];

export function montarDescricao(tipo: TipoDeProblema, texto: string): string {
  const relato = texto.trim();
  return tipo === 'Outro' ? relato : `${tipo}: ${relato}`;
}
