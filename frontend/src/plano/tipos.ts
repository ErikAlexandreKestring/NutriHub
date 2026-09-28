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
  /** Base dos macros. Com medida caseira, é quantidade_medida × medida_g. */
  quantidade_g: string;
  /** Medida caseira usada na prescrição (ex.: "unidade"); nulas quando foi em gramas. */
  medida_nome: string | null;
  medida_g: string | null;
  quantidade_medida: string | null;
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

export type StatusDoPlano = 'rascunho' | 'ativo' | 'encerrado';

/**
 * Plano com refeições, itens e totais — GET /api/meal-plans/:id (nutricionista)
 * e GET /api/patients/:patientId/meal-plans/ativo (os dois papéis).
 */
export interface PlanoAlimentar {
  id: string;
  patient_id: string;
  status: StatusDoPlano;
  meta_kcal: string | null;
  orientacoes: string | null;
  published_at: string | null;
  meals: Refeicao[];
  totais: Totais;
}

export interface PlanoAtivo extends PlanoAlimentar {
  status: 'ativo';
}

/** Linha de GET /api/patients/:patientId/meal-plans — sem refeições. */
export interface ResumoDoPlano {
  id: string;
  patient_id: string;
  status: StatusDoPlano;
  meta_kcal: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Medida caseira de um alimento (POF/IBGE): 1 `nome` = `gramas` g. */
export interface MedidaCaseira {
  id: string;
  nome: string;
  gramas: string;
}

/** Alimento da Tabela TACO (GET /api/foods). Valores por 100 g. */
export interface Alimento {
  id: string;
  nome: string;
  categoria: string | null;
  /** Vazio quando não há medida caseira confiável: o alimento só vai em gramas. */
  medidas: MedidaCaseira[];
  kcal_100g: string;
  proteina_100g: string;
  carb_100g: string;
  gordura_100g: string;
}
