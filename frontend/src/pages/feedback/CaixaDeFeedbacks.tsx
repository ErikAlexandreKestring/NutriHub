import { useState } from 'react';
import { Alerta } from '@/components/Alerta';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { OpcaoEmPilula } from '@/components/OpcaoEmPilula';
import { AppShell } from '@/layouts/AppShell';
import { useRecurso } from '@/lib/useRecurso';
import { CartaoDoFeedback } from '@/feedback/CartaoDoFeedback';
import { listarFeedbacksDoConsultorio } from '@/feedback/feedbackApi';
import type { FeedbackDoConsultorio, StatusDoFeedback } from '@/feedback/tipos';

type Filtro = StatusDoFeedback | 'todos';

const FILTROS: Array<{ valor: Filtro; rotulo: string }> = [
  { valor: 'pendente', rotulo: 'Pendentes' },
  { valor: 'resolvido', rotulo: 'Resolvidos' },
  { valor: 'todos', rotulo: 'Todos' },
];

const VAZIO: Record<Filtro, { titulo: string; texto: string }> = {
  pendente: {
    titulo: 'Nenhum feedback pendente',
    texto: 'Quando um paciente relatar uma dificuldade com o plano, ela aparece aqui.',
  },
  resolvido: { titulo: 'Nenhum feedback resolvido', texto: 'Os feedbacks que você resolver ficam guardados aqui.' },
  todos: { titulo: 'Nenhum feedback recebido', texto: 'Os relatos dos seus pacientes aparecem aqui.' },
};

/**
 * RF-06, fluxo 3.5 passos 5-6: a caixa de entrada do consultório. Abre nos
 * pendentes, que é o que pede ação; o backend já os devolve primeiro.
 */
export function CaixaDeFeedbacks() {
  const [filtro, setFiltro] = useState<Filtro>('pendente');
  const feedbacks = useRecurso(`feedbacks:${filtro}`, (sinal) =>
    listarFeedbacksDoConsultorio(filtro === 'todos' ? undefined : filtro, sinal),
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function aoResolver(feedback: FeedbackDoConsultorio) {
    setErro(null);
    setAviso(`Feedback de ${feedback.patient_nome} resolvido. O paciente será avisado.`);
    try {
      await feedbacks.atualizar();
    } catch {
      setErro('O feedback foi resolvido, mas não foi possível atualizar a lista. Recarregue a página.');
    }
  }

  function trocarFiltro(novo: Filtro) {
    setAviso(null);
    setErro(null);
    setFiltro(novo);
  }

  return (
    <AppShell titulo="Feedbacks">
      <div className="space-y-4">
        <fieldset>
          <legend className="sr-only">Mostrar</legend>
          <div className="flex flex-wrap gap-2">
            {FILTROS.map(({ valor, rotulo }) => (
              <OpcaoEmPilula key={valor} nome="filtro" marcada={filtro === valor} aoMarcar={() => trocarFiltro(valor)}>
                {rotulo}
              </OpcaoEmPilula>
            ))}
          </div>
        </fieldset>

        {aviso && <Alerta tom="sucesso">{aviso}</Alerta>}
        {erro && <Alerta>{erro}</Alerta>}

        {feedbacks.estado.situacao === 'carregando' && <Carregando rotulo="Carregando feedbacks…" />}
        {feedbacks.estado.situacao === 'erro' && <Alerta>{feedbacks.estado.mensagem}</Alerta>}

        {feedbacks.estado.situacao === 'pronto' && feedbacks.estado.dados.length === 0 && (
          <EstadoVazio titulo={VAZIO[filtro].titulo}>{VAZIO[filtro].texto}</EstadoVazio>
        )}

        {feedbacks.estado.situacao === 'pronto' && feedbacks.estado.dados.length > 0 && (
          <ul className="space-y-3">
            {feedbacks.estado.dados.map((feedback) => (
              <CartaoDoFeedback key={feedback.id} feedback={feedback} aoResolver={() => aoResolver(feedback)} />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
