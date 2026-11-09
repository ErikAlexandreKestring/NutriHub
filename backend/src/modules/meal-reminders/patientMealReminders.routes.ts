import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize, ensurePatientScope } from '../../middlewares/authorize';
import { MealRemindersController } from './mealReminders.controller';

// Montada em /api/patients/:patientId/lembrete (mergeParams para acessar patientId).
const router = Router({ mergeParams: true });
const controller = new MealRemindersController();

router.use(authenticate);

// RF-07: só o próprio paciente liga e desliga o lembrete diário das refeições.
router.get('/', authorize('paciente'), ensurePatientScope, controller.getPreferencia);
router.put('/', authorize('paciente'), ensurePatientScope, controller.setPreferencia);

export { router as patientMealRemindersRoutes };
