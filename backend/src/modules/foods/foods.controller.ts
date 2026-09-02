import { Request, Response, NextFunction } from 'express';
import { FoodsRepository } from './foods.repository';

export class FoodsController {
  constructor(private readonly repository: FoodsRepository = new FoodsRepository()) {}

  // RF-04: lista de alimentos da base TACO para o construtor de plano alimentar buscar.
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const foods = await this.repository.list(search);
      res.status(200).json(foods);
    } catch (error) {
      next(error);
    }
  };
}
