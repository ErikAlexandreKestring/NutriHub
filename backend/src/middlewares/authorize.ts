import { Request, Response, NextFunction, RequestHandler } from 'express';
import { UserRole } from '../shared/utils/jwt';
import { ForbiddenError, UnauthorizedError } from '../shared/errors/AppError';

/**
 * RF-02: o `authenticate` só prova QUEM é o portador do token. Como o JWT do
 * paciente carrega o mesmo tenant_id do seu nutricionista, o RLS sozinho não
 * separa os dois papéis — sem este middleware um paciente autenticado
 * conseguiria listar todos os pacientes do consultório.
 */
export function authorize(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }

    if (!roles.includes(req.auth.role)) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}

/**
 * Rotas aninhadas em /api/patients/:patientId/... servem aos dois papéis: o
 * nutricionista acessa qualquer paciente do seu tenant, o paciente só a si
 * mesmo (o user_id do seu JWT é o próprio patients.id).
 */
export function ensurePatientScope(req: Request, _res: Response, next: NextFunction): void {
  if (!req.auth) {
    next(new UnauthorizedError());
    return;
  }

  if (req.auth.role === 'paciente' && req.params.patientId !== req.auth.userId) {
    next(new ForbiddenError('Você só pode acessar os seus próprios dados'));
    return;
  }

  next();
}
