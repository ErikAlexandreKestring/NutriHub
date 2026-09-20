import { useEffect, useState } from 'react';
import { ErroDaApi, ErroDeRede } from '@/lib/api';
import { buscarPlanoAtivo } from './planoApi';
import type { PlanoAtivo } from './tipos';

export type EstadoDoPlano =
  | { situacao: 'carregando' }
  | { situacao: 'pronto'; plano: PlanoAtivo }
  /** 404: o acesso é válido, o nutricionista é que ainda não publicou nada. */
  | { situacao: 'sem-plano' }
  | { situacao: 'erro'; mensagem: string };

/**
 * `patientId` aceita null para que a tela possa chamar o hook antes de garantir
 * que há sessão — as regras dos hooks não permitem chamá-lo condicionalmente, e
 * disparar a requisição com um id vazio bateria em /patients//meal-plans/ativo.
 */
export function usePlanoAtivo(patientId: string | null): EstadoDoPlano {
  const [estado, setEstado] = useState<EstadoDoPlano>({ situacao: 'carregando' });

  useEffect(() => {
    if (!patientId) return;

    // Sem o abort, trocar de paciente (ou desmontar durante a requisição)
    // deixaria a resposta antiga chegar depois e sobrescrever a nova.
    const controlador = new AbortController();
    setEstado({ situacao: 'carregando' });

    buscarPlanoAtivo(patientId, controlador.signal)
      .then((plano) => setEstado({ situacao: 'pronto', plano }))
      .catch((falha: unknown) => {
        if (falha instanceof DOMException && falha.name === 'AbortError') return;

        // Um 401 já derruba a sessão pelo ouvinte em lib/api; aqui ele não
        // precisa virar mensagem, a tela de login assume.
        if (falha instanceof ErroDaApi) {
          setEstado(falha.status === 404 ? { situacao: 'sem-plano' } : { situacao: 'erro', mensagem: falha.message });
          return;
        }

        if (falha instanceof ErroDeRede) {
          setEstado({ situacao: 'erro', mensagem: falha.message });
          return;
        }

        setEstado({ situacao: 'erro', mensagem: 'Não foi possível carregar seu plano.' });
      });

    return () => controlador.abort();
  }, [patientId]);

  return estado;
}
