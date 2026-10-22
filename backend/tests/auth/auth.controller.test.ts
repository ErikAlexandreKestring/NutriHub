import { Request, Response } from 'express';
import { AuthController } from '../../src/modules/auth/auth.controller';
import { AuthService } from '../../src/modules/auth/auth.service';
import { AuditService } from '../../src/modules/audit/audit.service';
import { signToken } from '../../src/shared/utils/jwt';
import { AccountLockedError, InvalidCredentialsError, ValidationError } from '../../src/shared/errors/AppError';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const PATIENT_ID = '33333333-3333-4333-8333-333333333333';

function buildRequest(body: unknown): Request {
  return { body, ip: '203.0.113.7' } as unknown as Request;
}

function buildResponse() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & typeof res;
}

function buildController(login: jest.Mock) {
  const service = { login } as unknown as AuthService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return { controller: new AuthController(service, audit as unknown as AuditService), audit };
}

const credenciais = { email: 'paciente@nutrihub.com', senha: 'senhaDoPaciente1' };

describe('AuthController — auditoria do login (RNF-10)', () => {
  it('registra LOGIN_SUCESSO com o paciente e o tenant do token emitido', async () => {
    const token = signToken({ user_id: PATIENT_ID, tenant_id: TENANT_ID, role: 'paciente' });
    const { controller, audit } = buildController(
      jest.fn().mockResolvedValue({ token, role: 'paciente', patient: { id: PATIENT_ID } }),
    );
    const req = buildRequest(credenciais);
    const res = buildResponse();
    const next = jest.fn();

    await controller.login(req, res, next);

    expect(audit.record).toHaveBeenCalledWith(req, 'LOGIN_SUCESSO', { papel: 'paciente' }, {
      userId: PATIENT_ID,
      tenantId: TENANT_ID,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('registra LOGIN_FALHOU com o e-mail tentado quando a senha está errada', async () => {
    const { controller, audit } = buildController(jest.fn().mockRejectedValue(new InvalidCredentialsError()));
    const req = buildRequest(credenciais);
    const next = jest.fn();

    await controller.login(req, buildResponse(), next);

    expect(audit.record).toHaveBeenCalledWith(req, 'LOGIN_FALHOU', {
      email: credenciais.email,
      motivo: 'credenciais_invalidas',
    });
    expect(next).toHaveBeenCalledWith(expect.any(InvalidCredentialsError));
  });

  it('registra LOGIN_FALHOU com motivo "bloqueado" durante o bloqueio do E-04', async () => {
    const { controller, audit } = buildController(jest.fn().mockRejectedValue(new AccountLockedError()));
    const req = buildRequest(credenciais);

    await controller.login(req, buildResponse(), jest.fn());

    expect(audit.record).toHaveBeenCalledWith(req, 'LOGIN_FALHOU', {
      email: credenciais.email,
      motivo: 'bloqueado',
    });
  });

  it('não registra nada quando o corpo nem passa na validação', async () => {
    const login = jest.fn();
    const { controller, audit } = buildController(login);
    const next = jest.fn();

    await controller.login(buildRequest({ email: 'nao-e-email' }), buildResponse(), next);

    expect(login).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });
});
