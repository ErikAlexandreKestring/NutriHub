import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../shared/errors/AppError';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message, issues: err.issues });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
    return;
  }

  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' });
}
