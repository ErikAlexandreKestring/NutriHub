import { Link } from 'react-router-dom';
import { classesDeBotao } from '@/components/classesDeBotao';
import { useRecurso } from '@/lib/useRecurso';
import { buscarPesquisaPendente } from './npsApi';

/**
 * UC-07 dentro da PWA: o e-mail é o convite principal, mas quem não abriu o
 * e-mail encontra a pesquisa aqui. Silencioso por desenho — sem pesquisa, ou
 * se a busca falhar, não aparece nada: o convite nunca atrapalha a tela.
 */
export function ConviteNps({ patientId }: { patientId: string }) {
  const { estado } = useRecurso(`nps:pendente:${patientId}`, (sinal) => buscarPesquisaPendente(patientId, sinal));

  if (estado.situacao !== 'pronto' || !estado.dados) return null;

  return (
    <section
      aria-labelledby="convite-nps-titulo"
      className="flex flex-col gap-3 rounded-2xl bg-marca-50 p-4 ring-1 ring-inset ring-marca-100 sm:flex-row sm:items-center"
    >
      <div className="flex-1">
        <h2 id="convite-nps-titulo" className="font-semibold text-slate-900">
          Como está sendo o seu acompanhamento?
        </h2>
        <p className="text-sm text-slate-700">Um ciclo do seu plano terminou. Responder leva menos de um minuto.</p>
      </div>
      <Link to="/avaliar" className={classesDeBotao()}>
        Avaliar
      </Link>
    </section>
  );
}
