import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { MealPlansController } from './mealPlans.controller';

// Montada em /api/meal-plans.
const router = Router();
const controller = new MealPlansController();

router.use(authenticate);
// O construtor de plano é do nutricionista (RF-04). A visualização pelo
// paciente (RF-05) terá rota própria.
router.use(authorize('nutricionista'));
router.get('/:id', controller.getById);
// Corrige meta/orientações do plano já ativo, sem republicar (issue #10).
router.patch('/:id', controller.updateActive);
router.post('/:id/meals', controller.addMeal);
router.post('/:id/meals/:mealId/items', controller.addItem);
router.post('/:id/publish', controller.publish);

export { router as mealPlansRoutes };
