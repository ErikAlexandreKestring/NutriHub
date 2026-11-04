import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize, ensurePatientScope } from '../../middlewares/authorize';
import { NutricionistaController } from './nutricionista.controller';

// Montada em /api/patients/:patientId/nutricionista (mergeParams para acessar patientId).
const router = Router({ mergeParams: true });
const controller = new NutricionistaController();

router.use(authenticate);

// RF-07: o paciente busca o WhatsApp do próprio nutricionista para o botão de
// conversa. O nutricionista já sabe o próprio número, por isso a rota é só do
// paciente; o `ensurePatientScope` mantém o padrão das rotas aninhadas.
router.get('/', authorize('paciente'), ensurePatientScope, controller.getContato);

export { router as patientNutricionistaRoutes };
