import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { FeedbacksController } from './feedbacks.controller';

// Montada em /api/feedbacks: a caixa de entrada do consultório, com o nome de
// todos os pacientes — só o nutricionista.
const router = Router();
const controller = new FeedbacksController();

router.use(authenticate);
router.use(authorize('nutricionista'));

router.get('/', controller.listForTenant);
router.post('/:id/resolve', controller.resolve);

export { router as feedbacksRoutes };
