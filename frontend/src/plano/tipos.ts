/**
 * Espelha o retorno de GET /api/patients/:patientId/meal-plans/ativo
 * (mealPlans.service.getActiveForPatient).
 *
 * Os campos numéricos chegam como string porque são colunas `decimal` do
 * Postgres e o driver não as converte para number — perderia precisão. A
 * conversão fica no ponto de exibição, nunca no tipo.
 */
export interface ItemDaRefeicao {
  id: string;
  food_id: string;
  food_nome: string;
  quantidade_g: string;
  kcal: string;
  proteina_g: string;
  carb_g: string;
  gordura_g: string;
}

export interface Refeicao {
  id: string;
  nome: string;
  /** `time` do Postgres, no formato HH:MM:SS. */
  horario: string;
  items: ItemDaRefeicao[];
}

export interface Totais {
  kcal: number;
  proteina_g: number;
  carb_g: number;
  gordura_g: number;
}

export interface PlanoAtivo {
  id: string;
  patient_id: string;
  status: 'ativo';
  meta_kcal: string | null;
  orientacoes: string | null;
  published_at: string | null;
  meals: Refeicao[];
  totais: Totais;
}
