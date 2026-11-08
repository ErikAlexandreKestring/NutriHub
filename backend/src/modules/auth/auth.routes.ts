import { Router } from 'express';
import { AuthController } from './auth.controller';

const router = Router();
const controller = new AuthController();

router.post('/register', controller.register);
// Login único para nutricionista e paciente (RFC, fluxo 3.3).
router.post('/login', controller.login);
router.post('/patient/definir-senha', controller.setPatientPassword);
// Conta do nutricionista: confirmação do e-mail do cadastro e "esqueci minha
// senha". Todas públicas — quem chama ainda não tem sessão.
router.post('/confirmar-email', controller.confirmEmail);
router.post('/reenviar-confirmacao', controller.resendConfirmation);
router.post('/esqueci-senha', controller.requestPasswordReset);
router.post('/redefinir-senha', controller.resetPassword);

export { router as authRoutes };
