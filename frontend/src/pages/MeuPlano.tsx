import { Link } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Icone } from '@/components/Icone';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { AppShell } from '@/layouts/AppShell';
import { useSessao } from '@/auth/useSessao';
import { formatarData, formatarDiaPorExtenso } from '@/lib/formato';
import { kcalPrevisto } from '@/plano/calculos';
import { ListaDeRefeicoes } from '@/plano/ListaDeRefeicoes';
import { ResumoNutricional } from '@/plano/ResumoNutricional';
import { usePlanoAtivo } from '@/plano/usePlanoAtivo';

/**
 * RF-05: o paciente vê o plano vigente — refeições do dia, metas calóricas e
 * orientações do nutricionista. Segue o mockup "Plano de hoje" do RFC: topo
 * coral com o resumo, depois as orientações e as refeições em cartões.
 */
export function MeuPlano() {
  const { sessao } = useSessao();
  const estado = usePlanoAtivo(sessao?.usuarioId ?? null);

  // Na árvore de rotas atual a `RotaProtegida` já garante a sessão, mas essa
  // garantia mora em outro arquivo: montar este componente direto (num teste,
  // ou numa rota nova que alguém esqueça de proteger) transformava o antigo
  // `sessao!` em TypeError. Aqui vira tela vazia, que o roteador resolve
  // redirecionando para o login.
  if (!sessao) return null;

  const topo = (
    <div className="rounded-b-[2rem] bg-marca-600 text-white">
      <div className="mx-auto max-w-3xl px-4 pb-8 pt-6">
        <p className="text-sm text-white">{formatarDiaPorExtenso(new Date().toISOString())}</p>
        <h1 className="mt-1 font-titulo text-5xl leading-tight">Meu plano</h1>
        {estado.situacao === 'pronto' && (
          <>
            {estado.plano.published_at && (
              <p className="text-sm text-white">Plano publicado em {formatarData(estado.plano.published_at)}.</p>
            )}
            <ResumoNutricional
              variante="destaque"
              totais={estado.plano.totais}
              metaKcal={estado.plano.meta_kcal}
              previstoKcal={kcalPrevisto(estado.plano.meals)}
            />
          </>
        )}
      </div>
    </div>
  );

  return (
    <AppShell titulo="Meu plano" topo={topo}>
      {estado.situacao === 'carregando' && <Carregando rotulo="Carregando seu plano…" />}

      {estado.situacao === 'erro' && <Alerta>{estado.mensagem}</Alerta>}

      {estado.situacao === 'sem-plano' && (
        <EstadoVazio titulo="Nenhum plano ativo">
          Seu nutricionista ainda não publicou um plano alimentar para você. Assim que isso acontecer, ele aparece aqui.
        </EstadoVazio>
      )}

      {estado.situacao === 'pronto' && (
        <div className="space-y-6">
          {estado.plano.orientacoes && (
            <section
              aria-labelledby="orientacoes-titulo"
              className="rounded-2xl border-l-4 border-marca-500 bg-marca-50 px-4 py-3"
            >
              <h2 id="orientacoes-titulo" className="text-xs font-semibold uppercase tracking-wider text-marca-800">
                Orientações do nutricionista
              </h2>
              {/* `whitespace-pre-line` preserva as quebras que o nutricionista
                  digitou; o texto é salvo como parágrafo livre, não como HTML. */}
              <p className="mt-1.5 whitespace-pre-line text-slate-900">{estado.plano.orientacoes}</p>
            </section>
          )}

          <section aria-labelledby="refeicoes-titulo">
            <h2 id="refeicoes-titulo" className="mb-3 font-titulo text-3xl text-slate-900">
              Refeições do dia
            </h2>
            {/* Guarda defensiva: o backend não produz este caso hoje — `publish`
                recusa plano vazio (E-08) e não há rota que remova refeição ou
                item de um plano ativo —, mas a tela não controla o que a API
                devolve e uma lista vazia não pode virar uma seção em branco. */}
            {estado.plano.meals.length === 0 ? (
              <EstadoVazio titulo="Nenhuma refeição neste plano">
                Não encontramos refeições neste plano. Entre em contato com seu nutricionista.
              </EstadoVazio>
            ) : (
              <ListaDeRefeicoes
                refeicoes={estado.plano.meals}
                // RF-06, fluxo 3.5 passo 1: o relato parte da refeição com dificuldade.
                rodape={(refeicao) => (
                  <Link
                    to={`/feedback/novo?refeicao=${refeicao.id}`}
                    aria-label={`Reportar problema com ${refeicao.nome}`}
                    className="flex min-h-toque items-center px-4 text-sm font-medium text-marca-700 hover:bg-marca-50"
                  >
                    Reportar problema
                  </Link>
                )}
              />
            )}
          </section>

          {/* O "Dificuldade com alguma refeição?" do mockup "Plano de hoje". */}
          <Link
            to="/feedback/novo"
            className="flex min-h-toque items-center justify-between gap-3 rounded-2xl bg-white px-4 py-4 font-medium text-marca-700 ring-1 ring-inset ring-marca-200 hover:bg-marca-50"
          >
            Dificuldade com alguma refeição?
            <Icone nome="seta" className="h-5 w-5 shrink-0" />
          </Link>
        </div>
      )}
    </AppShell>
  );
}
