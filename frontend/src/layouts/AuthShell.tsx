import type { ReactNode } from 'react';

/** Moldura das telas públicas (login e primeiro acesso). */
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
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-2xl font-bold text-marca-800">Nutri-Hub</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-lg font-semibold text-slate-900">{titulo}</h1>
          <p className="mt-1 text-sm text-slate-600">{descricao}</p>
          <div className="mt-6">{children}</div>
        </div>

        {rodape && <div className="mt-4 text-center text-sm text-slate-600">{rodape}</div>}
      </div>
    </div>
  );
}
