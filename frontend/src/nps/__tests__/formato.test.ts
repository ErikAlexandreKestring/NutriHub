import { describe, expect, it } from 'vitest';
import { categoriaDaNota, distribuicao, formatarNps, formatarTaxa } from '../formato';

describe('formato do NPS', () => {
  it.each([
    [10, 'promotor'],
    [9, 'promotor'],
    [8, 'neutro'],
    [7, 'neutro'],
    [6, 'detrator'],
    [0, 'detrator'],
  ] as const)('a nota %i é de %s', (nota, categoria) => {
    expect(categoriaDaNota(nota)).toBe(categoria);
  });

  it('mostra o sinal do índice e um traço sem respostas', () => {
    expect(formatarNps(40)).toBe('+40');
    expect(formatarNps(0)).toBe('0');
    expect(formatarNps(-15)).toBe('-15');
    expect(formatarNps(null)).toBe('—');
  });

  it('formata a taxa de resposta em porcentagem', () => {
    expect(formatarTaxa(0.8)).toBe('80%');
    expect(formatarTaxa(null)).toBe('—');
  });

  it('distribui as respostas por categoria, sem dividir por zero', () => {
    expect(distribuicao({ respostas: 4, promotores: 2, neutros: 1, detratores: 1 })).toEqual({
      promotor: 50,
      neutro: 25,
      detrator: 25,
    });
    expect(distribuicao({ respostas: 0, promotores: 0, neutros: 0, detratores: 0 })).toEqual({
      promotor: 0,
      neutro: 0,
      detrator: 0,
    });
  });
});
