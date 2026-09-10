import { Request, Response, NextFunction } from 'express';
import { AvailabilityService } from './availability.service';
import { createAvailabilitySchema } from './availability.validation';

export class AvailabilityController {
  constructor(private readonly service: AvailabilityService = new AvailabilityService()) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = createAvailabilitySchema.parse(req.body);
      const slot = await this.service.create(req.auth!.tenantId, input);
      res.status(201).json(slot);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slots = await this.service.list(req.auth!.tenantId);
      res.status(200).json(slots);
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.delete(req.auth!.tenantId, req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
