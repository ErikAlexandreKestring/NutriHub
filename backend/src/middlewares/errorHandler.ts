import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../shared/errors/AppError';

// Código do Postgres para "invalid_text_representation" — ocorre quando um
// parâmetro de rota (ex.: :id) não é um UUID válido e chega cru numa query.
// Sem isso, vira um 500 genérico em vez de um erro de validação claro.
const PG_INVALID_TEXT_REPRESENTATION = '22P02';

function isInvalidUuidError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === PG_INVALID_TEXT_REPRESENTATION;
}

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

  if (isInvalidUuidError(err)) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Identificador inválido' });
    return;
  }

  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' });
}
