import { Request, Response, NextFunction } from 'express';
import { AppointmentsService } from './appointments.service';
import { AuditService } from '../audit/audit.service';
import { dateTimeSchema, freeSlotsQuerySchema } from './appointments.validation';

// Quando quem chama é o paciente, o user_id do JWT É o patients.id — usado para
// restringir a operação às consultas dele. Para o nutricionista, undefined:
// ele opera sobre qualquer consulta do seu tenant.
function ownPatientId(req: Request): string | undefined {
  return req.auth!.role === 'paciente' ? req.auth!.userId : undefined;
}

export class AppointmentsController {
  constructor(
    private readonly service: AppointmentsService = new AppointmentsService(),
    private readonly audit: AuditService = new AuditService(),
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = dateTimeSchema.parse(req.body);
      const appointment = await this.service.create(req.auth!.tenantId, req.params.patientId, input);
      await this.audit.record(req, 'CONSULTA_AGENDADA', {
        consultaId: appointment.id,
        pacienteId: appointment.patient_id,
        dataHora: appointment.data_hora,
      });
      res.status(201).json(appointment);
    } catch (error) {
      next(error);
    }
  };

  listByPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const appointments = await this.service.listByPatient(req.auth!.tenantId, req.params.patientId);
      res.status(200).json(appointments);
    } catch (error) {
      next(error);
    }
  };

  listUpcoming = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const appointments = await this.service.listUpcoming(req.auth!.tenantId);
      res.status(200).json(appointments);
    } catch (error) {
      next(error);
    }
  };

  listFreeSlots = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = freeSlotsQuerySchema.parse(req.query);
      const slots = await this.service.listFreeSlots(req.auth!.tenantId, query);
      res.status(200).json(slots);
    } catch (error) {
      next(error);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantId, role } = req.auth!;
      const appointment = await this.service.cancel(tenantId, req.params.id, role, ownPatientId(req));
      await this.audit.record(req, 'CONSULTA_CANCELADA', {
        consultaId: appointment.id,
        pacienteId: appointment.patient_id,
        dataHora: appointment.data_hora,
      });
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  };

  reschedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = dateTimeSchema.parse(req.body);
      const { tenantId, role } = req.auth!;
      const appointment = await this.service.reschedule(
        tenantId,
        req.params.id,
        input,
        role,
        ownPatientId(req),
      );
      await this.audit.record(req, 'CONSULTA_REMARCADA', {
        consultaId: appointment.id,
        pacienteId: appointment.patient_id,
        novaDataHora: appointment.data_hora,
      });
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  };
}
