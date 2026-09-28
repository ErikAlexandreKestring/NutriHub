import type { ReactNode } from 'react';
import { Marca } from '@/components/Marca';

/**
 * Moldura das telas públicas (login, cadastro e primeiro acesso), no estilo
 * dos mockups do RFC: formulário sobre fundo creme com título em serifada e,
 * da largura de tablet para cima, o painel marinho de boas-vindas ao lado.
 */
export function AuthShell({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string;
  descricao: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-creme">
      <aside
        aria-hidden="true"
        className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-tinta-900 p-12 text-white lg:flex"
      >
        {/* Brilho coral do mockup de boas-vindas. Decorativo. */}
        <div className="pointer-events-none absolute -left-24 top-1/3 h-[28rem] w-[28rem] rounded-full bg-marca-500/25 blur-3xl" />
        <span className="relative inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-marca-400 ring-1 ring-marca-400/50">
          <span className="h-1.5 w-1.5 rounded-full bg-marca-400" />
          Plataforma nutricional
        </span>
        <div className="relative">
          <p className="font-titulo text-6xl leading-[1.05]">
            Coma bem.
            <br />
            Viva <em className="text-marca-400">melhor.</em>
          </p>
          <p className="mt-6 max-w-sm text-base text-slate-300">
            Seu plano alimentar sempre à mão, com acompanhamento real do seu nutricionista.
          </p>
        </div>
        <Marca claro className="relative" />
      </aside>

      <main className="flex flex-1 items-start justify-center px-5 py-10 sm:items-center">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center lg:hidden">
            <Marca />
          </div>

          <h1 className="font-titulo text-4xl leading-tight text-slate-900">{titulo}</h1>
          <p className="mt-2 text-sm text-slate-600">{descricao}</p>
          <div className="mt-8">{children}</div>

          {rodape && <div className="mt-6 text-center text-sm text-slate-600">{rodape}</div>}
        </div>
      </main>
    </div>
  );
}
