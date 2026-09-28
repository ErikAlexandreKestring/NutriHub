import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { classesDeBotao } from '@/components/classesDeBotao';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { AppShell } from '@/layouts/AppShell';
import { diaDe, formatarDiaPorExtenso } from '@/lib/formato';
import { useRecurso } from '@/lib/useRecurso';
import { listarConsultasDoConsultorio, listarDisponibilidade } from '@/agenda/agendaApi';
import { CartaoDaConsulta } from '@/agenda/CartaoDaConsulta';
import type { ConsultaDoConsultorio } from '@/agenda/tipos';

function agruparPorDia(consultas: ConsultaDoConsultorio[]): Array<[string, ConsultaDoConsultorio[]]> {
  const grupos = new Map<string, ConsultaDoConsultorio[]>();
  for (const consulta of consultas) {
    const dia = diaDe(consulta.data_hora);
    grupos.set(dia, [...(grupos.get(dia) ?? []), consulta]);
  }
  return [...grupos.entries()];
}

/**
 * RF-08/11/12: consultas confirmadas do consultório de hoje em diante, dia a
 * dia. O nutricionista cancela ou remarca qualquer uma a qualquer momento.
 */
export function AgendaDoNutricionista() {
  const consultas = useRecurso('agenda', listarConsultasDoConsultorio);
  const grade = useRecurso('grade', listarDisponibilidade);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function aoAlterar(mensagem: string) {
    setErro(null);
    setAviso(mensagem);
    try {
      await consultas.atualizar();
    } catch {
      setErro('A alteração foi salva, mas não foi possível atualizar a lista. Recarregue a página.');
    }
  }

  const semGrade = grade.estado.situacao === 'pronto' && grade.estado.dados.length === 0;

  return (
    <AppShell
      titulo="Agenda"
      acoes={
        <Link to="/agenda/horarios" className={classesDeBotao('secundario')}>
          Horários de atendimento
        </Link>
      }
    >
      <div className="space-y-6">
        {semGrade && (
          <Alerta tom="aviso">
            Você ainda não cadastrou horários de atendimento, então seus pacientes não conseguem agendar.{' '}
            <Link to="/agenda/horarios" className="font-semibold underline">
              Cadastrar horários
            </Link>
          </Alerta>
        )}
        {aviso && <Alerta tom="sucesso">{aviso}</Alerta>}
        {erro && <Alerta>{erro}</Alerta>}

        {consultas.estado.situacao === 'carregando' && <Carregando rotulo="Carregando agenda…" />}
        {consultas.estado.situacao === 'erro' && <Alerta>{consultas.estado.mensagem}</Alerta>}

        {consultas.estado.situacao === 'pronto' && consultas.estado.dados.length === 0 && (
          <EstadoVazio titulo="Nenhuma consulta agendada">
            As consultas que seus pacientes marcarem pelo app aparecem aqui.
          </EstadoVazio>
        )}

        {consultas.estado.situacao === 'pronto' &&
          agruparPorDia(consultas.estado.dados).map(([dia, doDia]) => (
            <section key={dia} aria-labelledby={`dia-${dia}`}>
              <h2 id={`dia-${dia}`} className="mb-3 font-titulo text-2xl text-slate-900">
                {formatarDiaPorExtenso(doDia[0].data_hora)}
              </h2>
              <ul className="space-y-3">
                {doDia.map((consulta) => (
                  <CartaoDaConsulta
                    key={consulta.id}
                    consulta={consulta}
                    nomeDoPaciente={consulta.patient_nome}
                    titulo={
                      <Link to={`/pacientes/${consulta.patient_id}`} className="hover:underline">
                        {consulta.patient_nome}
                      </Link>
                    }
                    aoAlterar={aoAlterar}
                  />
                ))}
              </ul>
            </section>
          ))}
      </div>
    </AppShell>
  );
}
