import { useId, useMemo, useState, type ReactNode } from 'react';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { ErroDaApi } from '@/lib/api';
import {
  diaDe,
  formatarDataHora,
  formatarDiaAbreviado,
  formatarDiaPorExtenso,
  formatarHora,
  hojeSemHora,
  somarDias,
} from '@/lib/formato';
import { mensagemDeFalha } from '@/lib/useErrosDeFormulario';
import { useRecurso } from '@/lib/useRecurso';
import { listarHorariosLivres } from './agendaApi';

/** Janela oferecida: duas semanas cobrem o retorno típico sem virar uma lista sem fim. */
const DIAS_A_FRENTE = 14;

interface SeletorDeHorarioProps {
  titulo: string;
  rotuloConfirmar: string;
  /** Rejeitar faz o seletor mostrar o erro e recarregar os horários. */
  aoConfirmar: (dataHora: string) => Promise<void>;
  aoFechar: () => void;
}

/**
 * Fluxo 3.4, passo 2 (e 3.6, passo 3B): mostra os horários livres da grade do
 * nutricionista, primeiro o dia e depois a hora. A lista é só uma oferta — o
 * backend revalida tudo ao confirmar, e entre uma coisa e outra outro paciente
 * pode ter ficado com o horário (E-12).
 */
export function SeletorDeHorario({ titulo, rotuloConfirmar, aoConfirmar, aoFechar }: SeletorDeHorarioProps) {
  const id = useId();
  const [de] = useState(hojeSemHora);
  const ate = somarDias(de, DIAS_A_FRENTE - 1);
  const horarios = useRecurso(`${de}:${ate}`, (sinal) => listarHorariosLivres(de, ate, sinal));

  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);
  const [horario, setHorario] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const porDia = useMemo(() => {
    const grupos = new Map<string, string[]>();
    if (horarios.estado.situacao !== 'pronto') return grupos;
    for (const { data_hora } of horarios.estado.dados) {
      const dia = diaDe(data_hora);
      grupos.set(dia, [...(grupos.get(dia) ?? []), data_hora]);
    }
    return grupos;
  }, [horarios.estado]);

  // Depois de recarregar, o dia escolhido pode ter ficado sem horário nenhum.
  const dia = diaEscolhido && porDia.has(diaEscolhido) ? diaEscolhido : (porDia.keys().next().value ?? null);
  const horariosDoDia = dia ? (porDia.get(dia) ?? []) : [];

  async function confirmar() {
    if (!horario) return;
    setErro(null);
    setEnviando(true);
    try {
      await aoConfirmar(horario);
    } catch (falha) {
      setErro(mensagemDeFalha(falha, 'Não foi possível confirmar o horário.'));
      // E-10/E-11/E-12: o horário deixou de valer. Recarregar tira da tela o
      // que já não pode ser escolhido, em vez de deixar a pessoa insistir.
      if (falha instanceof ErroDaApi) {
        setHorario(null);
        horarios.atualizar().catch(() => undefined);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="cartao p-4">
      <h3 id={`${id}-titulo`} className="font-titulo text-2xl text-slate-900">
        {titulo}
      </h3>

      <div className="mt-3 space-y-4">
        {horarios.estado.situacao === 'carregando' && <Carregando rotulo="Buscando horários livres…" />}
        {horarios.estado.situacao === 'erro' && <Alerta>{horarios.estado.mensagem}</Alerta>}

        {horarios.estado.situacao === 'pronto' && porDia.size === 0 && (
          <EstadoVazio titulo="Nenhum horário livre nas próximas duas semanas">
            Novos horários aparecem quando a grade de atendimento é ampliada ou uma consulta é cancelada.
          </EstadoVazio>
        )}

        {dia && (
          <>
            <fieldset>
              <legend className="rotulo-campo">Dia</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[...porDia.entries()].map(([chave, lista]) => (
                  <Opcao
                    key={chave}
                    nome={`${id}-dia`}
                    rotuloAcessivel={formatarDiaPorExtenso(lista[0])}
                    marcada={chave === dia}
                    aoMarcar={() => {
                      setDiaEscolhido(chave);
                      setHorario(null);
                    }}
                  >
                    {formatarDiaAbreviado(lista[0])}
                  </Opcao>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="rotulo-campo">
                Horário em {formatarDiaPorExtenso(horariosDoDia[0]).toLowerCase()}
              </legend>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {horariosDoDia.map((iso) => (
                  <Opcao key={iso} nome={`${id}-hora`} marcada={iso === horario} aoMarcar={() => setHorario(iso)}>
                    {formatarHora(iso)}
                  </Opcao>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {erro && <Alerta>{erro}</Alerta>}

        {horario && (
          <p className="text-sm text-slate-700" aria-live="polite">
            Horário escolhido: <strong className="font-semibold text-slate-900">{formatarDataHora(horario)}</strong>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {porDia.size > 0 && (
            <Botao onClick={confirmar} disabled={!horario} carregando={enviando}>
              {rotuloConfirmar}
            </Botao>
          )}
          <Botao variante="secundario" onClick={aoFechar} disabled={enviando}>
            Voltar
          </Botao>
        </div>
      </div>
    </section>
  );
}

/**
 * Radio nativo com cara de botão: teclado (setas) e leitor de tela funcionam
 * como num grupo de rádio comum, sem ARIA feito à mão.
 */
function Opcao({
  nome,
  marcada,
  aoMarcar,
  rotuloAcessivel,
  children,
}: {
  nome: string;
  marcada: boolean;
  aoMarcar: () => void;
  rotuloAcessivel?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <input
        type="radio"
        name={nome}
        className="peer sr-only"
        checked={marcada}
        onChange={aoMarcar}
        aria-label={rotuloAcessivel}
      />
      <span className="flex min-h-toque min-w-toque cursor-pointer items-center justify-center rounded-full bg-white px-4 text-sm font-medium text-slate-800 ring-1 ring-inset ring-black/10 hover:bg-marca-50 peer-checked:bg-marca-600 peer-checked:text-white peer-checked:ring-marca-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marca-700">
        {children}
      </span>
    </label>
  );
}
