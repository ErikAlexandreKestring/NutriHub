import { Request, Response, NextFunction } from 'express';
import { AvailabilityService } from './availability.service';
import { AuditService } from '../audit/audit.service';
import { createAvailabilitySchema } from './availability.validation';

export class AvailabilityController {
  constructor(
    private readonly service: AvailabilityService = new AvailabilityService(),
    private readonly audit: AuditService = new AuditService(),
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = createAvailabilitySchema.parse(req.body);
      const slot = await this.service.create(req.auth!.tenantId, input);
      await this.audit.record(req, 'DISPONIBILIDADE_CRIADA', {
        disponibilidadeId: slot.id,
        diaDaSemana: slot.day_of_week,
        inicio: slot.start_time,
        fim: slot.end_time,
      });
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
      await this.audit.record(req, 'DISPONIBILIDADE_REMOVIDA', { disponibilidadeId: req.params.id });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
