import { Router } from 'express';
import { AuthController } from './auth.controller';

const router = Router();
const controller = new AuthController();

router.post('/register', controller.register);
// Login único para nutricionista e paciente (RFC, fluxo 3.3).
router.post('/login', controller.login);
router.post('/patient/definir-senha', controller.setPatientPassword);

export { router as authRoutes };
