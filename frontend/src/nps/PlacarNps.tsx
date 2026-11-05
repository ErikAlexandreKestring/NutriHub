import type { ResumoNps } from './tipos';
import { distribuicao, formatarNps, formatarTaxa } from './formato';

/**
 * RF-09: o índice do consultório, a distribuição promotores/neutros/detratores
 * e a taxa de resposta. Usado no Painel e na tela de avaliações.
 */
export function PlacarNps({ resumo }: { resumo: ResumoNps }) {
  const fatias = distribuicao(resumo);

  return (
    <div className="cartao space-y-4 p-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <p>
          {/* Sem respostas não há índice: um "—" em fonte gigante parecia uma
              linha quebrada, então vai um texto do tamanho normal. */}
          {resumo.nps === null ? (
            <span className="block text-lg font-semibold text-slate-700">Ainda sem respostas</span>
          ) : (
            <span className="block font-titulo text-5xl leading-none tabular-nums text-slate-900">
              {formatarNps(resumo.nps)}
            </span>
          )}
          <span className="mt-1 block text-sm text-slate-600">Índice NPS (de -100 a +100)</span>
        </p>
        <p className="text-sm text-slate-700">
          {resumo.respostas} {resumo.respostas === 1 ? 'resposta' : 'respostas'} de {resumo.enviadas}{' '}
          {resumo.enviadas === 1 ? 'pesquisa enviada' : 'pesquisas enviadas'} · taxa de resposta{' '}
          {formatarTaxa(resumo.taxaResposta)}
        </p>
      </div>

      {resumo.respostas > 0 && (
        <>
          {/* Decorativa: os números ao lado dizem o mesmo em texto. */}
          <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            <span className="bg-emerald-500" style={{ width: `${fatias.promotor}%` }} />
            <span className="bg-slate-400" style={{ width: `${fatias.neutro}%` }} />
            <span className="bg-marca-600" style={{ width: `${fatias.detrator}%` }} />
          </div>
          <ul aria-label="Distribuição das notas" className="grid grid-cols-3 gap-2 text-sm">
            <Fatia cor="bg-emerald-500" rotulo="Promotores (9–10)" quantidade={resumo.promotores} pct={fatias.promotor} />
            <Fatia cor="bg-slate-400" rotulo="Neutros (7–8)" quantidade={resumo.neutros} pct={fatias.neutro} />
            <Fatia cor="bg-marca-600" rotulo="Detratores (0–6)" quantidade={resumo.detratores} pct={fatias.detrator} />
          </ul>
        </>
      )}
    </div>
  );
}

function Fatia({ cor, rotulo, quantidade, pct }: { cor: string; rotulo: string; quantidade: number; pct: number }) {
  return (
    <li>
      <span className="flex items-center gap-1.5 text-slate-600">
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${cor}`} />
        {rotulo}
      </span>
      <span className="font-semibold tabular-nums text-slate-900">
        {quantidade} ({pct}%)
      </span>
    </li>
  );
}
