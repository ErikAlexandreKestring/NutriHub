import { dateTimeSchema, freeSlotsQuerySchema } from '../../src/modules/appointments/appointments.validation';
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

  describe('freeSlotsQuerySchema (fluxo 3.4, passo 2)', () => {
    it('aceita um período válido', () => {
      expect(freeSlotsQuerySchema.parse({ de: '2026-10-01', ate: '2026-10-14' })).toEqual({
        de: '2026-10-01',
        ate: '2026-10-14',
      });
    });

    it.each([
      ['datas ausentes', {}],
      ['data inexistente no calendário', { de: '2026-02-31', ate: '2026-03-02' }],
      ['data final antes da inicial', { de: '2026-10-10', ate: '2026-10-01' }],
      ['período maior que 31 dias', { de: '2026-10-01', ate: '2026-11-01' }],
    ])('rejeita %s', (_desc, query) => {
      expect(() => freeSlotsQuerySchema.parse(query)).toThrow(ValidationError);
    });
  });
});
