import { Alerta } from '@/components/Alerta';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { AppShell } from '@/layouts/AppShell';
import { useSessao } from '@/auth/useSessao';
import { formatarData } from '@/lib/formato';
import { ListaDeRefeicoes } from '@/plano/ListaDeRefeicoes';
import { ResumoNutricional } from '@/plano/ResumoNutricional';
import { usePlanoAtivo } from '@/plano/usePlanoAtivo';

/**
 * RF-05: o paciente vê o plano vigente — refeições do dia, metas calóricas e
 * orientações do nutricionista. A rota é protegida por papel (RotaProtegida),
 * então aqui a sessão sempre existe e é a de um paciente.
 */
export function MeuPlano() {
  const { sessao } = useSessao();
  const estado = usePlanoAtivo(sessao!.usuarioId);

  return (
    <AppShell titulo="Meu plano">
      {estado.situacao === 'carregando' && <Carregando rotulo="Carregando seu plano…" />}

      {estado.situacao === 'erro' && <Alerta>{estado.mensagem}</Alerta>}

      {estado.situacao === 'sem-plano' && (
        <EstadoVazio titulo="Nenhum plano ativo">
          Seu nutricionista ainda não publicou um plano alimentar para você. Assim que isso acontecer, ele aparece aqui.
        </EstadoVazio>
      )}

      {estado.situacao === 'pronto' && (
        <div className="space-y-6">
          {estado.plano.published_at && (
            <p className="text-sm text-slate-600">
              Plano publicado em {formatarData(estado.plano.published_at)}.
            </p>
          )}

          <ResumoNutricional totais={estado.plano.totais} metaKcal={estado.plano.meta_kcal} />

          {estado.plano.orientacoes && (
            <section aria-labelledby="orientacoes-titulo">
              <h2 id="orientacoes-titulo" className="text-sm font-semibold text-slate-800">
                Orientações do nutricionista
              </h2>
              {/* `whitespace-pre-line` preserva as quebras que o nutricionista
                  digitou; o texto é salvo como parágrafo livre, não como HTML. */}
              <p className="mt-2 whitespace-pre-line rounded-xl bg-marca-50 px-4 py-3 text-sm text-marca-900">
                {estado.plano.orientacoes}
              </p>
            </section>
          )}

          <section aria-labelledby="refeicoes-titulo">
            <h2 id="refeicoes-titulo" className="mb-3 text-sm font-semibold text-slate-800">
              Refeições do dia
            </h2>
            {estado.plano.meals.length === 0 ? (
              <EstadoVazio titulo="Plano sem refeições">
                Converse com seu nutricionista: este plano foi publicado sem refeições.
              </EstadoVazio>
            ) : (
              <ListaDeRefeicoes refeicoes={estado.plano.meals} />
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
