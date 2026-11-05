import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize, ensurePatientScope } from '../../middlewares/authorize';
import { NpsController } from './nps.controller';

// Montada em /api/patients/:patientId/nps (mergeParams para acessar patientId).
const router = Router({ mergeParams: true });
const controller = new NpsController();

// UC-07: a pesquisa é do paciente. O nutricionista não responde por ele nem
// abre a pesquisa individual — vê o consolidado em /api/nps.
router.use(authenticate);
router.use(authorize('paciente'));
router.use(ensurePatientScope);

router.get('/pendente', controller.pendente);
router.post('/:id/resposta', controller.responder);

export { router as patientNpsRoutes };
