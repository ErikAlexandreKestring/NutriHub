import { Link } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Avatar } from '@/components/Avatar';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { Icone, type NomeDoIcone } from '@/components/Icone';
import { Selo } from '@/components/Selo';
import { AppShell } from '@/layouts/AppShell';
import { useSessao } from '@/auth/useSessao';
import { diaDe, ehFutura, formatarDiaAbreviado, formatarDiaPorExtenso, formatarHora, hojeSemHora } from '@/lib/formato';
import type { EstadoDoRecurso } from '@/lib/useRecurso';
import { useRecurso } from '@/lib/useRecurso';
import { listarConsultasDoConsultorio } from '@/agenda/agendaApi';
import { ondeFoi, quandoFoiEnviado } from '@/feedback/formato';
import { listarFeedbacksDoConsultorio } from '@/feedback/feedbackApi';
import { listarPacientes } from '@/pacientes/pacientesApi';

const QUANTOS_FEEDBACKS = 3;
const QUANTAS_CONSULTAS = 5;

/** O número do indicador, ou um traço enquanto carrega ou se falhou. */
function contar<T>(estado: EstadoDoRecurso<T[]>, filtro: (item: T) => boolean = () => true): string {
  return estado.situacao === 'pronto' ? String(estado.dados.filter(filtro).length) : '—';
}

/**
 * RF-10: o painel do nutricionista — pacientes ativos, feedbacks pendentes e
 * próximas consultas. É a tela de entrada do nutricionista. Cada bloco carrega
 * por conta própria: uma falha na agenda não esconde os feedbacks.
 */
export function Painel() {
  const { sessao } = useSessao();
  const pacientes = useRecurso('painel:pacientes', listarPacientes);
  const feedbacks = useRecurso('painel:feedbacks', (sinal) => listarFeedbacksDoConsultorio('pendente', sinal));
  const consultas = useRecurso('painel:consultas', listarConsultasDoConsultorio);

  const hoje = hojeSemHora();
  const primeiroNome = sessao?.nome.trim().split(/\s+/)[0] ?? '';
  // A agenda vem do início de hoje; a consulta que já passou hoje sai das "próximas".
  const proximas = consultas.estado.situacao === 'pronto' ? consultas.estado.dados.filter((c) => ehFutura(c.data_hora)) : [];

  return (
    <AppShell titulo={primeiroNome ? `Olá, ${primeiroNome}` : 'Painel'}>
      <div className="space-y-8">
        <p className="-mt-4 text-slate-600">{formatarDiaPorExtenso(new Date().toISOString())}</p>

        {pacientes.estado.situacao === 'erro' && <Alerta>{pacientes.estado.mensagem}</Alerta>}

        <section aria-label="Resumo">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Indicador
              para="/pacientes"
              icone="pessoas"
              valor={contar(pacientes.estado, (p) => p.status === 'ativo')}
              rotulo="Pacientes ativos"
            />
            <Indicador
              para="/feedbacks"
              icone="balao"
              valor={contar(feedbacks.estado)}
              rotulo="Feedbacks pendentes"
              destaque={feedbacks.estado.situacao === 'pronto' && feedbacks.estado.dados.length > 0}
            />
            <Indicador
              para="/agenda"
              icone="calendario"
              valor={contar(consultas.estado, (c) => diaDe(c.data_hora) === hoje)}
              rotulo="Consultas hoje"
            />
          </ul>
        </section>

        <section aria-labelledby="feedbacks-titulo">
          <CabecalhoDaSecao id="feedbacks-titulo" titulo="Feedbacks pendentes" para="/feedbacks" rotuloDoLink="Ver todos" />
          {feedbacks.estado.situacao === 'carregando' && <Carregando rotulo="Carregando feedbacks…" />}
          {feedbacks.estado.situacao === 'erro' && <Alerta>{feedbacks.estado.mensagem}</Alerta>}
          {feedbacks.estado.situacao === 'pronto' &&
            (feedbacks.estado.dados.length === 0 ? (
              <EstadoVazio titulo="Nenhum feedback pendente">Seus pacientes não relataram dificuldades.</EstadoVazio>
            ) : (
              <ul className="space-y-2">
                {feedbacks.estado.dados.slice(0, QUANTOS_FEEDBACKS).map((feedback) => (
                  <li key={feedback.id}>
                    <Link to="/feedbacks" className="cartao flex items-start gap-3 p-4 hover:bg-creme">
                      <Avatar nome={feedback.patient_nome} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{feedback.patient_nome}</span>
                          {feedback.notificacao_falhou && <Selo tom="marca">Notificação falhou</Selo>}
                        </span>
                        <span className="block text-sm text-slate-600">
                          {ondeFoi(feedback)} · {quandoFoiEnviado(feedback)}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-sm text-slate-800">{feedback.descricao}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
        </section>

        <section aria-labelledby="consultas-titulo">
          <CabecalhoDaSecao id="consultas-titulo" titulo="Próximas consultas" para="/agenda" rotuloDoLink="Ver agenda" />
          {consultas.estado.situacao === 'carregando' && <Carregando rotulo="Carregando agenda…" />}
          {consultas.estado.situacao === 'erro' && <Alerta>{consultas.estado.mensagem}</Alerta>}
          {consultas.estado.situacao === 'pronto' &&
            (proximas.length === 0 ? (
              <EstadoVazio titulo="Nenhuma consulta agendada">
                As consultas que seus pacientes marcarem aparecem aqui.
              </EstadoVazio>
            ) : (
              <ul className="cartao divide-y divide-black/5 overflow-hidden">
                {proximas.slice(0, QUANTAS_CONSULTAS).map((consulta) => (
                  <li key={consulta.id}>
                    <Link
                      to={`/pacientes/${consulta.patient_id}`}
                      className="flex min-h-toque items-center gap-3 px-4 py-3 hover:bg-creme"
                    >
                      <span className="w-24 shrink-0 text-sm tabular-nums text-slate-600">
                        {diaDe(consulta.data_hora) === hoje ? 'Hoje' : formatarDiaAbreviado(consulta.data_hora)}
                        <span className="block font-semibold text-slate-900">{formatarHora(consulta.data_hora)}</span>
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{consulta.patient_nome}</span>
                      <Icone nome="seta" className="h-4 w-4 shrink-0 text-slate-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
        </section>
      </div>
    </AppShell>
  );
}

function Indicador({
  para,
  icone,
  valor,
  rotulo,
  destaque = false,
}: {
  para: string;
  icone: NomeDoIcone;
  valor: string;
  rotulo: string;
  /** Feedback pendente pede ação: o cartão fica em coral. */
  destaque?: boolean;
}) {
  return (
    <li>
      <Link
        to={para}
        className={`flex items-center gap-4 rounded-2xl p-4 ring-1 ring-inset transition ${
          destaque ? 'bg-marca-600 text-white ring-marca-600 hover:bg-marca-700' : 'bg-white ring-black/5 hover:bg-creme'
        }`}
      >
        <span
          aria-hidden="true"
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
            destaque ? 'bg-white/15' : 'bg-marca-50 text-marca-700'
          }`}
        >
          <Icone nome={icone} />
        </span>
        <span>
          <span className="block font-titulo text-4xl leading-none tabular-nums">{valor}</span>
          <span className={`mt-1 block text-sm ${destaque ? 'text-white' : 'text-slate-600'}`}>{rotulo}</span>
        </span>
      </Link>
    </li>
  );
}

function CabecalhoDaSecao({
  id,
  titulo,
  para,
  rotuloDoLink,
}: {
  id: string;
  titulo: string;
  para: string;
  rotuloDoLink: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 id={id} className="font-titulo text-3xl text-slate-900">
        {titulo}
      </h2>
      <Link
        to={para}
        className="inline-flex min-h-toque items-center gap-1 text-sm font-semibold text-marca-700 hover:underline"
      >
        {rotuloDoLink}
        <Icone nome="seta" className="h-4 w-4" />
      </Link>
    </div>
  );
}
