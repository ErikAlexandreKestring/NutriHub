import { useState, type ReactNode } from 'react';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Selo } from '@/components/Selo';
import { ehFutura, formatarDataHora, formatarHora } from '@/lib/formato';
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
    <li className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{titulo ?? quando}</p>
          {titulo && <p className="text-sm text-slate-600">{formatarHora(consulta.data_hora)}</p>}
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
