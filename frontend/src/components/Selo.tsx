import type { ReactNode } from 'react';

type Tom = 'neutro' | 'sucesso' | 'aviso' | 'marca';

// Texto 800 sobre fundo 100 mantém contraste AA (RNF-08).
const TONS: Record<Tom, string> = {
  neutro: 'bg-slate-100 text-slate-800',
  // Verde como o "Conf." dos mockups da agenda; o coral fica para destaque.
  sucesso: 'bg-emerald-100 text-emerald-800',
  aviso: 'bg-amber-100 text-amber-900',
  marca: 'bg-marca-100 text-marca-800',
};

/** Etiqueta curta de status (ex.: "Inativo", "Rascunho"). */
export function Selo({ tom = 'neutro', children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONS[tom]}`}>
      {children}
    </span>
  );
}
