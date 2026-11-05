/** Espelha NpsPesquisaRecord (backend, nps.repository). */
export interface PesquisaNps {
  id: string;
  patient_id: string;
  meal_plan_id: string | null;
  nota: number | null;
  comentario: string | null;
  enviada_em: string;
  respondida_em: string | null;
}

/** Uma resposta no consolidado do consultório. */
export interface RespostaNps {
  id: string;
  patient_id: string;
  patient_nome: string;
  nota: number;
  comentario: string | null;
  respondida_em: string;
}

/** GET /api/nps (RF-09). */
export interface ResumoNps {
  enviadas: number;
  respostas: number;
  promotores: number;
  neutros: number;
  detratores: number;
  /** De -100 a 100; nulo enquanto não houver resposta. */
  nps: number | null;
  /** De 0 a 1; nulo enquanto nenhuma pesquisa tiver sido enviada. */
  taxaResposta: number | null;
  recentes: RespostaNps[];
}
