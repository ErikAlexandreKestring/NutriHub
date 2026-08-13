import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export type UserRole = 'nutricionista' | 'paciente';

export interface JwtPayload {
  user_id: string;
  tenant_id: string;
  role: UserRole;
}

// RF-02: JWT com exp de 8h (nutricionista) ou 24h (paciente).
export function signToken(payload: JwtPayload): string {
  const expiresIn = (payload.role === 'nutricionista'
    ? env.jwt.expiresInNutricionista
    : env.jwt.expiresInPaciente) as jwt.SignOptions['expiresIn'];

  return jwt.sign(payload, env.jwt.secret, { expiresIn });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.secret) as JwtPayload;
}
