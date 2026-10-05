import {
  createFeedbackSchema,
  listFeedbacksQuerySchema,
  resolveFeedbackSchema,
} from '../../src/modules/feedbacks/feedbacks.validation';
import { ValidationError } from '../../src/shared/errors/AppError';

const MEAL_ID = '44444444-4444-4444-8444-444444444444';

describe('feedbacks.validation (RF-06)', () => {
  describe('createFeedbackSchema', () => {
    it('aceita a descrição e apara os espaços', () => {
      expect(createFeedbackSchema.parse({ descricao: '  Não encontrei aveia no mercado  ' })).toEqual({
        descricao: 'Não encontrei aveia no mercado',
        mealId: undefined,
      });
    });

    it('aceita a refeição de origem', () => {
      expect(createFeedbackSchema.parse({ descricao: 'Tenho alergia a amendoim', meal_id: MEAL_ID })).toEqual({
        descricao: 'Tenho alergia a amendoim',
        mealId: MEAL_ID,
      });
    });

    it('trata meal_id nulo como ausente', () => {
      expect(createFeedbackSchema.parse({ descricao: 'Tenho alergia a amendoim', meal_id: null }).mealId).toBeUndefined();
    });

    it.each([
      ['descrição ausente', {}],
      ['descrição curta demais', { descricao: 'ruim' }],
      ['descrição longa demais', { descricao: 'a'.repeat(1001) }],
      ['refeição que não é UUID', { descricao: 'Tenho alergia a amendoim', meal_id: 'cafe' }],
    ])('rejeita %s', (_desc, payload) => {
      expect(() => createFeedbackSchema.parse(payload)).toThrow(ValidationError);
    });
  });

  describe('resolveFeedbackSchema', () => {
    it('aceita resolver sem resposta', () => {
      expect(resolveFeedbackSchema.parse({})).toEqual({ resposta: undefined });
      expect(resolveFeedbackSchema.parse({ resposta: '   ' })).toEqual({ resposta: undefined });
    });

    it('aceita a resposta do nutricionista', () => {
      expect(resolveFeedbackSchema.parse({ resposta: 'Troque por farelo de aveia' })).toEqual({
        resposta: 'Troque por farelo de aveia',
      });
    });

    it('rejeita resposta longa demais', () => {
      expect(() => resolveFeedbackSchema.parse({ resposta: 'a'.repeat(1001) })).toThrow(ValidationError);
    });
  });

  describe('listFeedbacksQuerySchema', () => {
    it('sem filtro devolve todos', () => {
      expect(listFeedbacksQuerySchema.parse({})).toEqual({});
    });

    it.each(['pendente', 'resolvido'])('aceita status %s', (status) => {
      expect(listFeedbacksQuerySchema.parse({ status })).toEqual({ status });
    });

    it('rejeita status desconhecido', () => {
      expect(() => listFeedbacksQuerySchema.parse({ status: 'arquivado' })).toThrow(ValidationError);
    });
  });
});
