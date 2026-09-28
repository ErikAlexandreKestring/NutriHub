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
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {rotulo}
      </label>
      <select
        {...props}
        ref={ref}
        id={id}
        aria-invalid={erro ? true : props['aria-invalid']}
        aria-describedby={erro ? idErro : props['aria-describedby']}
        className={`mt-1 block min-h-toque w-full rounded-lg border-0 bg-white px-3 py-2 text-slate-900 ring-1 ring-inset focus:ring-2 focus:ring-inset ${
          erro ? 'ring-red-400 focus:ring-red-600' : 'ring-slate-300 focus:ring-marca-700'
        }`}
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
