import { Request, Response, NextFunction } from 'express';
import { NutricionistaService } from './nutricionista.service';

export class NutricionistaController {
  constructor(private readonly service: NutricionistaService = new NutricionistaService()) {}

  getContato = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contato = await this.service.getContato(req.auth!.tenantId);
      res.status(200).json(contato);
    } catch (error) {
      next(error);
    }
  };
}
