import { formatarHorario, formatarKcal, formatarQuantidade } from '@/lib/formato';
import { kcalDaRefeicao } from './calculos';
import { iconeDaRefeicao } from './iconeDaRefeicao';
import type { Refeicao } from './tipos';

/**
 * RF-05: "visualizando refeições do dia". Ordenadas por horário pelo backend.
 * Um cartão por refeição, como nos mockups "Plano de hoje" e "Almoço": emoji,
 * horário, kcal em destaque e os alimentos com a quantidade prescrita.
 */
export function ListaDeRefeicoes({ refeicoes }: { refeicoes: Refeicao[] }) {
  return (
    <ol className="space-y-3">
      {refeicoes.map((refeicao) => (
        <li key={refeicao.id} className="cartao overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-marca-50 text-xl">
              {iconeDaRefeicao(refeicao.nome)}
            </span>
            <h3 className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-900">{refeicao.nome}</span>
              <span className="block text-sm tabular-nums text-slate-600">{formatarHorario(refeicao.horario)}</span>
            </h3>
            <span className="shrink-0 font-semibold tabular-nums text-marca-700">
              {formatarKcal(kcalDaRefeicao(refeicao))}
            </span>
          </div>

          {refeicao.items.length === 0 ? (
            <p className="border-t border-black/5 px-4 py-3 text-sm text-slate-600">Nenhum alimento nesta refeição.</p>
          ) : (
            <ul className="divide-y divide-black/5 border-t border-black/5">
              {refeicao.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  {/* Quantidade embaixo do nome: os nomes da TACO são longos
                      ("Ovo, de galinha, inteiro, cozido") e espremê-los numa
                      coluna estreita no celular quebrava palavra por palavra. */}
                  <span className="min-w-0">
                    <span className="block text-slate-900">{item.food_nome}</span>
                    <span className="block text-sm tabular-nums text-slate-600">{formatarQuantidade(item)}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-marca-700">{formatarKcal(item.kcal)}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
