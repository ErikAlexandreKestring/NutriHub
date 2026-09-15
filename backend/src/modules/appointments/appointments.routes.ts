import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { AppointmentsController } from './appointments.controller';

// Montada em /api/appointments.
const router = Router();
const controller = new AppointmentsController();

router.use(authenticate);

// RF-11/RF-12 são dos dois atores. Quem é quem sai do JWT (ver controller):
// o paciente fica restrito às próprias consultas e sujeito à RN-10, o
// nutricionista opera qualquer consulta do seu tenant a qualquer momento.
router.post('/:id/cancel', controller.cancel);
router.post('/:id/reschedule', controller.reschedule);

export { router as appointmentsRoutes };
