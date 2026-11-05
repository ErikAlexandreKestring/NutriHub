import type { ResumoNps } from './tipos';

export type Categoria = 'promotor' | 'neutro' | 'detrator';

/** A classificação padrão do NPS: 9–10 promove, 7–8 é neutro, 0–6 detrai. */
export function categoriaDaNota(nota: number): Categoria {
  if (nota >= 9) return 'promotor';
  if (nota >= 7) return 'neutro';
  return 'detrator';
}

export const ROTULO_DA_CATEGORIA: Record<Categoria, string> = {
  promotor: 'Promotor',
  neutro: 'Neutro',
  detrator: 'Detrator',
};

/** "+40", "0", "-15"; traço sem respostas. O sinal faz parte da leitura do índice. */
export function formatarNps(nps: number | null): string {
  if (nps === null) return '—';
  return nps > 0 ? `+${nps}` : String(nps);
}

export function formatarTaxa(taxa: number | null): string {
  return taxa === null ? '—' : `${Math.round(taxa * 100)}%`;
}

/** Fatia de cada categoria nas respostas, em %, para a barra de distribuição. */
export function distribuicao(resumo: Pick<ResumoNps, 'respostas' | 'promotores' | 'neutros' | 'detratores'>) {
  const pct = (n: number) => (resumo.respostas === 0 ? 0 : Math.round((n / resumo.respostas) * 100));
  return { promotor: pct(resumo.promotores), neutro: pct(resumo.neutros), detrator: pct(resumo.detratores) };
}
