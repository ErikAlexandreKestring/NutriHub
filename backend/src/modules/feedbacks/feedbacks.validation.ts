import { asRecord, asTrimmedString, Validator } from '../../shared/validation/validator';

export type FeedbackStatus = 'pendente' | 'resolvido';

const FEEDBACK_STATUSES: FeedbackStatus[] = ['pendente', 'resolvido'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXTO = 1000;

// RF-06, fluxo 3.5 passo 2: o paciente descreve a dificuldade e, se veio de
// uma refeição, ela vai junto.
export interface CreateFeedbackInput {
  descricao: string;
  mealId?: string;
}

export const createFeedbackSchema = {
  parse(body: unknown): CreateFeedbackInput {
    const data = asRecord(body);
    const validator = new Validator();

    const descricao = asTrimmedString(data.descricao);
    if (descricao.length < 10 || descricao.length > MAX_TEXTO) {
      validator.fail('descricao', `Descreva a dificuldade em 10 a ${MAX_TEXTO} caracteres`);
    }

    let mealId: string | undefined;
    if (data.meal_id !== undefined && data.meal_id !== null) {
      mealId = asTrimmedString(data.meal_id);
      if (!UUID.test(mealId)) {
        validator.fail('meal_id', 'Refeição inválida');
      }
    }

    validator.throwIfInvalid();

    return { descricao, mealId };
  },
};

// Fluxo 3.5 passo 6: a resposta é opcional, mas é o que o paciente lê quando o
// feedback é resolvido.
export interface ResolveFeedbackInput {
  resposta?: string;
}

export const resolveFeedbackSchema = {
  parse(body: unknown): ResolveFeedbackInput {
    const data = asRecord(body);
    const validator = new Validator();

    const resposta = asTrimmedString(data.resposta);
    if (resposta.length > MAX_TEXTO) {
      validator.fail('resposta', `A resposta deve ter no máximo ${MAX_TEXTO} caracteres`);
    }

    validator.throwIfInvalid();

    return { resposta: resposta.length > 0 ? resposta : undefined };
  },
};

export interface ListFeedbacksQuery {
  status?: FeedbackStatus;
}

export const listFeedbacksQuerySchema = {
  parse(query: unknown): ListFeedbacksQuery {
    const data = asRecord(query);
    const validator = new Validator();

    if (data.status === undefined) return {};

    const status = asTrimmedString(data.status) as FeedbackStatus;
    if (!FEEDBACK_STATUSES.includes(status)) {
      validator.fail('status', 'Status deve ser "pendente" ou "resolvido"');
    }

    validator.throwIfInvalid();

    return { status };
  },
};
