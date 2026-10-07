import type { ReactNode } from 'react';

/**
 * Radio nativo com cara de botão: teclado (setas) e leitor de tela funcionam
 * como num grupo de rádio comum, sem ARIA feito à mão.
 */
export function OpcaoEmPilula({
  nome,
  marcada,
  aoMarcar,
  rotuloAcessivel,
  children,
}: {
  nome: string;
  marcada: boolean;
  aoMarcar: () => void;
  rotuloAcessivel?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <input
        type="radio"
        name={nome}
        className="peer sr-only"
        checked={marcada}
        onChange={aoMarcar}
        aria-label={rotuloAcessivel}
      />
      <span className="flex min-h-toque min-w-toque cursor-pointer items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-slate-800 ring-1 ring-inset ring-black/10 hover:bg-marca-50 peer-checked:bg-marca-600 peer-checked:text-white peer-checked:ring-marca-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marca-700">
        {children}
      </span>
    </label>
  );
}
