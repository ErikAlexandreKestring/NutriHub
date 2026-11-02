import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize, ensurePatientScope } from '../../middlewares/authorize';
import { MealPlansController } from './mealPlans.controller';

// Montada em /api/patients/:patientId/meal-plans (mergeParams para acessar patientId).
const router = Router({ mergeParams: true });
const controller = new MealPlansController();

router.use(authenticate);

// RF-05: única rota de plano alimentar aberta ao paciente. O `authorize` não
// serve aqui porque os dois papéis entram — quem separa é o `ensurePatientScope`,
// que barra o paciente que tentar o :patientId de outra pessoa.
// Declarada antes das rotas de nutricionista para deixar explícito que o escopo
// dela é diferente do resto do arquivo.
router.get('/ativo', ensurePatientScope, controller.getActiveForPatient);

// UC-03: marcar a refeição como feita é ação do próprio paciente — o
// nutricionista acompanha, mas não marca por ele.
router.put('/ativo/meals/:mealId/conclusao', authorize('paciente'), ensurePatientScope, controller.completeMeal);
router.delete('/ativo/meals/:mealId/conclusao', authorize('paciente'), ensurePatientScope, controller.uncompleteMeal);

// O histórico de planos e a criação de rascunho seguem exclusivos do
// nutricionista (RF-04): o paciente vê o plano vigente, não os anteriores.
router.post('/', authorize('nutricionista'), controller.createDraft);
router.get('/', authorize('nutricionista'), controller.listByPatient);

export { router as patientMealPlansRoutes };
