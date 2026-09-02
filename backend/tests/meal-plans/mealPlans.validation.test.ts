import { addMealSchema, addMealItemSchema } from '../../src/modules/meal-plans/mealPlans.validation';
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
