import { Request, Response, NextFunction } from 'express';
import { PatientsService } from './patients.service';
import { createPatientSchema, updatePatientSchema } from './patients.validation';

export class PatientsController {
  constructor(private readonly service: PatientsService = new PatientsService()) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = createPatientSchema.parse(req.body);
      const patient = await this.service.create(req.auth!.tenantId, input);
      res.status(201).json(patient);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patients = await this.service.list(req.auth!.tenantId);
      res.status(200).json(patients);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patient = await this.service.getById(req.auth!.tenantId, req.params.id);
      res.status(200).json(patient);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = updatePatientSchema.parse(req.body);
      const patient = await this.service.update(req.auth!.tenantId, req.params.id, input);
      res.status(200).json(patient);
    } catch (error) {
      next(error);
    }
  };

  inactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patient = await this.service.inactivate(req.auth!.tenantId, req.params.id);
      res.status(200).json(patient);
    } catch (error) {
      next(error);
    }
  };
}
