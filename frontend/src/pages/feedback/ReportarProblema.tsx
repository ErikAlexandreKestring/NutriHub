import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { AreaDeTexto } from '@/components/AreaDeTexto';
import { Botao } from '@/components/Botao';
import { classesDeBotao } from '@/components/classesDeBotao';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { OpcaoEmPilula } from '@/components/OpcaoEmPilula';
import { Selecao } from '@/components/Selecao';
import { AppShell } from '@/layouts/AppShell';
import { useSessao } from '@/auth/useSessao';
import { formatarHorario } from '@/lib/formato';
import { useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import { enviarFeedback, montarDescricao, TIPOS_DE_PROBLEMA, type TipoDeProblema } from '@/feedback/feedbackApi';
import { iconeDaRefeicao } from '@/plano/iconeDaRefeicao';
import { usePlanoAtivo } from '@/plano/usePlanoAtivo';

const CAMPOS = ['meal_id', 'tipo', 'descricao'] as const;
const MAX_DESCRICAO = 1000;

// Exemplos no espaço do texto, como o "Sou alérgica a camarão…" do mockup.
const EXEMPLOS: Record<TipoDeProblema, string> = {
  Alergia: 'Ex.: sou alérgica a camarão.',
  'Falta de ingrediente': 'Ex.: não encontrei aveia no mercado.',
  'Não gostei': 'Ex.: não consigo comer fígado.',
  Outro: 'Conte o que está acontecendo.',
};

/**
 * RF-06, fluxo 3.5 passos 1-2 (mockup "Reportar problema"): o paciente escolhe
 * a refeição, o tipo de problema, descreve e envia. O nutricionista é avisado
 * por e-mail e WhatsApp pelo backend.
 */
export function ReportarProblema() {
  const { sessao } = useSessao();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const plano = usePlanoAtivo(sessao?.usuarioId ?? null);

  // Vindo do botão de uma refeição no "Meu plano", ela já chega escolhida.
  const [refeicaoEscolhida, setRefeicao] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoDeProblema | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha, definirErrosDeCampo } =
    useErrosDeFormulario(CAMPOS);

  if (!sessao) return null;
  const patientId = sessao.usuarioId;

  const refeicoes = plano.situacao === 'pronto' ? plano.plano.meals : [];
  const daUrl = parametros.get('refeicao');
  const refeicao = refeicaoEscolhida ?? (refeicoes.some((r) => r.id === daUrl) ? daUrl! : '');

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    limpar();

    const erros: Partial<Record<(typeof CAMPOS)[number], string>> = {};
    if (!tipo) erros.tipo = 'Escolha o tipo de problema.';
    if (!texto.trim()) erros.descricao = 'Descreva a dificuldade.';
    if (!tipo || !texto.trim()) {
      definirErrosDeCampo(erros);
      return;
    }

    setEnviando(true);
    try {
      await enviarFeedback(patientId, {
        descricao: montarDescricao(tipo, texto),
        ...(refeicao ? { meal_id: refeicao } : {}),
      });
      navegar('/feedback', { state: { aviso: 'enviado' } });
    } catch (falha) {
      tratarFalha(falha, 'Não foi possível enviar. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <AppShell titulo="Reportar problema" voltar={{ para: '/meu-plano', rotulo: 'Meu plano' }}>
      {plano.situacao === 'carregando' && <Carregando rotulo="Carregando seu plano…" />}
      {plano.situacao === 'erro' && <Alerta>{plano.mensagem}</Alerta>}

      {/* O backend prende o relato ao plano vigente: sem plano, não há sobre o que reportar. */}
      {plano.situacao === 'sem-plano' && (
        <EstadoVazio titulo="Você ainda não tem um plano ativo">
          Quando seu nutricionista publicar um plano, você poderá contar aqui qualquer dificuldade com ele.
        </EstadoVazio>
      )}

      {plano.situacao === 'pronto' && (
        <form onSubmit={enviar} noValidate className="cartao space-y-6 p-6">
          {erroGeral && <Alerta>{erroGeral}</Alerta>}

          <Selecao
            rotulo="Refeição"
            value={refeicao}
            onChange={(evento) => setRefeicao(evento.target.value)}
            erro={errosPorCampo.meal_id}
            ref={registrar('meal_id')}
          >
            <option value="">Plano em geral</option>
            {refeicoes.map((r) => (
              <option key={r.id} value={r.id}>
                {iconeDaRefeicao(r.nome)} {r.nome} — {formatarHorario(r.horario)}
              </option>
            ))}
          </Selecao>

          <fieldset
            ref={registrar('tipo')}
            tabIndex={-1}
            aria-describedby={errosPorCampo.tipo ? 'tipo-erro' : undefined}
            className="focus:outline-none"
          >
            <legend className="rotulo-campo">Tipo de problema</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {TIPOS_DE_PROBLEMA.map((opcao) => (
                <OpcaoEmPilula key={opcao} nome="tipo" marcada={tipo === opcao} aoMarcar={() => setTipo(opcao)}>
                  {opcao}
                </OpcaoEmPilula>
              ))}
            </div>
            {errosPorCampo.tipo && (
              <p id="tipo-erro" className="mt-1 text-sm text-red-700">
                {errosPorCampo.tipo}
              </p>
            )}
          </fieldset>

          <AreaDeTexto
            rotulo="Descrição"
            placeholder={tipo ? EXEMPLOS[tipo] : 'Conte o que está acontecendo.'}
            value={texto}
            // O tipo entra no começo do texto enviado; o limite do backend vale para o todo.
            maxLength={MAX_DESCRICAO - 30}
            onChange={(evento) => setTexto(evento.target.value)}
            erro={errosPorCampo.descricao}
            ref={registrar('descricao')}
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Botao type="submit" carregando={enviando} className="sm:flex-1">
              Enviar para nutricionista
            </Botao>
            <Link to="/meu-plano" className={classesDeBotao('secundario')}>
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </AppShell>
  );
}
