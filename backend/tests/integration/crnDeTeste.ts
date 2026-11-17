import { randomInt } from 'crypto';

/**
 * CRN válido e diferente a cada chamada, para os consultórios criados nos
 * testes não esbarrarem no índice único `tenants_crn_unico` (um CRN, uma
 * conta). Aleatório, e não um contador, porque cada arquivo de teste roda com
 * os módulos recarregados e pode sobrar consultório de uma execução
 * interrompida. São 11 regiões × 999.999 números.
 */
export function crnDeTeste(): string {
  return `CRN-${randomInt(1, 12)} ${randomInt(1, 1_000_000)}`;
}
