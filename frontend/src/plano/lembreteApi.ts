import { chamarApi } from '@/lib/api';

export interface PreferenciaDeLembrete {
  ativo: boolean;
}

/** RF-07: lembrete diário, por e-mail, das refeições ainda não marcadas como feitas. */
export function buscarPreferenciaDeLembrete(patientId: string, sinal?: AbortSignal): Promise<PreferenciaDeLembrete> {
  return chamarApi<PreferenciaDeLembrete>(`/patients/${patientId}/lembrete`, { sinal });
}

export function definirPreferenciaDeLembrete(patientId: string, ativo: boolean): Promise<PreferenciaDeLembrete> {
  return chamarApi<PreferenciaDeLembrete>(`/patients/${patientId}/lembrete`, { metodo: 'PUT', corpo: { ativo } });
}
