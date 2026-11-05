import type { PesquisaNps, ResumoNps } from '../tipos';

export function pesquisaAberta(sobrescritas: Partial<PesquisaNps> = {}): PesquisaNps {
  return {
    id: 'nps-1',
    patient_id: 'patient-1',
    meal_plan_id: 'plan-0',
    nota: null,
    comentario: null,
    enviada_em: '2026-09-30T12:00:00.000Z',
    respondida_em: null,
    ...sobrescritas,
  };
}

/** 4 respostas: 2 promotores, 1 neutro, 1 detrator → NPS +25. */
export function resumoNps(sobrescritas: Partial<ResumoNps> = {}): ResumoNps {
  return {
    enviadas: 5,
    respostas: 4,
    promotores: 2,
    neutros: 1,
    detratores: 1,
    nps: 25,
    taxaResposta: 0.8,
    recentes: [
      {
        id: 'r1',
        patient_id: 'patient-1',
        patient_nome: 'João Silva',
        nota: 10,
        comentario: 'Plano fácil de seguir.',
        respondida_em: '2026-09-30T12:00:00.000Z',
      },
      {
        id: 'r2',
        patient_id: 'patient-2',
        patient_nome: 'Maria Souza',
        nota: 4,
        comentario: null,
        respondida_em: '2026-09-29T12:00:00.000Z',
      },
    ],
    ...sobrescritas,
  };
}

export const RESUMO_VAZIO: ResumoNps = {
  enviadas: 0,
  respostas: 0,
  promotores: 0,
  neutros: 0,
  detratores: 0,
  nps: null,
  taxaResposta: null,
  recentes: [],
};
