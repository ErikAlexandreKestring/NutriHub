import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Avatar } from '@/components/Avatar';
import { classesDeBotao } from '@/components/classesDeBotao';
import { Campo } from '@/components/Campo';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { Icone } from '@/components/Icone';
import { Selo } from '@/components/Selo';
import { AppShell } from '@/layouts/AppShell';
import { useRecurso } from '@/lib/useRecurso';
import { listarPacientes } from '@/pacientes/pacientesApi';
import type { Paciente } from '@/pacientes/tipos';

/** Busca sem acento e sem caixa: "joao" encontra "João". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * RF-03: listagem dos pacientes do consultório. O filtro é feito no cliente:
 * a carteira de um nutricionista é de dezenas de pacientes (a persona atende
 * 15 por mês), e a API já devolve a lista inteira ordenada por nome.
 */
export function ListaDePacientes() {
  const { estado } = useRecurso('pacientes', listarPacientes);
  const [busca, setBusca] = useState('');
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const pacientes = estado.situacao === 'pronto' ? estado.dados : [];
  const inativos = pacientes.filter((p) => p.status === 'inativo').length;

  const termo = normalizar(busca.trim());
  const visiveis = pacientes.filter(
    (p) =>
      (mostrarInativos || p.status === 'ativo') &&
      (!termo || normalizar(p.nome).includes(termo) || normalizar(p.email).includes(termo)),
  );

  return (
    <AppShell
      titulo="Pacientes"
      acoes={
        <Link to="/pacientes/novo" className={classesDeBotao()}>
          Novo paciente
        </Link>
      }
    >
      {estado.situacao === 'carregando' && <Carregando rotulo="Carregando pacientes…" />}
      {estado.situacao === 'erro' && <Alerta>{estado.mensagem}</Alerta>}

      {estado.situacao === 'pronto' && pacientes.length === 0 && (
        <EstadoVazio titulo="Nenhum paciente cadastrado">
          Cadastre o primeiro paciente para montar o plano alimentar dele.
        </EstadoVazio>
      )}

      {estado.situacao === 'pronto' && pacientes.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <Campo
              rotulo="Buscar por nome ou e-mail"
              type="search"
              className="min-w-0 flex-1"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {inativos > 0 && (
              <label className="flex min-h-toque items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 accent-marca-600"
                  checked={mostrarInativos}
                  onChange={(e) => setMostrarInativos(e.target.checked)}
                />
                Mostrar inativos ({inativos})
              </label>
            )}
          </div>

          {visiveis.length === 0 ? (
            <EstadoVazio titulo="Nenhum paciente encontrado">Tente outro nome ou e-mail.</EstadoVazio>
          ) : (
            <ul className="cartao divide-y divide-black/5 overflow-hidden">
              {visiveis.map((paciente) => (
                <LinhaDoPaciente key={paciente.id} paciente={paciente} />
              ))}
            </ul>
          )}
        </div>
      )}
    </AppShell>
  );
}

function LinhaDoPaciente({ paciente }: { paciente: Paciente }) {
  const semAcesso = paciente.status === 'ativo' && !paciente.acesso_liberado;
  return (
    <li>
      <Link
        to={`/pacientes/${paciente.id}`}
        className="group flex min-h-toque items-center gap-3 px-4 py-3 transition hover:bg-marca-50/60"
      >
        <Avatar nome={paciente.nome} apagado={paciente.status === 'inativo'} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900">{paciente.nome}</span>
          <span className="block truncate text-sm text-slate-600">{paciente.email}</span>
          {(paciente.status === 'inativo' || semAcesso) && (
            <span className="mt-1 flex flex-wrap gap-2">
              {paciente.status === 'inativo' && <Selo>Inativo</Selo>}
              {semAcesso && <Selo tom="aviso">Sem acesso ao app</Selo>}
            </span>
          )}
        </span>
        <Icone nome="seta" className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:text-marca-700" />
      </Link>
    </li>
  );
}
