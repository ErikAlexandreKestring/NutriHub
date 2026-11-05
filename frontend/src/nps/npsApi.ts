import { chamarApi } from '@/lib/api';
import type { PesquisaNps, ResumoNps } from './tipos';

/** UC-07: a pesquisa em aberto do paciente, ou null se não houver. */
export async function buscarPesquisaPendente(patientId: string, sinal?: AbortSignal): Promise<PesquisaNps | null> {
  const { pesquisa } = await chamarApi<{ pesquisa: PesquisaNps | null }>(`/patients/${patientId}/nps/pendente`, {
    sinal,
  });
  return pesquisa;
}

export function responderPesquisa(
  patientId: string,
  pesquisaId: string,
  dados: { nota: number; comentario?: string },
): Promise<PesquisaNps> {
  return chamarApi<PesquisaNps>(`/patients/${patientId}/nps/${pesquisaId}/resposta`, { metodo: 'POST', corpo: dados });
}

/** RF-09: o consolidado do consultório, para o nutricionista. */
export function buscarResumoNps(sinal?: AbortSignal): Promise<ResumoNps> {
  return chamarApi<ResumoNps>('/nps', { sinal });
}
