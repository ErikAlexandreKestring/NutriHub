import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  erro?: string;
  dica?: ReactNode;
}

// forwardRef porque as telas precisam focar o primeiro campo inválido ao
// submeter o formulário — sem isso o ref não chega ao <input>.
export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { rotulo, erro, dica, className = '', id: idExterno, ...props },
  ref,
) {
  const idGerado = useId();
  // O id pode vir de fora (formulários que apontam para o campo por id); o
  // htmlFor precisa seguir o mesmo valor, senão a associação some em silêncio.
  const id = idExterno ?? idGerado;
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;

  return (
    <div className={className}>
      <label htmlFor={id} className="rotulo-campo">
        {rotulo}
      </label>
      <input
        {...props}
        ref={ref}
        id={id}
        // O leitor de tela precisa anunciar o erro junto do campo; sem
        // aria-describedby a mensagem fica visível só para quem enxerga.
        // Ficam depois do spread para não serem sobrescritos sem aviso.
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
