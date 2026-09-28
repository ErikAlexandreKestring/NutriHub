import { vi } from 'vitest';
import type { Consulta, Disponibilidade } from '../tipos';

/**
 * Quinta, 1º/10/2026, 09:00 em Brasília. Só o `Date` é congelado: timers e
 * promises seguem reais, senão o userEvent e o fetch mockado travariam.
 */
export const AGORA = new Date('2026-10-01T12:00:00.000Z');

export function congelarRelogio() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
}

/** O seletor pede sempre as duas semanas a partir de hoje. */
export const ROTA_HORARIOS_LIVRES = 'GET /api/appointments/horarios-livres?de=2026-10-01&ate=2026-10-14';

/** Segunda (05/10) às 09h e 10h, terça (06/10) às 09h — horário de Brasília. */
export const HORARIOS_LIVRES = [
  { data_hora: '2026-10-05T12:00:00.000Z' },
  { data_hora: '2026-10-05T13:00:00.000Z' },
  { data_hora: '2026-10-06T12:00:00.000Z' },
];

export function consulta(sobrescritas: Partial<Consulta> = {}): Consulta {
  return {
    id: 'appt-1',
    patient_id: 'patient-1',
    data_hora: '2026-10-03T13:00:00.000Z',
    status: 'confirmado',
    created_at: '2026-09-20T12:00:00.000Z',
    updated_at: '2026-09-20T12:00:00.000Z',
    ...sobrescritas,
  };
}

export function intervalo(sobrescritas: Partial<Disponibilidade> = {}): Disponibilidade {
  return { id: 'av-1', day_of_week: 1, start_time: '08:00:00', end_time: '12:00:00', ...sobrescritas };
}
