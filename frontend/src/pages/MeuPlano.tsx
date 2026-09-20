import { Alerta } from '@/components/Alerta';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { AppShell } from '@/layouts/AppShell';
import { useSessao } from '@/auth/useSessao';
import { formatarData } from '@/lib/formato';
import { kcalPrevisto } from '@/plano/calculos';
import { ListaDeRefeicoes } from '@/plano/ListaDeRefeicoes';
import { ResumoNutricional } from '@/plano/ResumoNutricional';
import { usePlanoAtivo } from '@/plano/usePlanoAtivo';

/**
 * RF-05: o paciente vê o plano vigente — refeições do dia, metas calóricas e
 * orientações do nutricionista.
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

          <ResumoNutricional
            totais={estado.plano.totais}
            metaKcal={estado.plano.meta_kcal}
            previstoKcal={kcalPrevisto(estado.plano.meals)}
          />

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
            {/* Guarda defensiva: o backend não produz este caso hoje — `publish`
                recusa plano vazio (E-08) e não há rota que remova refeição ou
                item —, mas a tela não controla o que a API devolve e uma lista
                vazia não pode virar uma seção em branco sem explicação. */}
            {estado.plano.meals.length === 0 ? (
              <EstadoVazio titulo="Nenhuma refeição neste plano">
                Não encontramos refeições neste plano. Entre em contato com seu nutricionista.
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
