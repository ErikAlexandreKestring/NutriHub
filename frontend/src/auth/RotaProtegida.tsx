import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { INICIO_POR_PAPEL } from './rotas';
import type { Papel } from './sessao';
import { useSessao } from './useSessao';

/**
 * Espelha no cliente o que `authorize()` já garante no servidor. A checagem
 * aqui é de navegação, não de segurança: o backend continua sendo a autoridade,
 * porque o JWT do paciente carrega o mesmo tenant_id do nutricionista.
 */
export function RotaProtegida({ papel }: { papel: Papel }) {
  const { sessao } = useSessao();
  const local = useLocation();

  if (!sessao) {
    // `state.de` devolve o usuário à página pretendida depois do login, em vez
    // de sempre despejá-lo na home do papel.
    return <Navigate to="/entrar" replace state={{ de: local.pathname + local.search }} />;
  }

  if (sessao.papel !== papel) {
    return <Navigate to={INICIO_POR_PAPEL[sessao.papel]} replace />;
  }

  return <Outlet />;
}
