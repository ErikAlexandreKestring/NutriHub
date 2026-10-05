import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize, ensurePatientScope } from '../../middlewares/authorize';
import { FeedbacksController } from './feedbacks.controller';

// Montada em /api/patients/:patientId/feedbacks (mergeParams para acessar patientId).
const router = Router({ mergeParams: true });
const controller = new FeedbacksController();

router.use(authenticate);
router.use(ensurePatientScope);

// RF-06: quem relata a dificuldade é o próprio paciente. O nutricionista só
// consulta o histórico de feedbacks de cada paciente.
router.post('/', authorize('paciente'), controller.create);
router.get('/', controller.listByPatient);

export { router as patientFeedbacksRoutes };
