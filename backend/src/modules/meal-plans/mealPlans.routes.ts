import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { MealPlansController } from './mealPlans.controller';

// Montada em /api/meal-plans.
const router = Router();
const controller = new MealPlansController();

router.use(authenticate);
router.get('/:id', controller.getById);
router.post('/:id/meals', controller.addMeal);
router.post('/:id/meals/:mealId/items', controller.addItem);
router.post('/:id/publish', controller.publish);

export { router as mealPlansRoutes };
