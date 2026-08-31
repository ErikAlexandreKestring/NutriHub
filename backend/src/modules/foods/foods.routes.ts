import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { FoodsController } from './foods.controller';

const router = Router();
const controller = new FoodsController();

router.use(authenticate);
router.get('/', controller.list);

export { router as foodsRoutes };
