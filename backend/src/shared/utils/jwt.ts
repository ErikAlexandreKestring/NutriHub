import { createSecretKey, KeyObject } from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export type UserRole = 'nutricionista' | 'paciente';

export interface JwtPayload {
  user_id: string;
  tenant_id: string;
  role: UserRole;
}

/**
 * O segredo vai para o jsonwebtoken como KeyObject, criado uma vez só.
 *
 * Com o segredo em texto, o jsonwebtoken 9 tenta a cada chamada lê-lo como
 * chave pública (createPublicKey), falha, e só então cria a chave secreta. Esse
 * erro jogado e descartado em toda requisição autenticada era um terço da CPU
 * da API no teste de carga (RNF-06), e pesa ainda mais no B1 da Azure.
 *
 * A chave é refeita se o segredo mudar, o que só acontece nos testes.
 */
let chave: { segredo: string; objeto: KeyObject } | undefined;

function chaveDoJwt(): KeyObject {
  if (chave?.segredo !== env.jwt.secret) {
    chave = { segredo: env.jwt.secret, objeto: createSecretKey(Buffer.from(env.jwt.secret)) };
  }
  return chave.objeto;
}

// RF-02: JWT com exp de 8h (nutricionista) ou 24h (paciente).
export function signToken(payload: JwtPayload): string {
  const expiresIn = (payload.role === 'nutricionista'
    ? env.jwt.expiresInNutricionista
    : env.jwt.expiresInPaciente) as jwt.SignOptions['expiresIn'];

  return jwt.sign(payload, chaveDoJwt(), { algorithm: 'HS256', expiresIn });
}

export function verifyToken(token: string): JwtPayload {
  // Só HS256: um token assinado com outro algoritmo é recusado de cara.
  return jwt.verify(token, chaveDoJwt(), { algorithms: ['HS256'] }) as JwtPayload;
}
