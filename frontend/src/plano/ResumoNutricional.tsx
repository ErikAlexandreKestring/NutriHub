import { formatarGramas, formatarKcal } from '@/lib/formato';
import type { Totais } from './tipos';

function Metrica({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-inset ring-slate-200">
      <dt className="text-xs text-slate-600">{rotulo}</dt>
      <dd className={`mt-0.5 font-semibold ${destaque ? 'text-marca-800' : 'text-slate-900'}`}>{valor}</dd>
    </div>
  );
}

/**
 * RF-05: "metas calóricas". A meta vem do nutricionista (`meta_kcal`) e o
 * previsto é a soma dos itens do plano — são números distintos, e mostrá-los
 * lado a lado é o ponto da tela. Quando não há meta definida, só o previsto
 * aparece: inventar uma meta igual ao previsto esconderia a diferença.
 */
export function ResumoNutricional({ totais, metaKcal }: { totais: Totais; metaKcal: string | null }) {
  const meta = metaKcal === null ? null : Number(metaKcal);
  const temMeta = meta !== null && Number.isFinite(meta);
  const diferenca = temMeta ? Math.round(totais.kcal - meta) : 0;

  return (
    <section aria-labelledby="resumo-titulo" className="rounded-xl bg-slate-50 p-4">
      <h2 id="resumo-titulo" className="text-sm font-semibold text-slate-800">
        Resumo do dia
      </h2>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {temMeta && <Metrica rotulo="Meta diária" valor={formatarKcal(meta)} destaque />}
        <Metrica rotulo="Previsto no plano" valor={formatarKcal(totais.kcal)} />
        <Metrica rotulo="Proteínas" valor={formatarGramas(totais.proteina_g)} />
        <Metrica rotulo="Carboidratos" valor={formatarGramas(totais.carb_g)} />
        <Metrica rotulo="Gorduras" valor={formatarGramas(totais.gordura_g)} />
      </dl>

      {temMeta && diferenca !== 0 && (
        <p className="mt-3 text-xs text-slate-600">
          {diferenca > 0
            ? `O plano está ${formatarKcal(diferenca)} acima da meta.`
            : `O plano está ${formatarKcal(Math.abs(diferenca))} abaixo da meta.`}
        </p>
      )}
    </section>
  );
}
