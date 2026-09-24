import { Navigate, Route, Routes } from 'react-router-dom';
import { RotaProtegida } from '@/auth/RotaProtegida';
import { INICIO_POR_PAPEL } from '@/auth/rotas';
import { useSessao } from '@/auth/useSessao';
import { Cadastro } from '@/pages/Cadastro';
import { Login } from '@/pages/Login';
import { MeuPlano } from '@/pages/MeuPlano';
import { NaoEncontrada } from '@/pages/NaoEncontrada';
import { DetalheDoPaciente } from '@/pages/pacientes/DetalheDoPaciente';
import { EditarPaciente } from '@/pages/pacientes/EditarPaciente';
import { ListaDePacientes } from '@/pages/pacientes/ListaDePacientes';
import { NovoPaciente } from '@/pages/pacientes/NovoPaciente';
import { PrimeiroAcesso } from '@/pages/PrimeiroAcesso';

/** A raiz não tem tela própria: manda cada papel para o seu início. */
function Inicio() {
  const { sessao } = useSessao();
  return <Navigate to={sessao ? INICIO_POR_PAPEL[sessao.papel] : '/entrar'} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/entrar" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/primeiro-acesso" element={<PrimeiroAcesso />} />

      <Route element={<RotaProtegida papel="nutricionista" />}>
        <Route path="/pacientes" element={<ListaDePacientes />} />
        <Route path="/pacientes/novo" element={<NovoPaciente />} />
        <Route path="/pacientes/:id" element={<DetalheDoPaciente />} />
        <Route path="/pacientes/:id/editar" element={<EditarPaciente />} />
      </Route>

      <Route element={<RotaProtegida papel="paciente" />}>
        <Route path="/meu-plano" element={<MeuPlano />} />
      </Route>

      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
  );
}
