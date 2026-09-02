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
