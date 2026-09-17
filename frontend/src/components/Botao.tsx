import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'perigo';

const VARIANTES: Record<Variante, string> = {
  // marca-700 sobre branco e branco sobre marca-700 passam em contraste AA (RNF-08).
  primario: 'bg-marca-700 text-white hover:bg-marca-800 focus-visible:outline-marca-700',
  secundario:
    'bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-500',
  perigo: 'bg-white text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50 focus-visible:outline-red-600',
};

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  carregando?: boolean;
  children: ReactNode;
}

export function Botao({
  variante = 'primario',
  carregando = false,
  disabled,
  className = '',
  children,
  ...props
}: BotaoProps) {
  return (
    <button
      // min-h/min-w de 44px é o alvo de toque mínimo exigido pelo RNF-08.
      className={`inline-flex min-h-toque min-w-toque items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]} ${className}`}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...props}
    >
      {carregando && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
