import { Request, Response, NextFunction } from 'express';
import { AppointmentsService } from './appointments.service';
import { dateTimeSchema, cancelAppointmentSchema } from './appointments.validation';

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
      const input = cancelAppointmentSchema.parse(req.body);
      const appointment = await this.service.cancel(req.auth!.tenantId, req.params.id, input.ator);
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  };

  reschedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = dateTimeSchema.parse(req.body);
      const appointment = await this.service.reschedule(req.auth!.tenantId, req.params.id, input);
      res.status(200).json(appointment);
    } catch (error) {
      next(error);
    }
  };
}
