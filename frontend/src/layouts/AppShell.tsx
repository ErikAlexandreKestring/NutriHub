import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Icone, type NomeDoIcone } from '@/components/Icone';
import { Marca } from '@/components/Marca';
import type { Papel } from '@/auth/sessao';
import { useSessao } from '@/auth/useSessao';

interface AppShellProps {
  titulo: string;
  children: ReactNode;
  /** Link de retorno acima do título (ex.: do paciente de volta à lista). */
  voltar?: { para: string; rotulo: string };
  /** Ações ao lado do título (ex.: "Novo paciente"). */
  acoes?: ReactNode;
  /**
   * Substitui o bloco padrão de título por um topo próprio, de largura total
   * (ex.: o cabeçalho coral do "Meu plano"). Quem passa `topo` renderiza o
   * próprio `<h1>` com `titulo`.
   */
  topo?: ReactNode;
}

interface ItemDoMenu {
  para: string;
  rotulo: string;
  icone: NomeDoIcone;
}

const MENU: Record<Papel, ItemDoMenu[]> = {
  nutricionista: [
    { para: '/pacientes', rotulo: 'Pacientes', icone: 'pessoas' },
    { para: '/agenda', rotulo: 'Agenda', icone: 'calendario' },
  ],
  paciente: [
    { para: '/meu-plano', rotulo: 'Meu plano', icone: 'prato' },
    { para: '/minhas-consultas', rotulo: 'Consultas', icone: 'calendario' },
  ],
};

/**
 * Moldura das telas autenticadas. No celular a navegação vai para uma barra de
 * abas fixa embaixo, ao alcance do polegar (como nos mockups do RFC); do tablet
 * para cima ela fica no cabeçalho.
 */
export function AppShell({ titulo, children, voltar, acoes, topo }: AppShellProps) {
  const { sessao, sair } = useSessao();
  const menu = sessao ? MENU[sessao.papel] : [];

  return (
    <div className="min-h-screen bg-creme">
      <header className="border-b border-black/5 bg-creme/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <div className="flex items-center gap-6">
            <Marca />
            {menu.length > 0 && (
              <nav aria-label="Principal" className="hidden sm:block">
                <ul className="flex gap-1">
                  {menu.map((item) => (
                    <li key={item.para}>
                      <NavLink
                        to={item.para}
                        className={({ isActive }) =>
                          `inline-flex min-h-toque items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
                            isActive ? 'bg-marca-50 text-marca-700' : 'text-slate-700 hover:bg-white'
                          }`
                        }
                      >
                        <Icone nome={item.icone} className="h-4 w-4" />
                        {item.rotulo}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-2">
            {sessao && <span className="hidden text-sm text-slate-600 sm:inline">{sessao.nome}</span>}
            <button
              type="button"
              onClick={sair}
              className="inline-flex min-h-toque items-center gap-1.5 rounded-full px-3 text-sm font-medium text-slate-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca-700"
            >
              <Icone nome="sair" className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {topo}

      {/* pb extra no celular: a barra de abas fixa não pode cobrir o fim da página. */}
      <main className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:pb-12 sm:pt-8">
        {!topo && (
          <>
            {voltar && (
              <Link
                to={voltar.para}
                className="group mb-3 inline-flex min-h-toque items-center gap-2 text-sm font-medium text-slate-700"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white ring-1 ring-inset ring-black/10 transition group-hover:bg-marca-50">
                  <Icone nome="voltar" className="h-4 w-4" />
                </span>
                {voltar.rotulo}
              </Link>
            )}
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h1 className="font-titulo text-4xl leading-tight text-slate-900">{titulo}</h1>
              {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
            </div>
          </>
        )}
        <div className={topo ? '' : 'mt-6'}>{children}</div>
      </main>

      {menu.length > 0 && (
        <nav
          aria-label="Principal (celular)"
          className="fixed inset-x-0 bottom-0 z-10 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        >
          <ul className="mx-auto flex max-w-md">
            {menu.map((item) => (
              <li key={item.para} className="flex-1">
                <NavLink
                  to={item.para}
                  className={({ isActive }) =>
                    `flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-xs font-medium ${
                      isActive ? 'text-marca-700' : 'text-slate-600'
                    }`
                  }
                >
                  <Icone nome={item.icone} className="h-6 w-6" />
                  {item.rotulo}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
