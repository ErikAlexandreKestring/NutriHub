import { useNavigate, useParams } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Carregando } from '@/components/Estado';
import { AppShell } from '@/layouts/AppShell';
import { useRecurso } from '@/lib/useRecurso';
import { FormularioDePaciente } from '@/pacientes/FormularioDePaciente';
import { atualizarPaciente, buscarPaciente } from '@/pacientes/pacientesApi';

/** RF-03: edição dos dados cadastrais. */
export function EditarPaciente() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const { estado } = useRecurso(id, (sinal) => buscarPaciente(id, sinal));
  const voltarPara = `/pacientes/${id}`;

  return (
    <AppShell titulo="Editar paciente" voltar={{ para: voltarPara, rotulo: 'Voltar ao paciente' }}>
      {estado.situacao === 'carregando' && <Carregando />}
      {estado.situacao === 'erro' && <Alerta>{estado.mensagem}</Alerta>}
      {estado.situacao === 'pronto' && (
        <FormularioDePaciente
          inicial={{
            nome: estado.dados.nome,
            email: estado.dados.email,
            data_nascimento: estado.dados.data_nascimento,
            contato: estado.dados.contato ?? '',
            historico: estado.dados.historico ?? '',
          }}
          rotuloEnviar="Salvar alterações"
          aoEnviar={async (dados) => {
            await atualizarPaciente(id, dados);
            navegar(voltarPara, { replace: true, state: { aviso: 'salvo' } });
          }}
          aoCancelar={() => navegar(voltarPara)}
        />
      )}
    </AppShell>
  );
}
