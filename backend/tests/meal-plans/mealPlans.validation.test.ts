import {
  addMealSchema,
  addMealItemSchema,
  publishMealPlanSchema,
  updateActiveMealPlanSchema,
} from '../../src/modules/meal-plans/mealPlans.validation';
import { ValidationError } from '../../src/shared/errors/AppError';

describe('mealPlans.validation (RF-04)', () => {
  describe('addMealSchema', () => {
    it('aceita um payload válido', () => {
      const result = addMealSchema.parse({ nome: 'Café da manhã', horario: '07:30' });
      expect(result).toEqual({ nome: 'Café da manhã', horario: '07:30' });
    });

    it.each([
      ['nome muito curto', { nome: 'a', horario: '07:30' }],
      ['horário fora do formato HH:MM', { nome: 'Almoço', horario: '25:99' }],
      ['horário como texto livre', { nome: 'Almoço', horario: 'meio-dia' }],
    ])('rejeita payload com %s', (_desc, payload) => {
      expect(() => addMealSchema.parse(payload)).toThrow(ValidationError);
    });
  });

  describe('addMealItemSchema', () => {
    it('aceita um payload válido', () => {
      const result = addMealItemSchema.parse({ food_id: 'food-1', quantidade_g: 150 });
      expect(result).toEqual({ foodId: 'food-1', quantidadeG: 150 });
    });

    it.each([
      ['food_id ausente', { quantidade_g: 100 }],
      ['quantidade zero', { food_id: 'food-1', quantidade_g: 0 }],
      ['quantidade negativa', { food_id: 'food-1', quantidade_g: -10 }],
      ['quantidade acima do limite', { food_id: 'food-1', quantidade_g: 9999 }],
    ])('rejeita payload com %s', (_desc, payload) => {
      expect(() => addMealItemSchema.parse(payload)).toThrow(ValidationError);
    });
  });
});

describe('publishMealPlanSchema (RF-05)', () => {
  it('aceita publicação sem meta e sem orientações', () => {
    expect(publishMealPlanSchema.parse({})).toEqual({ metaKcal: null, orientacoes: null });
  });

  it('aceita meta numérica e orientações', () => {
    const result = publishMealPlanSchema.parse({ meta_kcal: 1800, orientacoes: '  Beba 2L de água.  ' });

    expect(result).toEqual({ metaKcal: 1800, orientacoes: 'Beba 2L de água.' });
  });

  it('converte meta enviada como string pelo formulário', () => {
    expect(publishMealPlanSchema.parse({ meta_kcal: '1650.5' }).metaKcal).toBe(1650.5);
  });

  it('trata string vazia como ausência de meta, não como zero', () => {
    expect(publishMealPlanSchema.parse({ meta_kcal: '' }).metaKcal).toBeNull();
  });

  it('rejeita meta fora da faixa aceita', () => {
    expect(() => publishMealPlanSchema.parse({ meta_kcal: 100 })).toThrow(ValidationError);
    expect(() => publishMealPlanSchema.parse({ meta_kcal: 99999 })).toThrow(ValidationError);
  });

  it('rejeita orientações acima de 2000 caracteres', () => {
    expect(() => publishMealPlanSchema.parse({ orientacoes: 'a'.repeat(2001) })).toThrow(ValidationError);
  });
});

describe('updateActiveMealPlanSchema (issue #10)', () => {
  it('devolve só os campos enviados, para não apagar o que não veio no corpo', () => {
    expect(updateActiveMealPlanSchema.parse({ orientacoes: '  Evite frituras. ' })).toEqual({
      orientacoes: 'Evite frituras.',
    });
    expect(updateActiveMealPlanSchema.parse({ meta_kcal: '1650.5' })).toEqual({ metaKcal: 1650.5 });
  });

  it('aceita null explícito para limpar um campo', () => {
    expect(updateActiveMealPlanSchema.parse({ meta_kcal: null, orientacoes: '' })).toEqual({
      metaKcal: null,
      orientacoes: null,
    });
  });

  it('rejeita corpo sem nenhum dos dois campos', () => {
    expect(() => updateActiveMealPlanSchema.parse({})).toThrow(ValidationError);
    expect(() => updateActiveMealPlanSchema.parse({ status: 'encerrado' })).toThrow(ValidationError);
  });

  it('aplica as mesmas faixas da publicação', () => {
    expect(() => updateActiveMealPlanSchema.parse({ meta_kcal: 100 })).toThrow(ValidationError);
    expect(() => updateActiveMealPlanSchema.parse({ orientacoes: 'a'.repeat(2001) })).toThrow(ValidationError);
  });
});
