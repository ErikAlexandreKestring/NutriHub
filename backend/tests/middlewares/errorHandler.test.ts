import { Request, Response } from 'express';
import { errorHandler } from '../../src/middlewares/errorHandler';
import { ValidationError, PatientNotFoundError } from '../../src/shared/errors/AppError';

function buildResponse(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('responde 400 com issues para ValidationError', () => {
    const res = buildResponse();
    errorHandler(new ValidationError([{ path: 'nome', message: 'obrigatório' }]), {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR', issues: [{ path: 'nome', message: 'obrigatório' }] }),
    );
  });

  it('responde com o statusCode/code de um AppError conhecido', () => {
    const res = buildResponse();
    errorHandler(new PatientNotFoundError(), {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('responde 400 quando um ID inválido chega cru como erro do Postgres (22P02)', () => {
    const res = buildResponse();
    errorHandler({ code: '22P02', message: 'invalid input syntax for type uuid' }, {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('responde 500 para qualquer outro erro não mapeado', () => {
    const res = buildResponse();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    errorHandler(new Error('boom'), {} as Request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
    consoleSpy.mockRestore();
  });
});
