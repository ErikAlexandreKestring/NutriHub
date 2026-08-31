import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../shared/utils/jwt';
import { UnauthorizedError } from '../shared/errors/AppError';

// RF-03/RF-04: rotas de pacientes e planos alimentares exigem nutricionista autenticado.
// Extrai o tenant_id do JWT (RFC seção 5.4) para uso posterior via withTenant().
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    next(new UnauthorizedError());
    return;
  }

  try {
    const payload = verifyToken(token);
    req.auth = { userId: payload.user_id, tenantId: payload.tenant_id, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError());
  }
}
