import { chamarApi } from '@/lib/api';
import type {
  Consulta,
  ConsultaDoConsultorio,
  DadosDaDisponibilidade,
  Disponibilidade,
  HorarioLivre,
} from './tipos';

// ---- Grade de disponibilidade (RF-08) — escrita só do nutricionista ----

export function listarDisponibilidade(sinal?: AbortSignal): Promise<Disponibilidade[]> {
  return chamarApi<Disponibilidade[]>('/availability', { sinal });
}

export function criarDisponibilidade(dados: DadosDaDisponibilidade): Promise<Disponibilidade> {
  return chamarApi<Disponibilidade>('/availability', {
    metodo: 'POST',
    corpo: { ...dados, day_of_week: Number(dados.day_of_week) },
  });
}

export function removerDisponibilidade(id: string): Promise<void> {
  return chamarApi<void>(`/availability/${id}`, { metodo: 'DELETE' });
}

// ---- Consultas (RF-08/11/12) ----

/** Agenda do consultório a partir de hoje — exclusiva do nutricionista. */
export function listarConsultasDoConsultorio(sinal?: AbortSignal): Promise<ConsultaDoConsultorio[]> {
  return chamarApi<ConsultaDoConsultorio[]>('/appointments', { sinal });
}

/** Todas as consultas do paciente, da mais recente para a mais antiga. */
export function listarConsultasDoPaciente(patientId: string, sinal?: AbortSignal): Promise<Consulta[]> {
  return chamarApi<Consulta[]>(`/patients/${patientId}/appointments`, { sinal });
}

/** `de`/`ate` são datas de calendário (AAAA-MM-DD) em Brasília. */
export function listarHorariosLivres(de: string, ate: string, sinal?: AbortSignal): Promise<HorarioLivre[]> {
  return chamarApi<HorarioLivre[]>(`/appointments/horarios-livres?de=${de}&ate=${ate}`, { sinal });
}

export function agendarConsulta(patientId: string, dataHora: string): Promise<Consulta> {
  return chamarApi<Consulta>(`/patients/${patientId}/appointments`, {
    metodo: 'POST',
    corpo: { data_hora: dataHora },
  });
}

/** RF-11. Para o paciente, o backend aplica a antecedência mínima (RN-10). */
export function cancelarConsulta(id: string): Promise<Consulta> {
  return chamarApi<Consulta>(`/appointments/${id}/cancel`, { metodo: 'POST' });
}

/** RF-12: revalida RN-07/08/09 no horário novo e RN-10 no atual. */
export function remarcarConsulta(id: string, dataHora: string): Promise<Consulta> {
  return chamarApi<Consulta>(`/appointments/${id}/reschedule`, {
    metodo: 'POST',
    corpo: { data_hora: dataHora },
  });
}
