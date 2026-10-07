import { Navigate, Route, Routes } from 'react-router-dom';
import { RotaProtegida } from '@/auth/RotaProtegida';
import { INICIO_POR_PAPEL } from '@/auth/rotas';
import { useSessao } from '@/auth/useSessao';
import { Cadastro } from '@/pages/Cadastro';
import { AgendaDoNutricionista } from '@/pages/agenda/AgendaDoNutricionista';
import { HorariosDeAtendimento } from '@/pages/agenda/HorariosDeAtendimento';
import { ConstrutorDePlano } from '@/pages/ConstrutorDePlano';
import { Login } from '@/pages/Login';
import { CaixaDeFeedbacks } from '@/pages/feedback/CaixaDeFeedbacks';
import { MeusFeedbacks } from '@/pages/feedback/MeusFeedbacks';
import { ReportarProblema } from '@/pages/feedback/ReportarProblema';
import { MeuPlano } from '@/pages/MeuPlano';
import { MinhasConsultas } from '@/pages/MinhasConsultas';
import { NaoEncontrada } from '@/pages/NaoEncontrada';
import { Painel } from '@/pages/Painel';
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
        <Route path="/painel" element={<Painel />} />
        <Route path="/pacientes" element={<ListaDePacientes />} />
        <Route path="/pacientes/novo" element={<NovoPaciente />} />
        <Route path="/pacientes/:id" element={<DetalheDoPaciente />} />
        <Route path="/pacientes/:id/editar" element={<EditarPaciente />} />
        <Route path="/planos/:id" element={<ConstrutorDePlano />} />
        <Route path="/agenda" element={<AgendaDoNutricionista />} />
        <Route path="/agenda/horarios" element={<HorariosDeAtendimento />} />
        <Route path="/feedbacks" element={<CaixaDeFeedbacks />} />
      </Route>

      <Route element={<RotaProtegida papel="paciente" />}>
        <Route path="/meu-plano" element={<MeuPlano />} />
        <Route path="/minhas-consultas" element={<MinhasConsultas />} />
        <Route path="/feedback" element={<MeusFeedbacks />} />
        <Route path="/feedback/novo" element={<ReportarProblema />} />
      </Route>

      <Route path="*" element={<NaoEncontrada />} />
    </Routes>
  );
}
