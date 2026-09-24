import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classesDeBotao, type Variante } from './classesDeBotao';

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
      className={classesDeBotao(variante, className)}
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
