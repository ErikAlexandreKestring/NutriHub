import crypto from 'crypto';

/**
 * Token de primeiro acesso do paciente (RF-02).
 *
 * Diferente de senha, este é um segredo de alta entropia gerado pelo próprio
 * sistema — não precisa de bcrypt (que existe para resistir a força bruta em
 * segredos fracos escolhidos por humanos) e PRECISA de hash determinístico,
 * já que a busca é feita pelo hash. SHA-256 atende aos dois pontos.
 */
const TOKEN_BYTES = 32;
export const ACCESS_TOKEN_TTL_HOURS = 72;

export function generateAccessToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

export function hashAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function accessTokenExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + ACCESS_TOKEN_TTL_HOURS * 60 * 60 * 1000);
}
