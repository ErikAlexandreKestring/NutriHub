import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface AreaDeTextoProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  rotulo: string;
  erro?: string;
  dica?: ReactNode;
}

/** Equivalente do `Campo` para texto longo (histórico, orientações). */
export const AreaDeTexto = forwardRef<HTMLTextAreaElement, AreaDeTextoProps>(function AreaDeTexto(
  { rotulo, erro, dica, className = '', id: idExterno, rows = 4, ...props },
  ref,
) {
  const idGerado = useId();
  const id = idExterno ?? idGerado;
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;

  return (
    <div className={className}>
      <label htmlFor={id} className="rotulo-campo">
        {rotulo}
      </label>
      <textarea
        {...props}
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={erro ? true : props['aria-invalid']}
        aria-describedby={erro ? idErro : dica ? idDica : props['aria-describedby']}
        className={`entrada ${erro ? 'entrada-com-erro' : ''}`}
      />
      {erro ? (
        <p id={idErro} className="mt-1 text-sm text-red-700">
          {erro}
        </p>
      ) : dica ? (
        <p id={idDica} className="mt-1 text-sm text-slate-600">
          {dica}
        </p>
      ) : null}
    </div>
  );
});
