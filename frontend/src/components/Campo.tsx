import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  erro?: string;
  dica?: ReactNode;
}

export function Campo({ rotulo, erro, dica, className = '', ...props }: CampoProps) {
  const id = useId();
  const idErro = `${id}-erro`;
  const idDica = `${id}-dica`;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {rotulo}
      </label>
      <input
        id={id}
        // O leitor de tela precisa anunciar o erro junto do campo; sem
        // aria-describedby a mensagem fica visível só para quem enxerga.
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : dica ? idDica : undefined}
        className={`mt-1 block min-h-toque w-full rounded-lg border-0 px-3 py-2 text-slate-900 ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset ${
          erro ? 'ring-red-400 focus:ring-red-600' : 'ring-slate-300 focus:ring-marca-700'
        }`}
        {...props}
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
}
