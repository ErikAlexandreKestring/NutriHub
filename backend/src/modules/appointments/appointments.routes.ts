import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { AppointmentsController } from './appointments.controller';

// Montada em /api/appointments.
const router = Router();
const controller = new AppointmentsController();

router.use(authenticate);
router.post('/:id/cancel', controller.cancel);
router.post('/:id/reschedule', controller.reschedule);

export { router as appointmentsRoutes };
