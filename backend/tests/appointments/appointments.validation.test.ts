import { dateTimeSchema, cancelAppointmentSchema } from '../../src/modules/appointments/appointments.validation';
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

  describe('cancelAppointmentSchema', () => {
    it('usa nutricionista como ator padrão quando não informado', () => {
      const result = cancelAppointmentSchema.parse({});
      expect(result).toEqual({ ator: 'nutricionista' });
    });

    it('aceita ator paciente explicitamente', () => {
      const result = cancelAppointmentSchema.parse({ ator: 'paciente' });
      expect(result).toEqual({ ator: 'paciente' });
    });

    it('rejeita ator inválido', () => {
      expect(() => cancelAppointmentSchema.parse({ ator: 'admin' })).toThrow(ValidationError);
    });
  });
});
