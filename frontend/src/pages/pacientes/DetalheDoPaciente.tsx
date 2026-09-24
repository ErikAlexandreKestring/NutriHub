import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { classesDeBotao } from '@/components/classesDeBotao';
import { Carregando } from '@/components/Estado';
import { Selo } from '@/components/Selo';
import { AppShell } from '@/layouts/AppShell';
import { formatarDataHora, formatarDataSemHora } from '@/lib/formato';
import { mensagemDeFalha } from '@/lib/useErrosDeFormulario';
import { useRecurso } from '@/lib/useRecurso';
import { buscarPaciente, gerarTokenDeAcesso, inativarPaciente, linkDePrimeiroAcesso } from '@/pacientes/pacientesApi';
import type { Paciente, TokenDeAcesso } from '@/pacientes/tipos';

const AVISOS: Record<string, string> = {
  criado: 'Paciente cadastrado. Gere o link de primeiro acesso para que ele entre no app.',
  salvo: 'Alterações salvas.',
};

/** RF-03: ficha do paciente e acesso ao app. */
export function DetalheDoPaciente() {
  const { id = '' } = useParams();
  const local = useLocation();
  const paciente = useRecurso(id, (sinal) => buscarPaciente(id, sinal));
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
            aoInativar={paciente.definirDados}
            aoFalhar={setErroDeAcao}
          />
          <AcessoAoApp paciente={paciente.estado.dados} />
        </div>
      )}
    </AppShell>
  );
}

function DadosDoPaciente({
  paciente,
  aoInativar,
  aoFalhar,
}: {
  paciente: Paciente;
  aoInativar: (paciente: Paciente) => void;
  aoFalhar: (mensagem: string | null) => void;
}) {
  const [inativando, setInativando] = useState(false);

  async function inativar() {
    const confirmou = window.confirm(
      `Inativar ${paciente.nome}? O paciente deixa de acessar o app. Os dados continuam guardados.`,
    );
    if (!confirmou) return;

    aoFalhar(null);
    setInativando(true);
    try {
      aoInativar(await inativarPaciente(paciente.id));
    } catch (falha) {
      aoFalhar(mensagemDeFalha(falha, 'Não foi possível inativar o paciente.'));
    } finally {
      setInativando(false);
    }
  }

  return (
    <section aria-labelledby="dados-titulo" className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dados-titulo" className="flex items-center gap-2 font-semibold text-slate-900">
          Dados cadastrais
          {paciente.status === 'inativo' && <Selo>Inativo</Selo>}
        </h2>
        <div className="flex gap-2">
          <Link to={`/pacientes/${paciente.id}/editar`} className={classesDeBotao('secundario')}>
            Editar
          </Link>
          {paciente.status === 'ativo' && (
            <Botao variante="perigo" onClick={inativar} carregando={inativando}>
              Inativar
            </Botao>
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-600">E-mail</dt>
          <dd className="font-medium text-slate-900">{paciente.email}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Data de nascimento</dt>
          <dd className="font-medium text-slate-900">{formatarDataSemHora(paciente.data_nascimento)}</dd>
        </div>
        <div>
          <dt className="text-slate-600">Contato</dt>
          <dd className="font-medium text-slate-900">{paciente.contato || '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-600">Histórico</dt>
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
    <section aria-labelledby="acesso-titulo" className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <h2 id="acesso-titulo" className="font-semibold text-slate-900">
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
              className="min-h-toque min-w-0 flex-1 rounded-lg border-0 bg-slate-50 px-3 text-sm text-slate-900 ring-1 ring-inset ring-slate-300"
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
