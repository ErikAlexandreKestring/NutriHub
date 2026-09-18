import type { ReactNode } from 'react';
import { Botao } from '@/components/Botao';
import { useSessao } from '@/auth/useSessao';

/** Moldura das telas autenticadas: cabeçalho fixo com identificação e saída. */
export function AppShell({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { sessao, sair } = useSessao();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-lg font-bold text-marca-800">Nutri-Hub</p>
          <div className="flex items-center gap-3">
            {sessao && <span className="text-sm text-slate-600">{sessao.nome}</span>}
            <Botao variante="secundario" onClick={sair}>
              Sair
            </Botao>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">{titulo}</h1>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
