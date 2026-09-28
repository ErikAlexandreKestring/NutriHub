export type Variante = 'primario' | 'secundario' | 'perigo' | 'escuro';

const VARIANTES: Record<Variante, string> = {
  // Branco sobre marca-600 fica em 4,55:1 — o coral mais claro que ainda passa
  // no AA (RNF-08). O marca-500 dos mockups (3,1:1) não serve para texto.
  primario: 'bg-marca-600 text-white shadow-sm shadow-marca-600/20 hover:bg-marca-700 focus-visible:outline-marca-700',
  secundario:
    'bg-white text-slate-800 ring-1 ring-inset ring-black/10 hover:bg-creme focus-visible:outline-slate-500',
  perigo: 'bg-white text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50 focus-visible:outline-red-600',
  // "Já tenho cadastro" da tela de boas-vindas: botão sobre o fundo marinho.
  escuro: 'bg-tinta-800 text-white ring-1 ring-inset ring-white/10 hover:bg-tinta-700 focus-visible:outline-white',
};

const BASE =
  'inline-flex min-h-toque min-w-toque items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Para navegação com cara de botão (ex.: "Novo paciente"): continua sendo um
 * `<Link>`, porque leva a outra página — um `<button>` que navega quebra o
 * "abrir em nova aba" e é anunciado errado pelo leitor de tela.
 */
export function classesDeBotao(variante: Variante = 'primario', extra = ''): string {
  return `${BASE} ${VARIANTES[variante]} ${extra}`;
}
