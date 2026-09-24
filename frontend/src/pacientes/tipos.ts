/** Espelha o PatientRecord devolvido por /api/patients (patients.repository). */
export interface Paciente {
  id: string;
  nome: string;
  email: string;
  /** "AAAA-MM-DD" — ver `formatarDataSemHora`. */
  data_nascimento: string;
  contato: string | null;
  historico: string | null;
  status: 'ativo' | 'inativo';
  /** O paciente já definiu a senha pelo link de primeiro acesso. */
  acesso_liberado: boolean;
  created_at: string;
  updated_at: string;
}

/** Corpo de criação/edição, com os nomes de campo que o backend valida. */
export interface DadosDoPaciente {
  nome: string;
  email: string;
  data_nascimento: string;
  contato: string;
  historico: string;
}

/** POST /api/patients/:id/access-token — o token em claro só vem nesta resposta. */
export interface TokenDeAcesso {
  patient_id: string;
  token: string;
  expira_em: string;
}
