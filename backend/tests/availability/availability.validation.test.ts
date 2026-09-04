import { createAvailabilitySchema } from '../../src/modules/availability/availability.validation';
import { ValidationError } from '../../src/shared/errors/AppError';

describe('availability.validation (RF-08)', () => {
  it('aceita um payload válido', () => {
    const result = createAvailabilitySchema.parse({ day_of_week: 1, start_time: '08:00', end_time: '12:00' });
    expect(result).toEqual({ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' });
  });

  it.each([
    ['dia da semana fora do intervalo 0-6', { day_of_week: 7, start_time: '08:00', end_time: '12:00' }],
    ['horário inicial fora do formato', { day_of_week: 1, start_time: '25:00', end_time: '12:00' }],
    ['horário final antes do inicial', { day_of_week: 1, start_time: '12:00', end_time: '08:00' }],
    ['horários iguais', { day_of_week: 1, start_time: '08:00', end_time: '08:00' }],
    ['payload vazio', {}],
  ])('rejeita payload com %s', (_desc, payload) => {
    expect(() => createAvailabilitySchema.parse(payload)).toThrow(ValidationError);
  });
});
