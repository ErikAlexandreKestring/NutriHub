import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { FoodsController } from './foods.controller';

const router = Router();
const controller = new FoodsController();

router.use(authenticate);
router.use(authorize('nutricionista'));
router.get('/', controller.list);

export { router as foodsRoutes };
