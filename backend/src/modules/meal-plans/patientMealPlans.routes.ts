import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { MealPlansController } from './mealPlans.controller';

// Montada em /api/patients/:patientId/meal-plans (mergeParams para acessar patientId).
const router = Router({ mergeParams: true });
const controller = new MealPlansController();

router.use(authenticate);
router.use(authorize('nutricionista'));
router.post('/', controller.createDraft);
router.get('/', controller.listByPatient);

export { router as patientMealPlansRoutes };
