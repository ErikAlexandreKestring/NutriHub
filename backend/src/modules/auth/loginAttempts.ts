/**
 * Controle de tentativas de login em memória — RF-02 / E-04:
 * após 5 tentativas inválidas, bloqueia o e-mail por 15 minutos.
 *
 * NOTA DE ARQUITETURA: em produção com múltiplas instâncias do App Service,
 * isto precisa migrar para um store compartilhado (ex.: tabela no Postgres
 * ou Redis) para que o bloqueio valha entre instâncias. Documentado como
 * dívida técnica aceitável para o escopo do TCC (RFC seção 5, Monolito Modular
 * roda como processo único).
 */

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, AttemptRecord>();

export function isLocked(email: string): boolean {
  const record = attempts.get(email);
  if (!record?.lockedUntil) return false;

  if (Date.now() >= record.lockedUntil) {
    attempts.delete(email);
    return false;
  }
  return true;
}

export function registerFailedAttempt(email: string): void {
  const record = attempts.get(email) ?? { count: 0, lockedUntil: null };
  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_DURATION_MS;
  }

  attempts.set(email, record);
}

export function clearAttempts(email: string): void {
  attempts.delete(email);
}

// Exposto apenas para os testes limparem o estado global entre casos.
export function __resetAllAttempts(): void {
  attempts.clear();
}
