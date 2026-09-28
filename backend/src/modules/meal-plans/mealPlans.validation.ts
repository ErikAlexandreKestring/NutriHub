import { asRecord, asTrimmedString, Validator } from '../../shared/validation/validator';

// RF-04: adicionar refeição a um plano em rascunho (ex.: "Café da manhã", 07:30).
export interface AddMealInput {
  nome: string;
  horario: string;
}

const HORARIO_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const addMealSchema = {
  parse(body: unknown): AddMealInput {
    const data = asRecord(body);
    const validator = new Validator();

    const nome = asTrimmedString(data.nome);
    if (nome.length < 2 || nome.length > 60) {
      validator.fail('nome', 'Nome da refeição deve ter entre 2 e 60 caracteres');
    }

    const horario = asTrimmedString(data.horario);
    if (!HORARIO_REGEX.test(horario)) {
      validator.fail('horario', 'Horário inválido, use o formato HH:MM');
    }

    validator.throwIfInvalid();

    return { nome, horario };
  },
};

// RF-04: um alimento da base TACO numa refeição. A quantidade vem em gramas
// (`quantidade_g`) ou numa medida caseira do alimento (`medida_id` +
// `quantidade`, ex.: 2 unidades) — nesse caso o serviço converte para gramas
// com a gramatura do catálogo antes de calcular os macros.
export type MealItemInput =
  | { foodId: string; quantidadeG: number; medidaId?: undefined }
  | { foodId: string; medidaId: string; quantidade: number };

/** Mesmo teto de antes para gramas; em medidas, meia unidade já é uma prescrição real. */
const MAXIMO_DE_GRAMAS = 5000;
const MAXIMO_DE_MEDIDAS = 50;

function parseNumero(valor: unknown): number {
  return typeof valor === 'number' ? valor : Number(valor);
}

export const mealItemSchema = {
  parse(body: unknown): MealItemInput {
    const data = asRecord(body);
    const validator = new Validator();

    const foodId = asTrimmedString(data.food_id);
    if (foodId.length === 0) {
      validator.fail('food_id', 'food_id é obrigatório');
    }

    const medidaId = asTrimmedString(data.medida_id);
    if (medidaId.length > 0) {
      const quantidade = parseNumero(data.quantidade);
      if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > MAXIMO_DE_MEDIDAS) {
        validator.fail('quantidade', `Quantidade deve ser um número entre 0,5 e ${MAXIMO_DE_MEDIDAS}`);
      }
      validator.throwIfInvalid();
      return { foodId, medidaId, quantidade };
    }

    const quantidadeG = parseNumero(data.quantidade_g);
    if (!Number.isFinite(quantidadeG) || quantidadeG <= 0 || quantidadeG > MAXIMO_DE_GRAMAS) {
      validator.fail('quantidade_g', `Quantidade em gramas deve ser um número entre 1 e ${MAXIMO_DE_GRAMAS}`);
    }

    validator.throwIfInvalid();

    return { foodId, quantidadeG };
  },
};

// RF-05: dados que o nutricionista define no momento da publicação e que o
// paciente vê na tela do plano. Ambos são opcionais — um plano pode ser
// publicado sem meta numérica e sem texto de orientação.
export interface PublishMealPlanInput {
  metaKcal: number | null;
  orientacoes: string | null;
}

// Regras de cada campo ficam fora dos schemas porque valem igual na publicação
// e na correção de um plano já ativo — a faixa aceita não muda de uma rota para
// a outra.
function parseMetaKcal(valorBruto: unknown, validator: Validator): number | null {
  if (valorBruto === undefined || valorBruto === null || valorBruto === '') {
    return null;
  }

  const valor = typeof valorBruto === 'number' ? valorBruto : Number(valorBruto);
  // O teto acompanha o decimal(7,2) da coluna; o piso descarta meta
  // fisiologicamente impossível digitada por engano.
  if (!Number.isFinite(valor) || valor < 500 || valor > 10000) {
    validator.fail('meta_kcal', 'Meta calórica deve ser um número entre 500 e 10000');
    return null;
  }
  return Math.round(valor * 100) / 100;
}

function parseOrientacoes(valorBruto: unknown, validator: Validator): string | null {
  const texto = asTrimmedString(valorBruto);
  if (texto.length > 2000) {
    validator.fail('orientacoes', 'Orientações devem ter no máximo 2000 caracteres');
  }
  return texto.length > 0 ? texto : null;
}

export const publishMealPlanSchema = {
  parse(body: unknown): PublishMealPlanInput {
    const data = asRecord(body);
    const validator = new Validator();

    const metaKcal = parseMetaKcal(data.meta_kcal, validator);
    const orientacoes = parseOrientacoes(data.orientacoes, validator);

    validator.throwIfInvalid();

    return { metaKcal, orientacoes };
  },
};

// Correção de meta/orientações de um plano já ativo. Diferente da publicação,
// campo ausente significa "não mexer": corrigir um typo nas orientações não pode
// apagar a meta só porque ela não veio no corpo. Para limpar um campo, envie
// `null` (ou string vazia) explicitamente.
export type UpdateActiveMealPlanInput = Partial<PublishMealPlanInput>;

export const updateActiveMealPlanSchema = {
  parse(body: unknown): UpdateActiveMealPlanInput {
    const data = asRecord(body);
    const validator = new Validator();
    const result: UpdateActiveMealPlanInput = {};

    if (data.meta_kcal !== undefined) {
      result.metaKcal = parseMetaKcal(data.meta_kcal, validator);
    }

    if (data.orientacoes !== undefined) {
      result.orientacoes = parseOrientacoes(data.orientacoes, validator);
    }

    if (Object.keys(result).length === 0) {
      validator.fail('body', 'Envie meta_kcal e/ou orientacoes para atualizar');
    }

    validator.throwIfInvalid();

    return result;
  },
};
