import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { AvailabilityController } from './availability.controller';

const router = Router();
const controller = new AvailabilityController();

router.use(authenticate);
router.post('/', controller.create);
router.get('/', controller.list);
router.delete('/:id', controller.remove);

export { router as availabilityRoutes };
