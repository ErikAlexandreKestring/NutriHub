import { Request, Response } from 'express';
import { authorize, ensurePatientScope } from '../../src/middlewares/authorize';
import { UserRole } from '../../src/shared/utils/jwt';
import { ForbiddenError, UnauthorizedError } from '../../src/shared/errors/AppError';

function buildRequest(
  auth?: { userId: string; tenantId: string; role: UserRole },
  params: Record<string, string> = {},
): Request {
  return { auth, params } as unknown as Request;
}

describe('authorize middleware (RF-02)', () => {
  it('deixa passar quando o papel do token está na lista permitida', () => {
    const req = buildRequest({ userId: 'u1', tenantId: 't1', role: 'nutricionista' });
    const next = jest.fn();

    authorize('nutricionista')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('bloqueia o paciente em rota exclusiva do nutricionista (RF-03)', () => {
    const req = buildRequest({ userId: 'p1', tenantId: 't1', role: 'paciente' });
    const next = jest.fn();

    authorize('nutricionista')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('aceita qualquer um dos papéis informados', () => {
    const req = buildRequest({ userId: 'p1', tenantId: 't1', role: 'paciente' });
    const next = jest.fn();

    authorize('nutricionista', 'paciente')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('exige autenticação prévia', () => {
    const next = jest.fn();

    authorize('nutricionista')(buildRequest(undefined), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});

describe('ensurePatientScope (RF-02)', () => {
  it('deixa o paciente acessar os próprios dados', () => {
    const req = buildRequest({ userId: 'patient-1', tenantId: 't1', role: 'paciente' }, { patientId: 'patient-1' });
    const next = jest.fn();

    ensurePatientScope(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('bloqueia o paciente que tenta acessar outro paciente do mesmo tenant', () => {
    // Caso crítico: o RLS sozinho não pega isto, porque os dois pacientes
    // compartilham o tenant_id do mesmo nutricionista.
    const req = buildRequest({ userId: 'patient-1', tenantId: 't1', role: 'paciente' }, { patientId: 'patient-2' });
    const next = jest.fn();

    ensurePatientScope(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('não restringe o nutricionista, que atende qualquer paciente do seu tenant', () => {
    const req = buildRequest({ userId: 'tenant-1', tenantId: 'tenant-1', role: 'nutricionista' }, { patientId: 'patient-2' });
    const next = jest.fn();

    ensurePatientScope(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });
});
