export type Variante = 'primario' | 'secundario' | 'perigo';

const VARIANTES: Record<Variante, string> = {
  // marca-700 sobre branco e branco sobre marca-700 passam em contraste AA (RNF-08).
  primario: 'bg-marca-700 text-white hover:bg-marca-800 focus-visible:outline-marca-700',
  secundario:
    'bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-500',
  perigo: 'bg-white text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50 focus-visible:outline-red-600',
};

const BASE =
  'inline-flex min-h-toque min-w-toque items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Para navegação com cara de botão (ex.: "Novo paciente"): continua sendo um
 * `<Link>`, porque leva a outra página — um `<button>` que navega quebra o
 * "abrir em nova aba" e é anunciado errado pelo leitor de tela.
 */
export function classesDeBotao(variante: Variante = 'primario', extra = ''): string {
  return `${BASE} ${VARIANTES[variante]} ${extra}`;
}
