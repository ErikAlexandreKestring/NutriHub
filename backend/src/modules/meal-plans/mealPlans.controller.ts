import { Request, Response, NextFunction } from 'express';
import { MealPlansService } from './mealPlans.service';
import { AuditService } from '../audit/audit.service';
import {
  addMealSchema,
  mealItemSchema,
  publishMealPlanSchema,
  updateActiveMealPlanSchema,
} from './mealPlans.validation';

export class MealPlansController {
  constructor(
    private readonly service: MealPlansService = new MealPlansService(),
    private readonly audit: AuditService = new AuditService(),
  ) {}

  createDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plan = await this.service.createDraft(req.auth!.tenantId, req.params.patientId);
      await this.audit.record(req, 'PLANO_CRIADO', { planoId: plan.id, pacienteId: plan.patient_id });
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

  // RF-05: plano vigente do paciente. `tenantId` sai do token — o do paciente
  // carrega o tenant do seu nutricionista, então o RLS continua valendo igual.
  getActiveForPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plan = await this.service.getActiveForPatient(req.auth!.tenantId, req.params.patientId);
      res.status(200).json(plan);
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
      await this.audit.record(req, 'PLANO_ALTERADO', {
        planoId: req.params.id,
        acao: 'refeicao_adicionada',
        refeicaoId: meal.id,
      });
      res.status(201).json(meal);
    } catch (error) {
      next(error);
    }
  };

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = mealItemSchema.parse(req.body);
      const item = await this.service.addItem(req.auth!.tenantId, req.params.id, req.params.mealId, input);
      await this.audit.record(req, 'PLANO_ALTERADO', {
        planoId: req.params.id,
        acao: 'alimento_adicionado',
        refeicaoId: req.params.mealId,
        itemId: item.id,
      });
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  };

  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = mealItemSchema.parse(req.body);
      const item = await this.service.updateItem(
        req.auth!.tenantId,
        req.params.id,
        req.params.mealId,
        req.params.itemId,
        input,
      );
      // Vale também para o plano ativo: é a troca de alimento da issue #10.
      await this.audit.record(req, 'PLANO_ALTERADO', {
        planoId: req.params.id,
        acao: 'alimento_alterado',
        refeicaoId: req.params.mealId,
        itemId: req.params.itemId,
      });
      res.status(200).json(item);
    } catch (error) {
      next(error);
    }
  };

  removeMeal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.removeMeal(req.auth!.tenantId, req.params.id, req.params.mealId);
      await this.audit.record(req, 'PLANO_ALTERADO', {
        planoId: req.params.id,
        acao: 'refeicao_removida',
        refeicaoId: req.params.mealId,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.removeItem(req.auth!.tenantId, req.params.id, req.params.mealId, req.params.itemId);
      await this.audit.record(req, 'PLANO_ALTERADO', {
        planoId: req.params.id,
        acao: 'alimento_removido',
        refeicaoId: req.params.mealId,
        itemId: req.params.itemId,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  publish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = publishMealPlanSchema.parse(req.body);
      const plan = await this.service.publish(req.auth!.tenantId, req.params.id, input);
      // A publicação encerra o plano ativo anterior do paciente na mesma
      // transação (RN-02), então este evento também marca esse encerramento.
      await this.audit.record(req, 'PLANO_PUBLICADO', { planoId: plan.id, pacienteId: plan.patient_id });
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };

  updateActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = updateActiveMealPlanSchema.parse(req.body);
      const plan = await this.service.updateActive(req.auth!.tenantId, req.params.id, input);
      await this.audit.record(req, 'PLANO_ALTERADO', { planoId: req.params.id, acao: 'detalhes_alterados' });
      res.status(200).json(plan);
    } catch (error) {
      next(error);
    }
  };
}
