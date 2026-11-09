import { Request, Response, NextFunction } from 'express';
import { MealRemindersService } from './mealReminders.service';
import { preferenciaDeLembreteSchema } from './mealReminders.validation';

export class MealRemindersController {
  constructor(private readonly service: MealRemindersService = new MealRemindersService()) {}

  getPreferencia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const preferencia = await this.service.preferencia(req.auth!.tenantId, req.params.patientId);
      res.status(200).json(preferencia);
    } catch (error) {
      next(error);
    }
  };

  setPreferencia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ativo } = preferenciaDeLembreteSchema.parse(req.body);
      const preferencia = await this.service.definirPreferencia(req.auth!.tenantId, req.params.patientId, ativo);
      res.status(200).json(preferencia);
    } catch (error) {
      next(error);
    }
  };
}
