import { Request, Response, NextFunction } from 'express';
import { AppointmentsService } from './appointments.service';
import { dateTimeSchema } from './appointments.validation';

// Quando quem chama é o paciente, o user_id do JWT É o patients.id — usado para
// restringir a operação às consultas dele. Para o nutricionista, undefined:
// ele opera sobre qualquer consulta do seu tenant.
function ownPatientId(req: Request): string | undefined {
  return req.auth!.role === 'paciente' ? req.auth!.userId : undefined;
}

export class AppointmentsController {
  constructor(private readonly service: AppointmentsService = new AppointmentsService()) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = dateTimeSchema.parse(req.body);
      const appointment = await this.service.create(req.auth!.tenantId, req.params.patientId, input);
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

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantId, role } = req.auth!;
      const appointment = await this.service.cancel(tenantId, req.params.id, role, ownPatientId(req));
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  };

  reschedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = dateTimeSchema.parse(req.body);
      const appointment = await this.service.reschedule(
        req.auth!.tenantId,
        req.params.id,
        input,
        ownPatientId(req),
      );
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  };
}
