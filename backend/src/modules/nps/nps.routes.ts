import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { NpsController } from './nps.controller';

// Montada em /api/nps: o consolidado do consultório (RF-09) — só o nutricionista.
const router = Router();
const controller = new NpsController();

router.use(authenticate);
router.use(authorize('nutricionista'));

router.get('/', controller.resumo);

export { router as npsRoutes };
