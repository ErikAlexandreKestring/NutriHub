import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Botao } from '@/components/Botao';
import { useSessao } from '@/auth/useSessao';

interface AppShellProps {
  titulo: string;
  children: ReactNode;
  /** Link de retorno acima do título (ex.: do paciente de volta à lista). */
  voltar?: { para: string; rotulo: string };
  /** Ações ao lado do título (ex.: "Novo paciente"). */
  acoes?: ReactNode;
}

/** Áreas do nutricionista. O paciente tem uma tela só e não precisa de menu. */
const MENU_NUTRICIONISTA = [{ para: '/pacientes', rotulo: 'Pacientes' }];

/** Moldura das telas autenticadas: cabeçalho fixo com identificação e saída. */
export function AppShell({ titulo, children, voltar, acoes }: AppShellProps) {
  const { sessao, sair } = useSessao();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <p className="text-lg font-bold text-marca-800">Nutri-Hub</p>
            {sessao?.papel === 'nutricionista' && (
              <nav aria-label="Principal">
                <ul className="flex gap-1">
                  {MENU_NUTRICIONISTA.map((item) => (
                    <li key={item.para}>
                      <NavLink
                        to={item.para}
                        className={({ isActive }) =>
                          `inline-flex min-h-toque items-center rounded-lg px-3 text-sm font-medium ${
                            isActive ? 'bg-marca-50 text-marca-800' : 'text-slate-700 hover:bg-slate-50'
                          }`
                        }
                      >
                        {item.rotulo}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3">
            {sessao && <span className="text-sm text-slate-600">{sessao.nome}</span>}
            <Botao variante="secundario" onClick={sair}>
              Sair
            </Botao>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {voltar && (
          <Link
            to={voltar.para}
            className="mb-2 inline-flex min-h-toque items-center text-sm font-medium text-marca-700 hover:underline"
          >
            <span aria-hidden="true">←&nbsp;</span>
            {voltar.rotulo}
          </Link>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{titulo}</h1>
          {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
        </div>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
