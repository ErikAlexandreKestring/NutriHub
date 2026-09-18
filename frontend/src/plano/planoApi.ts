import { chamarApi } from '@/lib/api';
import type { PlanoAtivo } from './tipos';

/**
 * RF-05. O id vai na URL (e não é lido do token no backend) porque a mesma rota
 * serve ao nutricionista inspecionando um paciente; o `ensurePatientScope` no
 * servidor é quem impede um paciente de pedir o plano de outro.
 */
export function buscarPlanoAtivo(patientId: string, sinal?: AbortSignal): Promise<PlanoAtivo> {
  return chamarApi<PlanoAtivo>(`/patients/${patientId}/meal-plans/ativo`, { sinal });
}
