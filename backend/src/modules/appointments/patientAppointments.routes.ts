import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { ensurePatientScope } from '../../middlewares/authorize';
import { AppointmentsController } from './appointments.controller';

// Montada em /api/patients/:patientId/appointments (mergeParams para acessar patientId).
const router = Router({ mergeParams: true });
const controller = new AppointmentsController();

router.use(authenticate);
// RF-08: o paciente agenda e consulta a própria agenda; o nutricionista, a de
// qualquer paciente do seu tenant.
router.use(ensurePatientScope);

router.post('/', controller.create);
router.get('/', controller.listByPatient);

export { router as patientAppointmentsRoutes };
