import { preferenciaDeLembreteSchema } from '../../src/modules/meal-reminders/mealReminders.validation';
import { ValidationError } from '../../src/shared/errors/AppError';

describe('preferenciaDeLembreteSchema', () => {
  it.each([true, false])('aceita ativo=%s', (ativo) => {
    expect(preferenciaDeLembreteSchema.parse({ ativo })).toEqual({ ativo });
  });

  it.each([undefined, 'true', 1, null])('recusa ativo=%p', (ativo) => {
    expect(() => preferenciaDeLembreteSchema.parse({ ativo })).toThrow(ValidationError);
  });
});
