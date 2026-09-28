/**
 * Emoji de cada refeição, como nos mockups (🥣 café, 🥗 almoço, 🌙 jantar…).
 * Decorativo — ajuda quem lê pouco (a persona Dona Maria) a achar a refeição
 * de relance, mas o nome continua sempre escrito ao lado.
 */
const ICONES: Array<[RegExp, string]> = [
  [/cafe/, '🥣'],
  [/lanche.*manha|colacao/, '🍎'],
  [/almoco/, '🥗'],
  [/lanche|merenda/, '🥪'],
  [/jantar/, '🌙'],
  [/ceia/, '🌃'],
  [/pre.?treino|pos.?treino/, '🍌'],
];

export function iconeDaRefeicao(nome: string): string {
  const chave = nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  return ICONES.find(([padrao]) => padrao.test(chave))?.[1] ?? '🍽️';
}

/** Atalhos do "Adicionar refeição": nome e um horário típico, editáveis depois. */
export const TIPOS_DE_REFEICAO = [
  { nome: 'Café da manhã', horario: '07:00' },
  { nome: 'Lanche da manhã', horario: '10:00' },
  { nome: 'Almoço', horario: '12:00' },
  { nome: 'Lanche da tarde', horario: '15:30' },
  { nome: 'Jantar', horario: '19:30' },
  { nome: 'Ceia', horario: '21:30' },
] as const;
