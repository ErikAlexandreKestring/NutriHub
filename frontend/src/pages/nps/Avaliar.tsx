import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { AreaDeTexto } from '@/components/AreaDeTexto';
import { Botao } from '@/components/Botao';
import { classesDeBotao } from '@/components/classesDeBotao';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { OpcaoEmPilula } from '@/components/OpcaoEmPilula';
import { AppShell } from '@/layouts/AppShell';
import { useSessao } from '@/auth/useSessao';
import { useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import { useRecurso } from '@/lib/useRecurso';
import { buscarPesquisaPendente, responderPesquisa } from '@/nps/npsApi';

const CAMPOS = ['nota', 'comentario'] as const;
const NOTAS = Array.from({ length: 11 }, (_, nota) => nota);
const MAX_COMENTARIO = 1000;

/**
 * UC-07: o paciente chega pelo link do e-mail (ou pelo convite na aba
 * Feedback), avalia de 0 a 10 e, se quiser, comenta.
 */
export function Avaliar() {
  const { sessao } = useSessao();
  const patientId = sessao?.usuarioId ?? null;
  const pesquisa = useRecurso(patientId && `nps:pendente:${patientId}`, (sinal) =>
    buscarPesquisaPendente(patientId!, sinal),
  );

  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha, definirErrosDeCampo } =
    useErrosDeFormulario(CAMPOS);

  if (!sessao) return null;
  const aberta = pesquisa.estado.situacao === 'pronto' ? pesquisa.estado.dados : null;

  async function enviar(evento: FormEvent, pesquisaId: string) {
    evento.preventDefault();
    limpar();

    if (nota === null) {
      definirErrosDeCampo({ nota: 'Escolha uma nota de 0 a 10.' });
      return;
    }

    setEnviando(true);
    try {
      const texto = comentario.trim();
      await responderPesquisa(sessao!.usuarioId, pesquisaId, { nota, ...(texto ? { comentario: texto } : {}) });
      setEnviada(true);
    } catch (falha) {
      tratarFalha(falha, 'Não foi possível enviar a avaliação. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AppShell titulo="Avaliar acompanhamento" voltar={{ para: '/feedback', rotulo: 'Feedback' }}>
      {pesquisa.estado.situacao === 'carregando' && <Carregando rotulo="Carregando a pesquisa…" />}
      {pesquisa.estado.situacao === 'erro' && <Alerta>{pesquisa.estado.mensagem}</Alerta>}

      {enviada && (
        <div className="cartao space-y-4 p-6 text-center">
          <p className="font-titulo text-2xl text-slate-900">Obrigado pela avaliação!</p>
          <p className="text-slate-700">Sua resposta ajuda seu nutricionista a melhorar o acompanhamento.</p>
          <Link to="/meu-plano" className={classesDeBotao()}>
            Voltar ao meu plano
          </Link>
        </div>
      )}

      {!enviada && pesquisa.estado.situacao === 'pronto' && !aberta && (
        <EstadoVazio titulo="Nenhuma avaliação pendente">
          Quando um ciclo do seu plano alimentar terminar, você recebe um convite por e-mail para avaliar o
          acompanhamento.
        </EstadoVazio>
      )}

      {!enviada && aberta && (
        <form onSubmit={(evento) => enviar(evento, aberta.id)} noValidate className="cartao space-y-6 p-6">
          {erroGeral && <Alerta>{erroGeral}</Alerta>}

          <fieldset
            ref={registrar('nota')}
            tabIndex={-1}
            aria-describedby={errosPorCampo.nota ? 'nota-erro escala-nota' : 'escala-nota'}
            className="focus:outline-none"
          >
            <legend className="rotulo-campo">
              De 0 a 10, quanto você recomendaria o seu nutricionista a um amigo ou familiar?
            </legend>
            <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-11">
              {NOTAS.map((valor) => (
                <OpcaoEmPilula
                  key={valor}
                  nome="nota"
                  marcada={nota === valor}
                  aoMarcar={() => setNota(valor)}
                  rotuloAcessivel={`Nota ${valor}`}
                >
                  {valor}
                </OpcaoEmPilula>
              ))}
            </div>
            <p id="escala-nota" className="mt-2 flex justify-between text-xs text-slate-600">
              <span>0 = nada provável</span>
              <span>10 = muito provável</span>
            </p>
            {errosPorCampo.nota && (
              <p id="nota-erro" className="mt-1 text-sm text-red-700">
                {errosPorCampo.nota}
              </p>
            )}
          </fieldset>

          <AreaDeTexto
            rotulo="Comentário (opcional)"
            placeholder="O que está funcionando e o que poderia melhorar?"
            value={comentario}
            maxLength={MAX_COMENTARIO}
            onChange={(evento) => setComentario(evento.target.value)}
            erro={errosPorCampo.comentario}
            ref={registrar('comentario')}
          />

          <Botao type="submit" carregando={enviando} className="w-full sm:w-auto">
            Enviar avaliação
          </Botao>
        </form>
      )}
    </AppShell>
  );
}
