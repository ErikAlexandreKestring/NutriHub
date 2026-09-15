import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { AvailabilityController } from './availability.controller';

const router = Router();
const controller = new AvailabilityController();

router.use(authenticate);

// O paciente precisa enxergar a grade para escolher um horário no agendamento
// (RF-08), mas quem a define é o nutricionista.
router.get('/', controller.list);
router.post('/', authorize('nutricionista'), controller.create);
router.delete('/:id', authorize('nutricionista'), controller.remove);

export { router as availabilityRoutes };
