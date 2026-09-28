import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';

interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string;
  erro?: string;
  children: ReactNode;
}

/** Equivalente do `Campo` para `<select>` (ex.: dia da semana da grade). */
export const Selecao = forwardRef<HTMLSelectElement, SelecaoProps>(function Selecao(
  { rotulo, erro, className = '', id: idExterno, children, ...props },
  ref,
) {
  const idGerado = useId();
  const id = idExterno ?? idGerado;
  const idErro = `${id}-erro`;

  return (
    <div className={className}>
      <label htmlFor={id} className="rotulo-campo">
        {rotulo}
      </label>
      <select
        {...props}
        ref={ref}
        id={id}
        aria-invalid={erro ? true : props['aria-invalid']}
        aria-describedby={erro ? idErro : props['aria-describedby']}
        className={`entrada ${erro ? 'entrada-com-erro' : ''}`}
      >
        {children}
      </select>
      {erro && (
        <p id={idErro} className="mt-1 text-sm text-red-700">
          {erro}
        </p>
      )}
    </div>
  );
});
