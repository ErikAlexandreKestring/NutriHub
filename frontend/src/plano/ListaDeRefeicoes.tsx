import { formatarGramas, formatarHorario, formatarKcal } from '@/lib/formato';
import { kcalDaRefeicao } from './calculos';
import type { Refeicao } from './tipos';

/** RF-05: "visualizando refeições do dia". Ordenadas por horário pelo backend. */
export function ListaDeRefeicoes({ refeicoes }: { refeicoes: Refeicao[] }) {
  return (
    <ol className="space-y-4">
      {refeicoes.map((refeicao) => (
        <li key={refeicao.id} className="overflow-hidden rounded-xl ring-1 ring-inset ring-slate-200">
          <div className="flex items-baseline justify-between gap-3 bg-white px-4 py-3">
            <h3 className="font-semibold text-slate-900">
              <span className="tabular-nums text-marca-800">{formatarHorario(refeicao.horario)}</span>{' '}
              <span className="ml-1">{refeicao.nome}</span>
            </h3>
            <span className="shrink-0 text-sm text-slate-600">{formatarKcal(kcalDaRefeicao(refeicao))}</span>
          </div>

          {refeicao.items.length === 0 ? (
            <p className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              Nenhum alimento nesta refeição.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-200">
              {refeicao.items.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-slate-800">{item.food_nome}</span>
                  <span className="shrink-0 tabular-nums text-slate-600">
                    {formatarGramas(item.quantidade_g)} · {formatarKcal(item.kcal)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
