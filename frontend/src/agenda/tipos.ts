/** Espelha o AppointmentRecord de /api/appointments (appointments.repository). */
export interface Consulta {
  id: string;
  patient_id: string;
  /** Instante ISO em UTC — ver `formatarDataHora`, que exibe em Brasília. */
  data_hora: string;
  status: 'confirmado' | 'cancelado';
  created_at: string;
  updated_at: string;
}

/** Linha de GET /api/appointments: a agenda do consultório, com o paciente. */
export interface ConsultaDoConsultorio extends Consulta {
  patient_nome: string;
}

/** Intervalo da grade (GET /api/availability). `time` do Postgres: HH:MM:SS. */
export interface Disponibilidade {
  id: string;
  /** 0 = domingo … 6 = sábado. */
  day_of_week: number;
  start_time: string;
  end_time: string;
}

/** Corpo do POST /api/availability, com os nomes que o backend valida. */
export interface DadosDaDisponibilidade {
  day_of_week: string;
  start_time: string;
  end_time: string;
}

/** GET /api/appointments/horarios-livres. */
export interface HorarioLivre {
  data_hora: string;
}
