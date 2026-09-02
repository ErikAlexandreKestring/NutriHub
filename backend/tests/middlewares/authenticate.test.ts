import { Request, Response } from 'express';
import { authenticate } from '../../src/middlewares/authenticate';
import { signToken } from '../../src/shared/utils/jwt';
import { UnauthorizedError } from '../../src/shared/errors/AppError';

function buildRequest(authorization?: string): Request {
  return { headers: { authorization } } as unknown as Request;
}

describe('authenticate middleware', () => {
  it('popula req.auth com os dados do token quando o Bearer token é válido', () => {
    const token = signToken({ user_id: 'u1', tenant_id: 't1', role: 'nutricionista' });
    const req = buildRequest(`Bearer ${token}`);
    const next = jest.fn();

    authenticate(req, {} as Response, next);

    expect(req.auth).toEqual({ userId: 'u1', tenantId: 't1', role: 'nutricionista' });
    expect(next).toHaveBeenCalledWith();
  });

  it('chama next com UnauthorizedError quando não há header de autorização', () => {
    const req = buildRequest(undefined);
    const next = jest.fn();

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('chama next com UnauthorizedError quando o token é inválido', () => {
    const req = buildRequest('Bearer token-invalido');
    const next = jest.fn();

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('chama next com UnauthorizedError quando o header não usa o esquema Bearer', () => {
    const req = buildRequest('Basic algumacoisa');
    const next = jest.fn();

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
