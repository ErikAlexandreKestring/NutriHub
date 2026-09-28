import { useState, type ReactNode } from 'react';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Selo } from '@/components/Selo';
import { ehFutura, formatarDataHora, formatarHora, partesDaData } from '@/lib/formato';
import { mensagemDeFalha } from '@/lib/useErrosDeFormulario';
import { cancelarConsulta, remarcarConsulta } from './agendaApi';
import { SeletorDeHorario } from './SeletorDeHorario';
import type { Consulta } from './tipos';

interface CartaoDaConsultaProps {
  consulta: Consulta;
  /** Na agenda do nutricionista: de quem é a consulta. */
  nomeDoPaciente?: string;
  /** Linha principal do cartão; sem ela, a data e a hora por extenso. */
  titulo?: ReactNode;
  /** Chamado depois de cancelar ou remarcar, com o aviso para a tela mostrar. */
  aoAlterar: (aviso: string) => void;
}

/**
 * RF-11/RF-12 para os dois papéis: o backend decide o que cada um pode (RN-10
 * vale só para o paciente), então o cartão oferece as mesmas ações e mostra o
 * erro que vier — E-19 já traz a orientação de falar com o nutricionista.
 */
export function CartaoDaConsulta({ consulta, nomeDoPaciente, titulo, aoAlterar }: CartaoDaConsultaProps) {
  const [remarcando, setRemarcando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const quando = formatarDataHora(consulta.data_hora);
  const futura = ehFutura(consulta.data_hora);

  async function cancelar() {
    const pergunta = nomeDoPaciente
      ? `Cancelar a consulta de ${nomeDoPaciente} em ${quando}? O horário volta a ficar livre na agenda.`
      : `Cancelar sua consulta de ${quando}?`;
    if (!window.confirm(pergunta)) return;

    setErro(null);
    setCancelando(true);
    try {
      await cancelarConsulta(consulta.id);
      aoAlterar(nomeDoPaciente ? `Consulta de ${nomeDoPaciente} cancelada.` : 'Consulta cancelada.');
    } catch (falha) {
      setErro(mensagemDeFalha(falha, 'Não foi possível cancelar a consulta.'));
      setCancelando(false);
    }
  }

  async function remarcar(dataHora: string) {
    await remarcarConsulta(consulta.id, dataHora);
    setRemarcando(false);
    aoAlterar(`Consulta remarcada para ${formatarDataHora(dataHora)}.`);
  }

  return (
    <li className="cartao space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SeloDeData iso={consulta.data_hora} apagado={!futura} />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{titulo ?? quando}</p>
            {titulo && <p className="text-sm tabular-nums text-slate-600">{formatarHora(consulta.data_hora)}</p>}
          </div>
        </div>

        {futura ? (
          !remarcando && (
            <div className="flex flex-wrap gap-2">
              <Botao variante="secundario" onClick={() => setRemarcando(true)} disabled={cancelando}>
                Remarcar
              </Botao>
              <Botao variante="perigo" onClick={cancelar} carregando={cancelando}>
                Cancelar
              </Botao>
            </div>
          )
        ) : (
          <Selo>Horário já passou</Selo>
        )}
      </div>

      {erro && <Alerta>{erro}</Alerta>}

      {remarcando && (
        <SeletorDeHorario
          titulo="Escolha o novo horário"
          rotuloConfirmar="Confirmar novo horário"
          aoConfirmar={remarcar}
          aoFechar={() => setRemarcando(false)}
        />
      )}
    </li>
  );
}

/** Quadradinho "MAI / 26" do mockup "Próxima consulta". Decorativo: a data vem escrita ao lado. */
function SeloDeData({ iso, apagado }: { iso: string; apagado: boolean }) {
  const { mes, dia } = partesDaData(iso);
  return (
    <span
      aria-hidden="true"
      className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${
        apagado ? 'bg-slate-100 text-slate-600' : 'bg-marca-600 text-white'
      }`}
    >
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide">{mes}</span>
      <span className="mt-0.5 text-lg font-bold">{dia}</span>
    </span>
  );
}
