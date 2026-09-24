import { describe, expect, it } from 'vitest';
import { ehFutura, formatarDataSemHora, formatarHora, formatarHorario, nomeDoDia } from '../formato';

describe('formato', () => {
  it('formata a hora no fuso de São Paulo, não no fuso do dispositivo', () => {
    // 13:00 UTC é 10:00 em São Paulo (UTC-3). Se a formatação usasse o fuso
    // local do celular, o paciente veria um horário diferente do que o backend
    // validou contra a grade (RN-08).
    expect(formatarHora('2026-09-01T13:00:00Z')).toBe('10:00');
  });

  it('corta os segundos das colunas time do Postgres', () => {
    expect(formatarHorario('08:00:00')).toBe('08:00');
  });

  it('nomeia os dias da semana a partir de domingo', () => {
    expect(nomeDoDia(0)).toBe('Domingo');
    expect(nomeDoDia(6)).toBe('Sábado');
  });

  it('identifica datas futuras e passadas', () => {
    expect(ehFutura(new Date(Date.now() + 60_000).toISOString())).toBe(true);
    expect(ehFutura(new Date(Date.now() - 60_000).toISOString())).toBe(false);
  });
});

describe('formatarDataSemHora', () => {
  // new Date('1990-01-01') é meia-noite UTC, que em São Paulo ainda é 31/12.
  it('não desloca o dia pelo fuso', () => {
    expect(formatarDataSemHora('1990-01-01')).toBe('01/01/1990');
  });

  it('aceita o valor com hora anexada', () => {
    expect(formatarDataSemHora('1990-05-20T00:00:00.000Z')).toBe('20/05/1990');
  });
});
