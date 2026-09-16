import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { PatientsController } from './patients.controller';

const router = Router();
const controller = new PatientsController();

router.use(authenticate);

// RF-03 é do nutricionista: sem este guard, o paciente — que carrega o mesmo
// tenant_id no JWT — listaria todos os pacientes do consultório.
//
// O guard vai rota a rota, e NÃO como router.use(): este router é montado em
// /api/patients, e um use() sem path casaria também com as sub-rotas de outros
// módulos montadas sob o mesmo prefixo (/api/patients/:patientId/appointments,
// .../meal-plans) — barrando o paciente até na própria agenda.
const onlyNutricionista = authorize('nutricionista');

router.post('/', onlyNutricionista, controller.create);
router.get('/', onlyNutricionista, controller.list);
router.get('/:id', onlyNutricionista, controller.getById);
router.put('/:id', onlyNutricionista, controller.update);
router.post('/:id/access-token', onlyNutricionista, controller.generateAccessToken);
router.delete('/:id', onlyNutricionista, controller.inactivate);

export { router as patientsRoutes };
