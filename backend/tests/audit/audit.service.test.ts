import { Request } from 'express';
import { AuditService } from '../../src/modules/audit/audit.service';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const PATIENT_ID = '33333333-3333-4333-8333-333333333333';

function buildRequest(auth?: Request['auth']): Request {
  return { ip: '203.0.113.7', auth } as unknown as Request;
}

describe('AuditService (RNF-10)', () => {
  it('registra o evento com usuário, tenant e IP tirados da requisição autenticada', async () => {
    const repository = { register: jest.fn().mockResolvedValue(undefined) };
    const service = new AuditService(repository);

    await service.record(
      buildRequest({ userId: PATIENT_ID, tenantId: TENANT_ID, role: 'paciente' }),
      'CONSULTA_AGENDADA',
      { consultaId: 'consulta-1' },
    );

    expect(repository.register).toHaveBeenCalledWith({
      evento: 'CONSULTA_AGENDADA',
      userId: PATIENT_ID,
      tenantId: TENANT_ID,
      ip: '203.0.113.7',
      detalhes: { papel: 'paciente', consultaId: 'consulta-1' },
    });
  });

  it('usa o autor informado nas rotas públicas, em que não há req.auth', async () => {
    const repository = { register: jest.fn().mockResolvedValue(undefined) };
    const service = new AuditService(repository);

    await service.record(buildRequest(), 'LOGIN_SUCESSO', { papel: 'paciente' }, {
      userId: PATIENT_ID,
      tenantId: TENANT_ID,
    });

    expect(repository.register).toHaveBeenCalledWith(
      expect.objectContaining({ userId: PATIENT_ID, tenantId: TENANT_ID, detalhes: { papel: 'paciente' } }),
    );
  });

  it('não propaga a falha de gravação do log — a ação já foi concluída', async () => {
    const repository = { register: jest.fn().mockRejectedValue(new Error('banco fora do ar')) };
    const service = new AuditService(repository);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.record(buildRequest(), 'LOGIN_FALHOU')).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
