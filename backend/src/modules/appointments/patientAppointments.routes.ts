import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { AppointmentsController } from './appointments.controller';

// Montada em /api/patients/:patientId/appointments (mergeParams para acessar patientId).
const router = Router({ mergeParams: true });
const controller = new AppointmentsController();

router.use(authenticate);
router.post('/', controller.create);
router.get('/', controller.listByPatient);

export { router as patientAppointmentsRoutes };
