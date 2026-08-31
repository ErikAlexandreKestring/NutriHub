import { Request, Response, NextFunction } from 'express';
import { MealPlansService } from './mealPlans.service';
import { addMealSchema, addMealItemSchema } from './mealPlans.validation';

export class MealPlansController {
  constructor(private readonly service: MealPlansService = new MealPlansService()) {}

  createDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plan = await this.service.createDraft(req.auth!.tenantId, req.params.patientId);
      res.status(201).json(plan);
    } catch (error) {
      next(error);
    }
  };

  listByPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plans = await this.service.listByPatient(req.auth!.tenantId, req.params.patientId);
      res.status(200).json(plans);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plan = await this.service.getById(req.auth!.tenantId, req.params.id);
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };

  addMeal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = addMealSchema.parse(req.body);
      const meal = await this.service.addMeal(req.auth!.tenantId, req.params.id, input);
      res.status(201).json(meal);
    } catch (error) {
      next(error);
    }
  };

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = addMealItemSchema.parse(req.body);
      const item = await this.service.addItem(req.auth!.tenantId, req.params.id, req.params.mealId, input);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  };

  publish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plan = await this.service.publish(req.auth!.tenantId, req.params.id);
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };
}
