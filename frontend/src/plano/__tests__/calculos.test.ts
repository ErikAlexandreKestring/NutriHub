import { describe, expect, it } from 'vitest';
import { kcalDaRefeicao, kcalPrevisto } from '../calculos';
import type { ItemDaRefeicao, Refeicao } from '../tipos';

function item(kcal: string): ItemDaRefeicao {
  return {
    id: `item-${kcal}`,
    food_id: 'food-1',
    food_nome: 'Alimento',
    quantidade_g: '100',
    kcal,
    proteina_g: '0',
    carb_g: '0',
    gordura_g: '0',
  };
}

function refeicao(id: string, kcals: string[]): Refeicao {
  return { id, nome: `Refeição ${id}`, horario: '07:30:00', items: kcals.map(item) };
}

describe('cálculo calórico da tela do plano (RF-05)', () => {
  it('soma os itens de uma refeição', () => {
    expect(kcalDaRefeicao(refeicao('r1', ['192', '58.5']))).toBe(251);
  });

  it('devolve zero para refeição sem itens', () => {
    expect(kcalDaRefeicao(refeicao('r1', []))).toBe(0);
  });

  // Revisão do PR #9: o caso que o fixture redondo escondia. Três refeições de
  // 500,4 kcal exibem "500 kcal" cada; o total precisa ser 1.500, que é o que o
  // paciente encontra somando a tela — e não 1.501, o total exato arredondado.
  it('fecha com a soma dos subtotais exibidos quando há centavos', () => {
    const refeicoes = [
      refeicao('r1', ['500.4']),
      refeicao('r2', ['500.4']),
      refeicao('r3', ['500.4']),
    ];

    expect(refeicoes.map(kcalDaRefeicao)).toEqual([500, 500, 500]);
    expect(kcalPrevisto(refeicoes)).toBe(1500);
  });

  it('arredonda o subtotal antes de somar, não depois', () => {
    // 0,5 em cada uma: somar antes daria 2; arredondar antes dá 4 (0,5 sobe).
    const refeicoes = [refeicao('r1', ['0.5']), refeicao('r2', ['0.5']), refeicao('r3', ['0.5']), refeicao('r4', ['0.5'])];

    expect(kcalPrevisto(refeicoes)).toBe(4);
  });

  it('devolve zero para plano sem refeições', () => {
    expect(kcalPrevisto([])).toBe(0);
  });
});
