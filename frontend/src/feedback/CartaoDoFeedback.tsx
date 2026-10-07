import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { AreaDeTexto } from '@/components/AreaDeTexto';
import { Avatar } from '@/components/Avatar';
import { Botao } from '@/components/Botao';
import { classesDeBotao } from '@/components/classesDeBotao';
import { Selo } from '@/components/Selo';
import { mensagemDeFalha } from '@/lib/useErrosDeFormulario';
import { resolverFeedback } from './feedbackApi';
import { ondeFoi, quandoFoiEnviado } from './formato';
import type { Feedback, FeedbackDoConsultorio } from './tipos';

const MAX_RESPOSTA = 1000;

/**
 * RF-06, fluxo 3.5 passos 5-6, do lado do nutricionista: lê o relato, abre o
 * paciente para ajustar o plano e marca como resolvido — com uma resposta
 * opcional, que é o que o paciente lê no app e recebe na notificação.
 */
export function CartaoDoFeedback({
  feedback,
  aoResolver,
}: {
  feedback: FeedbackDoConsultorio;
  aoResolver: (resolvido: Feedback) => void;
}) {
  const id = useId();
  const [respondendo, setRespondendo] = useState(false);
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function resolver() {
    setErro(null);
    setEnviando(true);
    try {
      aoResolver(await resolverFeedback(feedback.id, resposta));
    } catch (falha) {
      setErro(mensagemDeFalha(falha, 'Não foi possível resolver o feedback.'));
      setEnviando(false);
    }
  }

  const pendente = feedback.status === 'pendente';

  return (
    <li className="cartao space-y-3 p-4" aria-labelledby={`${id}-paciente`}>
      <div className="flex items-start gap-3">
        <Avatar nome={feedback.patient_nome} apagado={!pendente} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              id={`${id}-paciente`}
              to={`/pacientes/${feedback.patient_id}`}
              className="font-semibold text-slate-900 hover:underline"
            >
              {feedback.patient_nome}
            </Link>
            {pendente ? <Selo tom="aviso">Pendente</Selo> : <Selo tom="sucesso">Resolvido</Selo>}
            {/* E-17: o alerta não chegou por e-mail, então este cartão pode ser
                a primeira notícia que o nutricionista tem do relato. */}
            {feedback.notificacao_falhou && <Selo tom="marca">Notificação falhou</Selo>}
          </div>
          <p className="text-sm text-slate-600">
            {ondeFoi(feedback)} · {quandoFoiEnviado(feedback)}
          </p>
        </div>
      </div>

      {/* Texto livre do paciente: preserva as quebras de linha, nunca vira HTML. */}
      <p className="whitespace-pre-line text-slate-900">{feedback.descricao}</p>

      {!pendente && feedback.resposta && (
        <div className="rounded-xl border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Sua resposta</p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-900">{feedback.resposta}</p>
        </div>
      )}

      {erro && <Alerta>{erro}</Alerta>}

      {pendente &&
        (respondendo ? (
          <div className="space-y-3">
            <AreaDeTexto
              rotulo="Resposta ao paciente (opcional)"
              dica="O paciente vê esta resposta no app e recebe um aviso."
              value={resposta}
              maxLength={MAX_RESPOSTA}
              rows={3}
              onChange={(evento) => setResposta(evento.target.value)}
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <Botao onClick={resolver} carregando={enviando}>
                Marcar como resolvido
              </Botao>
              <Botao variante="secundario" onClick={() => setRespondendo(false)} disabled={enviando}>
                Voltar
              </Botao>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => setRespondendo(true)}>Responder e resolver</Botao>
            {/* Passo 5: o plano é ajustado a partir da ficha do paciente. */}
            <Link to={`/pacientes/${feedback.patient_id}`} className={classesDeBotao('secundario')}>
              Ajustar plano
            </Link>
          </div>
        ))}
    </li>
  );
}
