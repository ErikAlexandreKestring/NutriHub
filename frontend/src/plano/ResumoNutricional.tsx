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
   * hoje"), com número grande, barra de meta e macros em pílulas. `claro`: os
   * blocos brancos do construtor.
   */
  variante?: 'claro' | 'destaque';
}

/**
 * RF-05: "metas calóricas". A meta vem do nutricionista (`meta_kcal`) e o
 * previsto é a soma dos itens do plano — são números distintos, e mostrá-los
 * lado a lado é o ponto da tela. Quando não há meta definida, só o previsto
 * aparece: inventar uma meta igual ao previsto esconderia a diferença.
 */
export function ResumoNutricional({ totais, metaKcal, previstoKcal, variante = 'claro' }: Props) {
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
    // Texto só em branco puro: sobre o marca-600 ele fica em 4,55:1 (AA); as
    // pílulas usam marca-700, que dá 5,6:1.
    const proporcao = temMeta && meta > 0 ? Math.min(previstoKcal / meta, 1) : null;
    return (
      <section aria-labelledby="resumo-titulo" className="mt-6">
        <h2 id="resumo-titulo" className="text-xs font-semibold uppercase tracking-wider text-white">
          Resumo do dia
        </h2>
        <dl className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <dt className="text-sm text-white">Previsto no plano</dt>
            <dd className="font-titulo text-5xl leading-none">{formatarKcal(previstoKcal)}</dd>
          </div>
          {temMeta && (
            <div>
              <dt className="text-sm text-white">Meta diária</dt>
              <dd className="font-titulo text-3xl leading-none">{formatarKcal(meta)}</dd>
            </div>
          )}
        </dl>

        {proporcao !== null && (
          <div aria-hidden="true" className="mt-4 h-2 overflow-hidden rounded-full bg-marca-800/60">
            <div className="h-full rounded-full bg-white" style={{ width: `${proporcao * 100}%` }} />
          </div>
        )}
        {mensagemDaDiferenca && <p className="mt-2 text-sm text-white">{mensagemDaDiferenca}</p>}

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
