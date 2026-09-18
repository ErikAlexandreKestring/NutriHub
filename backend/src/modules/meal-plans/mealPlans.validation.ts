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

// RF-04: adicionar um alimento da base TACO a uma refeição, com quantidade em gramas.
export interface AddMealItemInput {
  foodId: string;
  quantidadeG: number;
}

export const addMealItemSchema = {
  parse(body: unknown): AddMealItemInput {
    const data = asRecord(body);
    const validator = new Validator();

    const foodId = asTrimmedString(data.food_id);
    if (foodId.length === 0) {
      validator.fail('food_id', 'food_id é obrigatório');
    }

    const quantidadeG = typeof data.quantidade_g === 'number' ? data.quantidade_g : Number(data.quantidade_g);
    if (!Number.isFinite(quantidadeG) || quantidadeG <= 0 || quantidadeG > 5000) {
      validator.fail('quantidade_g', 'Quantidade em gramas deve ser um número entre 1 e 5000');
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

export const publishMealPlanSchema = {
  parse(body: unknown): PublishMealPlanInput {
    const data = asRecord(body);
    const validator = new Validator();

    let metaKcal: number | null = null;
    if (data.meta_kcal !== undefined && data.meta_kcal !== null && data.meta_kcal !== '') {
      const valor = typeof data.meta_kcal === 'number' ? data.meta_kcal : Number(data.meta_kcal);
      // O teto acompanha o decimal(7,2) da coluna; o piso descarta meta
      // fisiologicamente impossível digitada por engano.
      if (!Number.isFinite(valor) || valor < 500 || valor > 10000) {
        validator.fail('meta_kcal', 'Meta calórica deve ser um número entre 500 e 10000');
      } else {
        metaKcal = Math.round(valor * 100) / 100;
      }
    }

    const texto = asTrimmedString(data.orientacoes);
    if (texto.length > 2000) {
      validator.fail('orientacoes', 'Orientações devem ter no máximo 2000 caracteres');
    }

    validator.throwIfInvalid();

    return { metaKcal, orientacoes: texto.length > 0 ? texto : null };
  },
};
