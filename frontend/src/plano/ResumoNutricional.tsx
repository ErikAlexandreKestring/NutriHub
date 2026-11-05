import { formatarGramas, formatarKcal } from '@/lib/formato';
import type { Totais } from './tipos';

function Metrica({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-inset ring-black/5">
      <dt className="text-xs text-slate-600">{rotulo}</dt>
      <dd className={`mt-0.5 font-semibold ${destaque ? 'text-marca-700' : 'text-slate-900'}`}>{valor}</dd>
    </div>
  );
}

interface Props {
  totais: Totais;
  metaKcal: string | null;
  /** Soma dos subtotais exibidos nas refeições — ver plano/calculos. */
  previstoKcal: number;
  /**
   * `destaque`: dentro do cabeçalho coral do "Meu plano" (mockup "Plano de
   * hoje"), com o consumido do dia em destaque, barra de progresso e macros em
   * pílulas. `claro`: os
   * blocos brancos do construtor.
   */
  variante?: 'claro' | 'destaque';
  /**
   * UC-03: kcal das refeições que o paciente marcou como feitas hoje. Só no
   * `destaque`, onde a barra mostra o consumido contra a meta do dia.
   */
  consumidoKcal?: number;
}

const ALVO_META = { para: 'a meta diária', de: 'da meta diária' };
const ALVO_PREVISTO = { para: 'o previsto no plano', de: 'do previsto no plano' };

/** "Faltam 1.208 kcal para a meta diária." — o que a barra quer dizer, em texto. */
function mensagemDoConsumo(consumido: number, alvo: number, nome: typeof ALVO_META): string {
  if (consumido === 0) return 'Marque as refeições feitas para acompanhar o dia.';
  if (consumido < alvo) return `Faltam ${formatarKcal(alvo - consumido)} para ${nome.para}.`;
  if (consumido === alvo) return `Você completou ${nome.para}. Muito bem!`;
  return `Você passou ${formatarKcal(consumido - alvo)} ${nome.de}.`;
}

/**
 * RF-05: "metas calóricas". A meta vem do nutricionista (`meta_kcal`) e o
 * previsto é a soma dos itens do plano — são números distintos, e mostrá-los
 * lado a lado é o ponto da tela. Quando não há meta definida, só o previsto
 * aparece: inventar uma meta igual ao previsto esconderia a diferença.
 */
export function ResumoNutricional({ totais, metaKcal, previstoKcal, variante = 'claro', consumidoKcal }: Props) {
  const meta = metaKcal === null ? null : Number(metaKcal);
  const temMeta = meta !== null && Number.isFinite(meta);
  const diferenca = temMeta ? previstoKcal - meta : 0;
  const mensagemDaDiferenca =
    temMeta && diferenca !== 0
      ? diferenca > 0
        ? `O plano está ${formatarKcal(diferenca)} acima da meta.`
        : `O plano está ${formatarKcal(Math.abs(diferenca))} abaixo da meta.`
      : null;

  if (variante === 'destaque') {
    const consumido = consumidoKcal ?? 0;
    // A meta do nutricionista é o alvo do dia; sem meta, o previsto no plano.
    const alvo = temMeta && meta > 0 ? meta : previstoKcal;
    const nomeDoAlvo = temMeta ? ALVO_META : ALVO_PREVISTO;
    const proporcao = alvo > 0 ? Math.min(consumido / alvo, 1) : 0;
    return (
      <section aria-labelledby="resumo-titulo" className="mt-6">
        <h2 id="resumo-titulo" className="text-xs font-semibold uppercase tracking-wider text-white">
          Resumo do dia
        </h2>
        <dl className="mt-2">
          <dt className="text-sm text-white">Consumido hoje</dt>
          {/* aria-live: ao marcar uma refeição, o leitor de tela anuncia o novo total. */}
          <dd aria-live="polite" className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-titulo text-4xl leading-none">{formatarKcal(consumido)}</span>
            {alvo > 0 && <span className="text-sm text-white">de {formatarKcal(alvo)}</span>}
          </dd>
        </dl>

        {alvo > 0 && (
          <>
            <div aria-hidden="true" className="mt-3 h-3 overflow-hidden rounded-full bg-marca-800/60">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-500"
                style={{ width: `${proporcao * 100}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-white">{mensagemDoConsumo(consumido, alvo, nomeDoAlvo)}</p>
          </>
        )}

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white">
          <div className="flex gap-1.5">
            <dt>Previsto no plano</dt>
            <dd className="font-semibold">{formatarKcal(previstoKcal)}</dd>
          </div>
          {temMeta && (
            <div className="flex gap-1.5">
              <dt>Meta diária</dt>
              <dd className="font-semibold">{formatarKcal(meta)}</dd>
            </div>
          )}
        </dl>
        {mensagemDaDiferenca && <p className="mt-1 text-sm text-white">{mensagemDaDiferenca}</p>}

        <dl className="mt-4 flex flex-wrap gap-2 text-sm">
          {[
            ['Proteínas', totais.proteina_g],
            ['Carboidratos', totais.carb_g],
            ['Gorduras', totais.gordura_g],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="flex gap-1.5 rounded-full bg-marca-700 px-3 py-1">
              <dt>{rotulo}</dt>
              <dd className="font-semibold">{formatarGramas(valor)}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  return (
    <section aria-labelledby="resumo-titulo" className="rounded-2xl bg-white/60 p-4 ring-1 ring-inset ring-black/5">
      <h2 id="resumo-titulo" className="rotulo-campo">
        Resumo do dia
      </h2>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {temMeta && <Metrica rotulo="Meta diária" valor={formatarKcal(meta)} destaque />}
        <Metrica rotulo="Previsto no plano" valor={formatarKcal(previstoKcal)} />
        <Metrica rotulo="Proteínas" valor={formatarGramas(totais.proteina_g)} />
        <Metrica rotulo="Carboidratos" valor={formatarGramas(totais.carb_g)} />
        <Metrica rotulo="Gorduras" valor={formatarGramas(totais.gordura_g)} />
      </dl>

      {mensagemDaDiferenca && <p className="mt-3 text-xs text-slate-600">{mensagemDaDiferenca}</p>}
    </section>
  );
}
