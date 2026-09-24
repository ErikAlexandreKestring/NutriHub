import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { FormularioDePaciente } from '@/pacientes/FormularioDePaciente';
import { criarPaciente } from '@/pacientes/pacientesApi';

/** RF-03 / UC-01: cadastro de paciente. */
export function NovoPaciente() {
  const navegar = useNavigate();

  return (
    <AppShell titulo="Novo paciente" voltar={{ para: '/pacientes', rotulo: 'Pacientes' }}>
      <FormularioDePaciente
        rotuloEnviar="Cadastrar paciente"
        aoEnviar={async (dados) => {
          const paciente = await criarPaciente(dados);
          // O próximo passo natural é liberar o acesso ao app — a tela do
          // paciente usa este aviso para apontar para ele.
          navegar(`/pacientes/${paciente.id}`, { replace: true, state: { aviso: 'criado' } });
        }}
        aoCancelar={() => navegar('/pacientes')}
      />
    </AppShell>
  );
}
