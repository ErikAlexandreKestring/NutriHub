import type { Alimento, Refeicao } from './tipos';

/**
 * Subtotal calórico de uma refeição, já arredondado para o inteiro que a tela
 * exibe. O arredondamento acontece aqui, e não no formatador, porque o total do
 * resumo precisa ser a soma exata destes valores — ver `kcalPrevisto`.
 */
export function kcalDaRefeicao(refeicao: Refeicao): number {
  return Math.round(refeicao.items.reduce((total, item) => total + Number(item.kcal), 0));
}

/**
 * Total previsto do plano, somado a partir dos subtotais JÁ arredondados.
 *
 * Usar `totais.kcal` da API aqui produzia números que não fecham: o backend
 * soma os valores cheios e arredonda no fim, enquanto cada linha é arredondada
 * por conta própria. Com três refeições de 500,4 kcal, as linhas mostram 500 e
 * o resumo mostraria 1.501 — o paciente soma a tela e encontra 1.500. Numa
 * tela cujo propósito é comparar previsto com meta, a conta precisa fechar na
 * conferência do próprio usuário, ainda que custe até meio kcal por refeição
 * de diferença em relação ao total exato.
 */
export function kcalPrevisto(refeicoes: Refeicao[]): number {
  return refeicoes.reduce((total, refeicao) => total + kcalDaRefeicao(refeicao), 0);
}

function arredondar2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Prévia dos macros de um alimento na quantidade escolhida, antes de adicioná-lo
 * (RF-04, passo 5: "recalcula em tempo real"). Usa a mesma conta do backend
 * (`addItem` em mealPlans.service: valor por 100 g × gramas / 100, duas casas),
 * para que o número mostrado antes seja o mesmo que fica gravado depois.
 */
export function macrosDoAlimento(alimento: Alimento, gramas: number) {
  const fator = gramas / 100;
  return {
    kcal: arredondar2(Number(alimento.kcal_100g) * fator),
    proteina_g: arredondar2(Number(alimento.proteina_100g) * fator),
    carb_g: arredondar2(Number(alimento.carb_100g) * fator),
    gordura_g: arredondar2(Number(alimento.gordura_100g) * fator),
  };
}
