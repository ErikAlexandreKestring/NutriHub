import {
  addDays,
  dayOfWeekOf,
  getZonedDate,
  getZonedDayAndTime,
  zonedDateTimeToUtc,
} from '../../src/shared/utils/timezone';

describe('timezone utils (RN-08, fuso America/Sao_Paulo)', () => {
  it('converte hora de parede de Brasília para o instante UTC', () => {
    expect(zonedDateTimeToUtc('2026-10-05', '09:00').toISOString()).toBe('2026-10-05T12:00:00.000Z');
  });

  it('faz o caminho inverso: dia da semana e horário vistos em Brasília', () => {
    // 01:30 UTC de terça ainda é segunda à noite em Brasília.
    expect(getZonedDayAndTime(new Date('2026-10-06T01:30:00.000Z'))).toEqual({ dayOfWeek: 1, timeOfDay: '22:30' });
  });

  it('formata meia-noite como 00:00, não 24:00', () => {
    expect(getZonedDayAndTime(new Date('2026-10-06T03:00:00.000Z')).timeOfDay).toBe('00:00');
  });

  it('dá a data do calendário em Brasília', () => {
    expect(getZonedDate(new Date('2026-10-06T01:30:00.000Z'))).toBe('2026-10-05');
  });

  it('calcula dia da semana e soma dias atravessando o mês', () => {
    expect(dayOfWeekOf('2026-10-04')).toBe(0);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
});
