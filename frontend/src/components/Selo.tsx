import type { ReactNode } from 'react';

type Tom = 'neutro' | 'sucesso' | 'aviso';

// Texto 800 sobre fundo 100 mantém contraste AA (RNF-08).
const TONS: Record<Tom, string> = {
  neutro: 'bg-slate-100 text-slate-800',
  sucesso: 'bg-marca-100 text-marca-800',
  aviso: 'bg-amber-100 text-amber-900',
};

/** Etiqueta curta de status (ex.: "Inativo", "Rascunho"). */
export function Selo({ tom = 'neutro', children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONS[tom]}`}>
      {children}
    </span>
  );
}
