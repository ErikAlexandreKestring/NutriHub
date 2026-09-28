import { useState, type FormEvent } from 'react';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { CampoDeHorario } from '@/components/CampoDeHorario';
import { Carregando } from '@/components/Estado';
import { Selecao } from '@/components/Selecao';
import { AppShell } from '@/layouts/AppShell';
import { formatarHorario, nomeDoDia } from '@/lib/formato';
import { mensagemDeFalha, useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import { useRecurso } from '@/lib/useRecurso';
import { criarDisponibilidade, listarDisponibilidade, removerDisponibilidade } from '@/agenda/agendaApi';
import type { DadosDaDisponibilidade, Disponibilidade } from '@/agenda/tipos';

const CAMPOS = ['day_of_week', 'start_time', 'end_time'] as const;

/** A semana de trabalho começa na segunda; domingo vai para o fim. */
const ORDEM_DOS_DIAS = [1, 2, 3, 4, 5, 6, 0];

const VAZIO: DadosDaDisponibilidade = { day_of_week: '1', start_time: '', end_time: '' };

/**
 * RF-08: a grade semanal de atendimento. É dela que saem os horários que o
 * paciente enxerga ao agendar (RN-08).
 */
export function HorariosDeAtendimento() {
  const grade = useRecurso('grade', listarDisponibilidade);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroDeAcao, setErroDeAcao] = useState<string | null>(null);

  async function aoAdicionar(dados: DadosDaDisponibilidade) {
    await criarDisponibilidade(dados);
    setErroDeAcao(null);
    setAviso(
      `Horário de ${nomeDoDia(Number(dados.day_of_week)).toLowerCase()}, ${dados.start_time}–${dados.end_time}, adicionado.`,
    );
    await grade.atualizar().catch(() => setErroDeAcao('Horário salvo, mas a lista não atualizou. Recarregue a página.'));
  }

  async function remover(intervalo: Disponibilidade) {
    const descricao = `${nomeDoDia(intervalo.day_of_week).toLowerCase()}, ${formatarHorario(intervalo.start_time)}–${formatarHorario(intervalo.end_time)}`;
    const confirmou = window.confirm(
      `Remover o horário de ${descricao}? Consultas já marcadas nesse horário continuam valendo.`,
    );
    if (!confirmou) return;

    setAviso(null);
    setErroDeAcao(null);
    try {
      await removerDisponibilidade(intervalo.id);
      setAviso(`Horário de ${descricao} removido.`);
      await grade.atualizar();
    } catch (falha) {
      setErroDeAcao(mensagemDeFalha(falha, 'Não foi possível remover o horário.'));
    }
  }

  return (
    <AppShell titulo="Horários de atendimento" voltar={{ para: '/agenda', rotulo: 'Agenda' }}>
      <div className="space-y-6">
        {aviso && <Alerta tom="sucesso">{aviso}</Alerta>}
        {erroDeAcao && <Alerta>{erroDeAcao}</Alerta>}

        <section aria-labelledby="grade-titulo" className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <h2 id="grade-titulo" className="font-semibold text-slate-900">
            Grade semanal
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Os pacientes escolhem consultas de 1 hora dentro de cada intervalo.
          </p>

          {grade.estado.situacao === 'carregando' && <Carregando rotulo="Carregando horários…" />}
          {grade.estado.situacao === 'erro' && (
            <div className="mt-4">
              <Alerta>{grade.estado.mensagem}</Alerta>
            </div>
          )}
          {grade.estado.situacao === 'pronto' && <GradeSemanal grade={grade.estado.dados} aoRemover={remover} />}
        </section>

        <NovoHorario aoAdicionar={aoAdicionar} />
      </div>
    </AppShell>
  );
}

function GradeSemanal({
  grade,
  aoRemover,
}: {
  grade: Disponibilidade[];
  aoRemover: (intervalo: Disponibilidade) => void;
}) {
  return (
    <dl className="mt-4 divide-y divide-slate-200">
      {ORDEM_DOS_DIAS.map((dia) => {
        const doDia = grade.filter((intervalo) => intervalo.day_of_week === dia);
        return (
          <div key={dia} className="flex flex-wrap items-start justify-between gap-2 py-3">
            <dt className="min-w-[8rem] pt-2.5 text-sm font-medium text-slate-800">{nomeDoDia(dia)}</dt>
            <dd className="flex-1">
              {doDia.length === 0 ? (
                <p className="pt-2.5 text-sm text-slate-600">Sem atendimento</p>
              ) : (
                <ul className="space-y-2">
                  {doDia.map((intervalo) => {
                    const faixa = `${formatarHorario(intervalo.start_time)}–${formatarHorario(intervalo.end_time)}`;
                    return (
                      <li key={intervalo.id} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-900">{faixa}</span>
                        <Botao
                          variante="perigo"
                          onClick={() => aoRemover(intervalo)}
                          aria-label={`Remover ${nomeDoDia(dia).toLowerCase()} ${faixa}`}
                        >
                          Remover
                        </Botao>
                      </li>
                    );
                  })}
                </ul>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function NovoHorario({ aoAdicionar }: { aoAdicionar: (dados: DadosDaDisponibilidade) => Promise<void> }) {
  const [dados, setDados] = useState<DadosDaDisponibilidade>(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha } = useErrosDeFormulario(CAMPOS);

  function alterar(campo: keyof DadosDaDisponibilidade, valor: string) {
    setDados((atuais) => ({ ...atuais, [campo]: valor }));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpar();
    setEnviando(true);
    try {
      await aoAdicionar(dados);
      // Mantém o dia: é comum cadastrar manhã e tarde do mesmo dia em sequência.
      setDados((atuais) => ({ ...VAZIO, day_of_week: atuais.day_of_week }));
    } catch (falha) {
      tratarFalha(falha, 'Não foi possível adicionar o horário.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-labelledby="novo-horario-titulo"
      className="rounded-xl bg-white p-6 ring-1 ring-slate-200"
    >
      <h2 id="novo-horario-titulo" className="font-semibold text-slate-900">
        Adicionar horário
      </h2>
      {erroGeral && (
        <div className="mt-3">
          <Alerta>{erroGeral}</Alerta>
        </div>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-start">
        <Selecao
          ref={registrar('day_of_week')}
          rotulo="Dia da semana"
          name="day_of_week"
          erro={errosPorCampo.day_of_week}
          value={dados.day_of_week}
          onChange={(e) => alterar('day_of_week', e.target.value)}
        >
          {ORDEM_DOS_DIAS.map((dia) => (
            <option key={dia} value={dia}>
              {nomeDoDia(dia)}
            </option>
          ))}
        </Selecao>
        <CampoDeHorario
          ref={registrar('start_time')}
          rotulo="Início"
          name="start_time"
          className="sm:w-36"
          erro={errosPorCampo.start_time}
          value={dados.start_time}
          onChange={(horario) => alterar('start_time', horario)}
        />
        <CampoDeHorario
          ref={registrar('end_time')}
          rotulo="Fim"
          name="end_time"
          className="sm:w-36"
          erro={errosPorCampo.end_time}
          value={dados.end_time}
          onChange={(horario) => alterar('end_time', horario)}
        />
        {/* O mt compensa a altura do rótulo, alinhando o botão aos inputs. */}
        <Botao type="submit" carregando={enviando} className="sm:mt-6">
          Adicionar
        </Botao>
      </div>
    </form>
  );
}
