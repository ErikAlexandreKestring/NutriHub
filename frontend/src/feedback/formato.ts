import { formatarData, formatarHora } from '@/lib/formato';
import type { Feedback } from './tipos';

/** "06/10/2026 às 14:30" — curto o bastante para caber ao lado do nome no celular. */
export function quandoFoiEnviado(feedback: Feedback): string {
  return `${formatarData(feedback.created_at)} às ${formatarHora(feedback.created_at)}`;
}

/** Onde foi a dificuldade: a refeição do relato ou o plano como um todo. */
export function ondeFoi(feedback: Feedback): string {
  return feedback.meal_nome ?? 'Plano em geral';
}
