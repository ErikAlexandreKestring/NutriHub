import { Request, Response, NextFunction } from 'express';
import { FeedbacksService } from './feedbacks.service';
import { createFeedbackSchema, listFeedbacksQuerySchema, resolveFeedbackSchema } from './feedbacks.validation';

export class FeedbacksController {
  constructor(private readonly service: FeedbacksService = new FeedbacksService()) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = createFeedbackSchema.parse(req.body);
      const feedback = await this.service.create(req.auth!.tenantId, req.params.patientId, input);
      res.status(201).json(feedback);
    } catch (error) {
      next(error);
    }
  };

  listByPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const feedbacks = await this.service.listByPatient(req.auth!.tenantId, req.params.patientId);
      res.status(200).json(feedbacks);
    } catch (error) {
      next(error);
    }
  };

  listForTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = listFeedbacksQuerySchema.parse(req.query);
      const feedbacks = await this.service.listForTenant(req.auth!.tenantId, query);
      res.status(200).json(feedbacks);
    } catch (error) {
      next(error);
    }
  };

  resolve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = resolveFeedbackSchema.parse(req.body);
      const feedback = await this.service.resolve(req.auth!.tenantId, req.params.id, input);
      res.status(200).json(feedback);
    } catch (error) {
      next(error);
    }
  };
}
