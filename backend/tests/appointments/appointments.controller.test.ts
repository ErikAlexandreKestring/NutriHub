import { Request, Response } from 'express';
import { AppointmentsController } from '../../src/modules/appointments/appointments.controller';
import { AppointmentsService } from '../../src/modules/appointments/appointments.service';
import { AuditService } from '../../src/modules/audit/audit.service';
import { CancellationWindowError } from '../../src/shared/errors/AppError';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const PATIENT_ID = '33333333-3333-4333-8333-333333333333';

function buildRequest(): Request {
  return {
    params: { id: 'consulta-1' },
    ip: '203.0.113.7',
    auth: { userId: PATIENT_ID, tenantId: TENANT_ID, role: 'paciente' },
  } as unknown as Request;
}

function buildResponse() {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & typeof res;
}

function buildController(cancel: jest.Mock) {
  const service = { cancel } as unknown as AppointmentsService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return { controller: new AppointmentsController(service, audit as unknown as AuditService), audit };
}

describe('AppointmentsController — auditoria (RNF-10)', () => {
  it('registra CONSULTA_CANCELADA depois que o cancelamento é concluído', async () => {
    const dataHora = new Date('2026-11-10T13:00:00Z');
    const { controller, audit } = buildController(
      jest.fn().mockResolvedValue({ id: 'consulta-1', patient_id: PATIENT_ID, data_hora: dataHora }),
    );
    const req = buildRequest();

    await controller.cancel(req, buildResponse(), jest.fn());

    expect(audit.record).toHaveBeenCalledWith(req, 'CONSULTA_CANCELADA', {
      consultaId: 'consulta-1',
      pacienteId: PATIENT_ID,
      dataHora,
    });
  });

  it('não registra nada quando o cancelamento é recusado (E-19)', async () => {
    const { controller, audit } = buildController(jest.fn().mockRejectedValue(new CancellationWindowError()));
    const next = jest.fn();

    await controller.cancel(buildRequest(), buildResponse(), next);

    expect(audit.record).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(CancellationWindowError));
  });
});
