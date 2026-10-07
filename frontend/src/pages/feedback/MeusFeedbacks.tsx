import { Link, useLocation } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { classesDeBotao } from '@/components/classesDeBotao';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { Selo } from '@/components/Selo';
import { AppShell } from '@/layouts/AppShell';
import { useSessao } from '@/auth/useSessao';
import { useRecurso } from '@/lib/useRecurso';
import { ondeFoi, quandoFoiEnviado } from '@/feedback/formato';
import { listarFeedbacksDoPaciente } from '@/feedback/feedbackApi';

const AVISOS: Record<string, string> = {
  enviado: 'Enviado! Seu nutricionista foi avisado e vai responder por aqui.',
};

/**
 * RF-06 do lado do paciente: os relatos enviados e, quando o nutricionista
 * resolve (fluxo 3.5 passo 6), a resposta dele.
 */
export function MeusFeedbacks() {
  const { sessao } = useSessao();
  const local = useLocation();
  const patientId = sessao?.usuarioId ?? null;
  // O `!` só roda com a chave preenchida, e a chave só existe com sessão.
  const feedbacks = useRecurso(patientId && `feedbacks:${patientId}`, (sinal) =>
    listarFeedbacksDoPaciente(patientId!, sinal),
  );

  if (!sessao) return null;

  const aviso = AVISOS[(local.state as { aviso?: string } | null)?.aviso ?? ''];

  return (
    <AppShell
      titulo="Feedback"
      acoes={
        <Link to="/feedback/novo" className={classesDeBotao()}>
          Reportar problema
        </Link>
      }
    >
      <div className="space-y-4">
        {aviso && <Alerta tom="sucesso">{aviso}</Alerta>}

        {feedbacks.estado.situacao === 'carregando' && <Carregando rotulo="Carregando seus relatos…" />}
        {feedbacks.estado.situacao === 'erro' && <Alerta>{feedbacks.estado.mensagem}</Alerta>}

        {feedbacks.estado.situacao === 'pronto' && feedbacks.estado.dados.length === 0 && (
          <EstadoVazio titulo="Nenhum relato ainda">
            Se tiver dificuldade com alguma refeição — alergia, falta de ingrediente ou algo que não gostou —, conte
            ao seu nutricionista pelo botão “Reportar problema”.
          </EstadoVazio>
        )}

        {feedbacks.estado.situacao === 'pronto' && feedbacks.estado.dados.length > 0 && (
          <ul aria-label="Seus relatos" className="space-y-3">
            {feedbacks.estado.dados.map((feedback) => (
              <li key={feedback.id} className="cartao space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{ondeFoi(feedback)}</p>
                    <p className="text-sm text-slate-600">Enviado em {quandoFoiEnviado(feedback)}</p>
                  </div>
                  {feedback.status === 'pendente' ? (
                    <Selo tom="aviso">Aguardando resposta</Selo>
                  ) : (
                    <Selo tom="sucesso">Respondido</Selo>
                  )}
                </div>

                <p className="whitespace-pre-line text-slate-900">{feedback.descricao}</p>

                {feedback.status === 'resolvido' && (
                  <div className="rounded-xl border-l-4 border-marca-500 bg-marca-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-marca-800">
                      Resposta do nutricionista
                    </p>
                    <p className="mt-1 whitespace-pre-line text-slate-900">
                      {feedback.resposta ?? 'Seu nutricionista analisou o relato. Confira o seu plano.'}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
