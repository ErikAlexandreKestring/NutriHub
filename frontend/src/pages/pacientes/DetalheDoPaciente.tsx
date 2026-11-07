import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { classesDeBotao } from '@/components/classesDeBotao';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { Selo } from '@/components/Selo';
import { AppShell } from '@/layouts/AppShell';
import { formatarData, formatarDataHora, formatarDataSemHora, formatarKcal } from '@/lib/formato';
import { mensagemDeFalha } from '@/lib/useErrosDeFormulario';
import { useRecurso } from '@/lib/useRecurso';
import {
  buscarPaciente,
  excluirDadosDoPaciente,
  gerarTokenDeAcesso,
  inativarPaciente,
  linkDePrimeiroAcesso,
  reativarPaciente,
} from '@/pacientes/pacientesApi';
import type { Paciente, TokenDeAcesso } from '@/pacientes/tipos';
import { criarRascunho, listarPlanosDoPaciente, listarPlanosParaCopiar } from '@/plano/planoApi';
import { SELO_DO_STATUS } from '@/plano/status';
import type { OrigemDeCopia, ResumoDoPlano } from '@/plano/tipos';

const AVISOS: Record<string, string> = {
  criado: 'Paciente cadastrado. Gere o link de primeiro acesso para que ele entre no app.',
  salvo: 'Alterações salvas.',
};

/** RF-03 + RF-04: ficha do paciente, acesso ao app e planos alimentares. */
export function DetalheDoPaciente() {
  const { id = '' } = useParams();
  const local = useLocation();
  const paciente = useRecurso(id, (sinal) => buscarPaciente(id, sinal));
  const planos = useRecurso(id, (sinal) => listarPlanosDoPaciente(id, sinal));
  const [erroDeAcao, setErroDeAcao] = useState<string | null>(null);

  const aviso = AVISOS[(local.state as { aviso?: string } | null)?.aviso ?? ''];
  const titulo = paciente.estado.situacao === 'pronto' ? paciente.estado.dados.nome : 'Paciente';

  return (
    <AppShell titulo={titulo} voltar={{ para: '/pacientes', rotulo: 'Pacientes' }}>
      {paciente.estado.situacao === 'carregando' && <Carregando />}
      {paciente.estado.situacao === 'erro' && <Alerta>{paciente.estado.mensagem}</Alerta>}

      {paciente.estado.situacao === 'pronto' && (
        <div className="space-y-6">
          {aviso && <Alerta tom="sucesso">{aviso}</Alerta>}
          {erroDeAcao && <Alerta>{erroDeAcao}</Alerta>}

          <DadosDoPaciente
            paciente={paciente.estado.dados}
            aoMudarStatus={paciente.definirDados}
            aoFalhar={setErroDeAcao}
          />
          <AcessoAoApp paciente={paciente.estado.dados} />

          <section aria-labelledby="planos-titulo" className="cartao p-6">
            {planos.estado.situacao === 'carregando' && <Carregando rotulo="Carregando planos…" />}
            {planos.estado.situacao === 'erro' && <Alerta>{planos.estado.mensagem}</Alerta>}
            {planos.estado.situacao === 'pronto' && (
              <PlanosDoPaciente paciente={paciente.estado.dados} planos={planos.estado.dados} />
            )}
          </section>

          <ExclusaoDeDados paciente={paciente.estado.dados} />
        </div>
      )}
    </AppShell>
  );
}

function DadosDoPaciente({
  paciente,
  aoMudarStatus,
  aoFalhar,
}: {
  paciente: Paciente;
  aoMudarStatus: (paciente: Paciente) => void;
  aoFalhar: (mensagem: string | null) => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const ativo = paciente.status === 'ativo';

  async function mudarStatus() {
    const confirmou = window.confirm(
      ativo
        ? `Inativar ${paciente.nome}? O paciente deixa de acessar o app. Os dados e os planos continuam guardados.`
        : `Reativar ${paciente.nome}? O paciente volta a acessar o app, com os dados e os planos que já tinha.`,
    );
    if (!confirmou) return;

    aoFalhar(null);
    setSalvando(true);
    try {
      aoMudarStatus(await (ativo ? inativarPaciente(paciente.id) : reativarPaciente(paciente.id)));
    } catch (falha) {
      aoFalhar(
        mensagemDeFalha(falha, ativo ? 'Não foi possível inativar o paciente.' : 'Não foi possível reativar o paciente.'),
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section aria-labelledby="dados-titulo" className="cartao p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dados-titulo" className="flex items-center gap-2 font-titulo text-2xl text-slate-900">
          Dados cadastrais
          {paciente.status === 'inativo' && <Selo>Inativo</Selo>}
        </h2>
        <div className="flex gap-2">
          <Link to={`/pacientes/${paciente.id}/editar`} className={classesDeBotao('secundario')}>
            Editar
          </Link>
          {ativo ? (
            <Botao variante="perigo" onClick={mudarStatus} carregando={salvando}>
              Inativar
            </Botao>
          ) : (
            <Botao onClick={mudarStatus} carregando={salvando}>
              Reativar
            </Botao>
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">E-mail</dt>
          <dd className="font-medium text-slate-900">{paciente.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">Data de nascimento</dt>
          <dd className="font-medium text-slate-900">{formatarDataSemHora(paciente.data_nascimento)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">Contato</dt>
          <dd className="font-medium text-slate-900">{paciente.contato || '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wider text-slate-600">Histórico</dt>
          <dd className="whitespace-pre-line text-slate-900">{paciente.historico || '—'}</dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * RF-02: o paciente é cadastrado sem senha e entra pela primeira vez por um link
 * com token de uso único. Enquanto o envio automático (RF-07) não existe, o
 * nutricionista copia o link e manda pelo canal que já usa com o paciente.
 */
function AcessoAoApp({ paciente }: { paciente: Paciente }) {
  const [token, setToken] = useState<TokenDeAcesso | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  if (paciente.status === 'inativo') return null;

  async function gerar() {
    setErro(null);
    setCopiado(false);
    setGerando(true);
    try {
      setToken(await gerarTokenDeAcesso(paciente.id));
    } catch (falha) {
      setErro(mensagemDeFalha(falha, 'Não foi possível gerar o link.'));
    } finally {
      setGerando(false);
    }
  }

  const link = token ? linkDePrimeiroAcesso(token.token) : null;

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
    } catch {
      // Sem permissão de clipboard (ex.: http fora de localhost): o link segue
      // visível e selecionável no campo, que é o caminho alternativo.
      setErro('Não foi possível copiar automaticamente. Selecione o link e copie manualmente.');
    }
  }

  return (
    <section aria-labelledby="acesso-titulo" className="cartao p-6">
      <h2 id="acesso-titulo" className="font-titulo text-2xl text-slate-900">
        Acesso ao app
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {paciente.acesso_liberado
          ? 'O paciente já definiu a senha e acessa o app. Se ele esquecer a senha, gere um novo link para redefini-la.'
          : 'O paciente ainda não acessou o app. Gere o link de primeiro acesso e envie a ele.'}
      </p>

      {erro && (
        <div className="mt-3">
          <Alerta>{erro}</Alerta>
        </div>
      )}

      {link && token ? (
        <div className="mt-4 space-y-2">
          <label htmlFor="link-acesso" className="block text-sm font-medium text-slate-800">
            Link de acesso
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="link-acesso"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-toque min-w-0 flex-1 rounded-lg border-0 bg-creme-campo px-3 text-sm text-slate-900"
            />
            <Botao variante="secundario" onClick={copiar}>
              {copiado ? 'Copiado!' : 'Copiar'}
            </Botao>
          </div>
          <p className="text-sm text-slate-600">
            Válido até {formatarDataHora(token.expira_em)}, para um único uso. Gerar outro link invalida este.
          </p>
        </div>
      ) : (
        <Botao className="mt-4" variante="secundario" onClick={gerar} carregando={gerando}>
          {paciente.acesso_liberado ? 'Gerar link para redefinir senha' : 'Gerar link de primeiro acesso'}
        </Botao>
      )}
    </section>
  );
}

function PlanosDoPaciente({ paciente, planos }: { paciente: Paciente; planos: ResumoDoPlano[] }) {
  const navegar = useNavigate();
  const [criando, setCriando] = useState(false);
  const [escolhendoOrigem, setEscolhendoOrigem] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const temAtivo = planos.some((p) => p.status === 'ativo');

  /** Sem `copiarDe`, o rascunho nasce vazio; com ele, já vem com as refeições daquele plano. */
  async function novoPlano(copiarDe?: string) {
    // Fluxo 3.3, passo 2: havendo plano ativo, o sistema pede confirmação. O
    // rascunho em si não mexe no plano atual — a troca só acontece ao publicar.
    if (
      temAtivo &&
      !window.confirm(
        'Este paciente já tem um plano ativo. O novo plano começa como rascunho e só substitui o atual quando for publicado. Continuar?',
      )
    ) {
      return;
    }

    setErro(null);
    setCriando(true);
    try {
      const rascunho = await criarRascunho(paciente.id, copiarDe);
      navegar(`/planos/${rascunho.id}`);
    } catch (falha) {
      setErro(mensagemDeFalha(falha, 'Não foi possível criar o plano.'));
      setCriando(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="planos-titulo" className="font-titulo text-2xl text-slate-900">
          Planos alimentares
        </h2>
        {paciente.status === 'ativo' && (
          <div className="flex flex-wrap gap-2">
            <Botao
              variante="secundario"
              onClick={() => setEscolhendoOrigem((aberto) => !aberto)}
              aria-expanded={escolhendoOrigem}
              disabled={criando}
            >
              Copiar de outro plano
            </Botao>
            <Botao onClick={() => novoPlano()} carregando={criando}>
              Novo plano alimentar
            </Botao>
          </div>
        )}
      </div>

      {escolhendoOrigem && paciente.status === 'ativo' && (
        <EscolhaDePlanoParaCopiar
          pacienteId={paciente.id}
          criando={criando}
          aoEscolher={(origem) => novoPlano(origem.id)}
          aoCancelar={() => setEscolhendoOrigem(false)}
        />
      )}

      {erro && (
        <div className="mt-3">
          <Alerta>{erro}</Alerta>
        </div>
      )}

      {planos.length === 0 ? (
        <div className="mt-4">
          <EstadoVazio titulo="Nenhum plano criado">
            {paciente.status === 'ativo'
              ? 'Crie o primeiro plano alimentar deste paciente.'
              : 'Este paciente está inativo.'}
          </EstadoVazio>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-black/5 overflow-hidden rounded-xl ring-1 ring-inset ring-black/5">
          {planos.map((plano) => {
            const selo = SELO_DO_STATUS[plano.status];
            return (
              <li key={plano.id}>
                <Link
                  to={`/planos/${plano.id}`}
                  className="flex min-h-toque flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-creme"
                >
                  <span>
                    <span className="block font-medium text-slate-900">
                      {plano.published_at
                        ? `Publicado em ${formatarData(plano.published_at)}`
                        : `Criado em ${formatarData(plano.created_at)}`}
                    </span>
                    {plano.meta_kcal && (
                      <span className="block text-slate-600">Meta: {formatarKcal(plano.meta_kcal)}</span>
                    )}
                  </span>
                  <Selo tom={selo.tom}>{selo.rotulo}</Selo>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * Começar o plano a partir de outro já publicado, de qualquer paciente: o
 * rascunho nasce com as mesmas refeições e alimentos, e o nutricionista adapta.
 * O plano escolhido não muda. Meta e orientações não vêm junto, porque são do
 * outro paciente.
 */
function EscolhaDePlanoParaCopiar({
  pacienteId,
  criando,
  aoEscolher,
  aoCancelar,
}: {
  pacienteId: string;
  criando: boolean;
  aoEscolher: (origem: OrigemDeCopia) => void;
  aoCancelar: () => void;
}) {
  const origens = useRecurso('origens-de-copia', (sinal) => listarPlanosParaCopiar(sinal));
  const [busca, setBusca] = useState('');

  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const filtradas =
    origens.estado.situacao === 'pronto'
      ? origens.estado.dados.filter((o) => o.patient_nome.toLocaleLowerCase('pt-BR').includes(termo))
      : [];

  return (
    <div className="mt-4 rounded-xl bg-creme p-4 ring-1 ring-inset ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-slate-900">Copiar de outro plano</h3>
          <p className="mt-1 text-sm text-slate-600">
            O novo plano começa como rascunho, com as mesmas refeições e alimentos, para você adaptar. O plano escolhido
            não muda. Meta e orientações não são copiadas.
          </p>
        </div>
        <Botao variante="secundario" onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>

      {origens.estado.situacao === 'carregando' && <Carregando rotulo="Carregando planos…" />}
      {origens.estado.situacao === 'erro' && (
        <div className="mt-3">
          <Alerta>{origens.estado.mensagem}</Alerta>
        </div>
      )}

      {origens.estado.situacao === 'pronto' &&
        (origens.estado.dados.length === 0 ? (
          <div className="mt-3">
            <EstadoVazio titulo="Nenhum plano publicado ainda">
              Publique um plano para poder usá-lo como ponto de partida.
            </EstadoVazio>
          </div>
        ) : (
          <>
            <Campo
              className="mt-3"
              rotulo="Buscar por paciente"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {filtradas.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Nenhum plano de paciente com esse nome.</p>
            ) : (
              <ul className="mt-3 divide-y divide-black/5 overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-black/5">
                {filtradas.map((origem) => {
                  const selo = SELO_DO_STATUS[origem.status];
                  const doMesmoPaciente = origem.patient_id === pacienteId;
                  return (
                    <li key={origem.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span>
                        <span className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                          {origem.patient_nome}
                          {doMesmoPaciente && <span className="font-normal text-slate-600">(este paciente)</span>}
                          <Selo tom={selo.tom}>{selo.rotulo}</Selo>
                        </span>
                        <span className="block text-slate-600">
                          {origem.published_at && `Publicado em ${formatarData(origem.published_at)} · `}
                          {origem.refeicoes} {origem.refeicoes === 1 ? 'refeição' : 'refeições'} ·{' '}
                          {formatarKcal(origem.kcal)}
                        </span>
                      </span>
                      <Botao
                        variante="secundario"
                        onClick={() => aoEscolher(origem)}
                        disabled={criando}
                        aria-label={`Copiar o plano de ${origem.patient_nome}`}
                      >
                        Copiar
                      </Botao>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ))}
    </div>
  );
}

/**
 * RNF-03 / RFC 6.4: exclusão definitiva a pedido do paciente (LGPD). Como não
 * tem volta, o nutricionista confirma digitando o nome do paciente — um
 * `confirm()` de um clique, como o de inativar, é fácil demais de aceitar por
 * engano.
 */
function ExclusaoDeDados({ paciente }: { paciente: Paciente }) {
  const navegar = useNavigate();
  const [confirmando, setConfirmando] = useState(false);
  const [nomeDigitado, setNomeDigitado] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nomeConfere = nomeDigitado.trim() === paciente.nome.trim();

  function cancelar() {
    setConfirmando(false);
    setNomeDigitado('');
    setErro(null);
  }

  async function excluir() {
    setErro(null);
    setExcluindo(true);
    try {
      await excluirDadosDoPaciente(paciente.id);
      navegar('/pacientes', { replace: true, state: { aviso: 'excluido' } });
    } catch (falha) {
      setErro(mensagemDeFalha(falha, 'Não foi possível excluir os dados do paciente.'));
      setExcluindo(false);
    }
  }

  return (
    <section aria-labelledby="exclusao-titulo" className="cartao p-6">
      <h2 id="exclusao-titulo" className="font-titulo text-2xl text-slate-900">
        Excluir paciente
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Ao confirmar, o cadastro do paciente e os planos alimentares dele serão excluídos, junto com as consultas e os
        feedbacks. Não é possível desfazer.
      </p>

      {erro && (
        <div className="mt-3">
          <Alerta>{erro}</Alerta>
        </div>
      )}

      {confirmando ? (
        <div className="mt-4 space-y-3">
          <Campo
            rotulo="Para confirmar, digite o nome do paciente"
            dica={`Digite exatamente: ${paciente.nome}`}
            value={nomeDigitado}
            onChange={(e) => setNomeDigitado(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <Botao variante="perigo" onClick={excluir} disabled={!nomeConfere} carregando={excluindo}>
              Excluir definitivamente
            </Botao>
            <Botao variante="secundario" onClick={cancelar} disabled={excluindo}>
              Cancelar
            </Botao>
          </div>
        </div>
      ) : (
        <Botao className="mt-4" variante="perigo" onClick={() => setConfirmando(true)}>
          Excluir paciente
        </Botao>
      )}
    </section>
  );
}
