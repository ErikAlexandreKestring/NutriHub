import { dateTimeSchema } from '../../src/modules/appointments/appointments.validation';
import { ValidationError } from '../../src/shared/errors/AppError';

describe('appointments.validation (RF-08/11/12)', () => {
  describe('dateTimeSchema', () => {
    it('aceita uma data/hora ISO válida', () => {
      const result = dateTimeSchema.parse({ data_hora: '2026-09-01T10:00:00.000Z' });
      expect(result).toEqual({ dataHora: '2026-09-01T10:00:00.000Z' });
    });

    it.each([['data ausente', {}], ['data inválida', { data_hora: 'não é uma data' }]])(
      'rejeita payload com %s',
      (_desc, payload) => {
        expect(() => dateTimeSchema.parse(payload)).toThrow(ValidationError);
      },
    );
  });

});
