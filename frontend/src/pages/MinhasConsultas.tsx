import { useState } from 'react';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { Selo } from '@/components/Selo';
import { AppShell } from '@/layouts/AppShell';
import { useSessao } from '@/auth/useSessao';
import { ehFutura, formatarDataHora } from '@/lib/formato';
import { useRecurso } from '@/lib/useRecurso';
import { agendarConsulta, listarConsultasDoPaciente } from '@/agenda/agendaApi';
import { CartaoDaConsulta } from '@/agenda/CartaoDaConsulta';
import { SeletorDeHorario } from '@/agenda/SeletorDeHorario';
import type { Consulta } from '@/agenda/tipos';

function ehProxima(consulta: Consulta): boolean {
  return consulta.status === 'confirmado' && ehFutura(consulta.data_hora);
}

/**
 * RF-08/11/12 do lado do paciente (fluxos 3.4 e 3.6): agendar num horário
 * livre da grade, e cancelar ou remarcar as próximas consultas.
 */
export function MinhasConsultas() {
  const { sessao } = useSessao();
  const patientId = sessao?.usuarioId ?? null;
  // O `!` só roda com a chave preenchida, e a chave só existe com sessão.
  const consultas = useRecurso(patientId && `consultas:${patientId}`, (sinal) =>
    listarConsultasDoPaciente(patientId!, sinal),
  );
  const [agendando, setAgendando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Ver MeuPlano: sem sessão a tela fica vazia e o roteador leva ao login.
  if (!sessao) return null;
  const idDoPaciente = sessao.usuarioId;

  async function aoAlterar(mensagem: string) {
    setErro(null);
    setAviso(mensagem);
    try {
      await consultas.atualizar();
    } catch {
      setErro('A alteração foi salva, mas não foi possível atualizar a lista. Recarregue a página.');
    }
  }

  async function agendar(dataHora: string) {
    await agendarConsulta(idDoPaciente, dataHora);
    setAgendando(false);
    await aoAlterar(`Consulta agendada para ${formatarDataHora(dataHora)}.`);
  }

  const todas = consultas.estado.situacao === 'pronto' ? consultas.estado.dados : [];
  // A API devolve da mais recente para a mais antiga; a próxima vem primeiro.
  const proximas = todas.filter(ehProxima).reverse();
  const anteriores = todas.filter((consulta) => !ehProxima(consulta));

  return (
    <AppShell titulo="Minhas consultas">
      <div className="space-y-6">
        {aviso && <Alerta tom="sucesso">{aviso}</Alerta>}
        {erro && <Alerta>{erro}</Alerta>}

        {agendando ? (
          <SeletorDeHorario
            titulo="Agendar consulta"
            rotuloConfirmar="Confirmar agendamento"
            aoConfirmar={agendar}
            aoFechar={() => setAgendando(false)}
          />
        ) : (
          <Botao
            onClick={() => {
              setAviso(null);
              setAgendando(true);
            }}
          >
            Agendar consulta
          </Botao>
        )}

        {consultas.estado.situacao === 'carregando' && <Carregando rotulo="Carregando suas consultas…" />}
        {consultas.estado.situacao === 'erro' && <Alerta>{consultas.estado.mensagem}</Alerta>}

        {consultas.estado.situacao === 'pronto' && (
          <section aria-labelledby="proximas-titulo">
            <h2 id="proximas-titulo" className="mb-1 text-sm font-semibold text-slate-800">
              Próximas consultas
            </h2>
            <p className="mb-3 text-sm text-slate-600">
              Cancelamentos e remarcações pelo app precisam respeitar a antecedência mínima definida pelo seu
              nutricionista.
            </p>
            {proximas.length === 0 ? (
              <EstadoVazio titulo="Nenhuma consulta marcada">
                Use “Agendar consulta” para escolher um horário livre.
              </EstadoVazio>
            ) : (
              <ul className="space-y-3">
                {proximas.map((consulta) => (
                  <CartaoDaConsulta key={consulta.id} consulta={consulta} aoAlterar={aoAlterar} />
                ))}
              </ul>
            )}
          </section>
        )}

        {anteriores.length > 0 && (
          <details className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <summary className="flex min-h-toque cursor-pointer items-center text-sm font-semibold text-slate-800">
              Consultas anteriores e canceladas ({anteriores.length})
            </summary>
            <ul className="mt-2 divide-y divide-slate-200">
              {anteriores.map((consulta) => (
                <li key={consulta.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="text-slate-900">{formatarDataHora(consulta.data_hora)}</span>
                  <Selo tom={consulta.status === 'cancelado' ? 'aviso' : 'neutro'}>
                    {consulta.status === 'cancelado' ? 'Cancelada' : 'Já passou'}
                  </Selo>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </AppShell>
  );
}
