import { Request, Response } from 'express';
import { createAuthenticate } from '../../src/middlewares/authenticate';
import { signToken } from '../../src/shared/utils/jwt';
import { InvalidTokenTenantError, UnauthorizedError } from '../../src/shared/errors/AppError';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const OUTRO_TENANT_ID = '22222222-2222-4222-8222-222222222222';
const PATIENT_ID = '33333333-3333-4333-8333-333333333333';

function buildRequest(authorization?: string): Request {
  return { headers: { authorization }, ip: '203.0.113.7', method: 'GET', originalUrl: '/api/patients' } as unknown as Request;
}

function buildDeps({ tenantExists = true, patientBelongs = true } = {}) {
  return {
    scope: {
      tenantExists: jest.fn().mockResolvedValue(tenantExists),
      patientBelongsToTenant: jest.fn().mockResolvedValue(patientBelongs),
    },
    audit: { register: jest.fn().mockResolvedValue(undefined) },
  };
}

describe('authenticate middleware', () => {
  it('popula req.auth com os dados do token quando o Bearer token é válido', async () => {
    const deps = buildDeps();
    const token = signToken({ user_id: TENANT_ID, tenant_id: TENANT_ID, role: 'nutricionista' });
    const req = buildRequest(`Bearer ${token}`);
    const next = jest.fn();

    await createAuthenticate(deps)(req, {} as Response, next);

    expect(req.auth).toEqual({ userId: TENANT_ID, tenantId: TENANT_ID, role: 'nutricionista' });
    expect(next).toHaveBeenCalledWith();
    expect(deps.scope.tenantExists).toHaveBeenCalledWith(TENANT_ID);
    expect(deps.audit.register).not.toHaveBeenCalled();
  });

  it('aceita o paciente quando ele pertence ao tenant do token', async () => {
    const deps = buildDeps();
    const token = signToken({ user_id: PATIENT_ID, tenant_id: TENANT_ID, role: 'paciente' });
    const req = buildRequest(`Bearer ${token}`);
    const next = jest.fn();

    await createAuthenticate(deps)(req, {} as Response, next);

    expect(deps.scope.patientBelongsToTenant).toHaveBeenCalledWith(TENANT_ID, PATIENT_ID);
    expect(req.auth).toEqual({ userId: PATIENT_ID, tenantId: TENANT_ID, role: 'paciente' });
    expect(next).toHaveBeenCalledWith();
  });

  it('chama next com UnauthorizedError quando não há header de autorização', async () => {
    const next = jest.fn();

    await createAuthenticate(buildDeps())(buildRequest(undefined), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('chama next com UnauthorizedError quando o token é inválido', async () => {
    const next = jest.fn();

    await createAuthenticate(buildDeps())(buildRequest('Bearer token-invalido'), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('chama next com UnauthorizedError quando o header não usa o esquema Bearer', async () => {
    const next = jest.fn();

    await createAuthenticate(buildDeps())(buildRequest('Basic algumacoisa'), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  describe('E-06: token com tenant_id inválido', () => {
    it('responde 403 e registra auditoria quando o tenant do nutricionista não existe', async () => {
      const deps = buildDeps({ tenantExists: false });
      const token = signToken({ user_id: TENANT_ID, tenant_id: TENANT_ID, role: 'nutricionista' });
      const req = buildRequest(`Bearer ${token}`);
      const next = jest.fn();

      await createAuthenticate(deps)(req, {} as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(InvalidTokenTenantError));
      expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403, code: 'E-06' });
      expect(req.auth).toBeUndefined();
      expect(deps.audit.register).toHaveBeenCalledWith({
        evento: 'TOKEN_TENANT_INVALIDO',
        userId: TENANT_ID,
        tenantId: TENANT_ID,
        ip: '203.0.113.7',
        detalhes: { role: 'nutricionista', metodo: 'GET', rota: '/api/patients' },
      });
    });

    it('rejeita token de nutricionista cujo user_id difere do tenant_id', async () => {
      const deps = buildDeps();
      const token = signToken({ user_id: TENANT_ID, tenant_id: OUTRO_TENANT_ID, role: 'nutricionista' });
      const next = jest.fn();

      await createAuthenticate(deps)(buildRequest(`Bearer ${token}`), {} as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(InvalidTokenTenantError));
      expect(deps.audit.register).toHaveBeenCalled();
    });

    it('rejeita o paciente que não pertence ao tenant do token', async () => {
      const deps = buildDeps({ patientBelongs: false });
      const token = signToken({ user_id: PATIENT_ID, tenant_id: OUTRO_TENANT_ID, role: 'paciente' });
      const next = jest.fn();

      await createAuthenticate(deps)(buildRequest(`Bearer ${token}`), {} as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(InvalidTokenTenantError));
      expect(deps.audit.register).toHaveBeenCalledWith(
        expect.objectContaining({ userId: PATIENT_ID, tenantId: OUTRO_TENANT_ID }),
      );
    });

    it('rejeita tenant_id que não é UUID sem consultar o banco', async () => {
      const deps = buildDeps();
      const token = signToken({ user_id: 'u1', tenant_id: 't1', role: 'nutricionista' });
      const next = jest.fn();

      await createAuthenticate(deps)(buildRequest(`Bearer ${token}`), {} as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(InvalidTokenTenantError));
      expect(deps.scope.tenantExists).not.toHaveBeenCalled();
      expect(deps.audit.register).toHaveBeenCalledWith(
        expect.objectContaining({ userId: undefined, tenantId: undefined }),
      );
    });

    it('mantém o 403 mesmo se a gravação da auditoria falhar', async () => {
      const deps = buildDeps({ tenantExists: false });
      deps.audit.register.mockRejectedValue(new Error('banco fora'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const token = signToken({ user_id: TENANT_ID, tenant_id: TENANT_ID, role: 'nutricionista' });
      const req = buildRequest(`Bearer ${token}`);
      const next = jest.fn();

      await createAuthenticate(deps)(req, {} as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(InvalidTokenTenantError));
      expect(req.auth).toBeUndefined();
      consoleError.mockRestore();
    });
  });

  it('repassa ao errorHandler a falha ao consultar o vínculo, sem autenticar', async () => {
    const deps = buildDeps();
    const falha = new Error('conexão perdida');
    deps.scope.tenantExists.mockRejectedValue(falha);
    const token = signToken({ user_id: TENANT_ID, tenant_id: TENANT_ID, role: 'nutricionista' });
    const req = buildRequest(`Bearer ${token}`);
    const next = jest.fn();

    await createAuthenticate(deps)(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(falha);
    expect(req.auth).toBeUndefined();
  });
});
