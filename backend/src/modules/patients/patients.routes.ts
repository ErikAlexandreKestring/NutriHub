import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { PatientsController } from './patients.controller';

const router = Router();
const controller = new PatientsController();

router.use(authenticate);

router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.inactivate);

export { router as patientsRoutes };
