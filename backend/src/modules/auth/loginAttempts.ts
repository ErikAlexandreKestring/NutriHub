/**
 * Controle de tentativas de login em memória — RF-02 / E-04:
 * após 5 tentativas inválidas, bloqueia por 15 minutos.
 *
 * A contagem é em DUAS camadas, por (e-mail, origem) e por e-mail:
 *
 *   - Chavear só pelo e-mail (como era antes) transforma o bloqueio em negação
 *     de serviço: bastava conhecer o e-mail de alguém — inclusive de um paciente
 *     de outro consultório — e errar a senha 5 vezes para trancar a conta, sem
 *     precisar de senha nem de tenant.
 *   - Chavear só por (e-mail, origem) resolveria isso, mas deixaria a força
 *     bruta distribuída livre: cada IP novo ganharia 5 tentativas limpas.
 *
 * Por isso o limite por origem é baixo (5) e existe um teto por e-mail bem mais
 * alto (50): um atacante isolado não tranca a conta de ninguém, e ainda assim
 * nenhum e-mail sofre tentativas ilimitadas.
 *
 * NOTA DE ARQUITETURA: em produção com múltiplas instâncias do App Service,
 * isto precisa migrar para um store compartilhado (ex.: tabela no Postgres
 * ou Redis) para que o bloqueio valha entre instâncias. Documentado como
 * dívida técnica aceitável para o escopo do TCC (RFC seção 5, Monolito Modular
 * roda como processo único).
 */

const MAX_ATTEMPTS_PER_ORIGIN = 5;
const MAX_ATTEMPTS_PER_EMAIL = 50;
const LOCK_DURATION_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

// Requisição sem IP identificável (teste, socket unix) cai num balde único:
// nunca compartilha o balde de um cliente real.
const UNKNOWN_ORIGIN = 'desconhecida';

const byOrigin = new Map<string, AttemptRecord>();
const byEmail = new Map<string, AttemptRecord>();

function originKey(email: string, origem?: string): string {
  return `${email}|${origem || UNKNOWN_ORIGIN}`;
}

function isBucketLocked(bucket: Map<string, AttemptRecord>, key: string): boolean {
  const record = bucket.get(key);
  if (!record?.lockedUntil) return false;

  if (Date.now() >= record.lockedUntil) {
    bucket.delete(key);
    return false;
  }
  return true;
}

function bump(bucket: Map<string, AttemptRecord>, key: string, max: number): void {
  const record = bucket.get(key) ?? { count: 0, lockedUntil: null };
  record.count += 1;

  if (record.count >= max) {
    record.lockedUntil = Date.now() + LOCK_DURATION_MS;
  }

  bucket.set(key, record);
}

export function isLocked(email: string, origem?: string): boolean {
  return isBucketLocked(byOrigin, originKey(email, origem)) || isBucketLocked(byEmail, email);
}

export function registerFailedAttempt(email: string, origem?: string): void {
  bump(byOrigin, originKey(email, origem), MAX_ATTEMPTS_PER_ORIGIN);
  bump(byEmail, email, MAX_ATTEMPTS_PER_EMAIL);
}

export function clearAttempts(email: string, origem?: string): void {
  byOrigin.delete(originKey(email, origem));
  byEmail.delete(email);
}

// Exposto apenas para os testes limparem o estado global entre casos.
export function __resetAllAttempts(): void {
  byOrigin.clear();
  byEmail.clear();
}
