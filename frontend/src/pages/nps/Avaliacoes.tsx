import { Alerta } from '@/components/Alerta';
import { Avatar } from '@/components/Avatar';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { Selo } from '@/components/Selo';
import { AppShell } from '@/layouts/AppShell';
import { formatarData } from '@/lib/formato';
import { useRecurso } from '@/lib/useRecurso';
import { categoriaDaNota, ROTULO_DA_CATEGORIA, type Categoria } from '@/nps/formato';
import { buscarResumoNps } from '@/nps/npsApi';
import { PlacarNps } from '@/nps/PlacarNps';

const TOM_DA_CATEGORIA = { promotor: 'sucesso', neutro: 'neutro', detrator: 'marca' } as const satisfies Record<
  Categoria,
  string
>;

/**
 * RF-09: o consolidado do NPS do consultório e as respostas mais recentes,
 * com o comentário de cada paciente — é dali que sai o que melhorar.
 */
export function Avaliacoes() {
  const { estado } = useRecurso('nps:resumo', buscarResumoNps);

  return (
    <AppShell titulo="Avaliações" voltar={{ para: '/painel', rotulo: 'Painel' }}>
      {estado.situacao === 'carregando' && <Carregando rotulo="Carregando avaliações…" />}
      {estado.situacao === 'erro' && <Alerta>{estado.mensagem}</Alerta>}

      {estado.situacao === 'pronto' && (
        <div className="space-y-8">
          <PlacarNps resumo={estado.dados} />

          <section aria-labelledby="respostas-titulo">
            <h2 id="respostas-titulo" className="mb-3 font-titulo text-2xl text-slate-900">
              Respostas recentes
            </h2>
            {estado.dados.recentes.length === 0 ? (
              <EstadoVazio titulo="Nenhuma avaliação ainda">
                A pesquisa vai por e-mail ao paciente quando um plano é substituído por outro, no máximo uma vez por
                trimestre.
              </EstadoVazio>
            ) : (
              <ul className="space-y-3">
                {estado.dados.recentes.map((resposta) => {
                  const categoria = categoriaDaNota(resposta.nota);
                  return (
                    <li key={resposta.id} className="cartao flex items-start gap-3 p-4">
                      <Avatar nome={resposta.patient_nome} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{resposta.patient_nome}</span>
                          <span className="text-sm text-slate-600">{formatarData(resposta.respondida_em)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-titulo text-xl tabular-nums text-slate-900">
                            {resposta.nota}
                            <span className="sr-only"> de 10</span>
                          </span>
                          <Selo tom={TOM_DA_CATEGORIA[categoria]}>{ROTULO_DA_CATEGORIA[categoria]}</Selo>
                        </div>
                        {resposta.comentario && (
                          <p className="whitespace-pre-line text-slate-800">{resposta.comentario}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
