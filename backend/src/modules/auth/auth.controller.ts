import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import {
  emailSchema,
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  setPatientPasswordSchema,
  tokenSchema,
  LoginInput,
} from './auth.validation';
import { AuditService } from '../audit/audit.service';
import { AccountLockedError, EmailNotConfirmedError, InvalidCredentialsError } from '../../shared/errors/AppError';

// Reenvio da confirmação e "esqueci minha senha" respondem igual para qualquer
// e-mail: dizer "não há conta com esse e-mail" revelaria quem tem conta.
const RESPOSTA_DE_ENVIO = {
  mensagem: 'Se houver uma conta de nutricionista com esse e-mail, enviamos o link para ele.',
};
import { verifyToken } from '../../shared/utils/jwt';

// Login e primeiro acesso são rotas públicas: o autor do log só existe depois
// de autenticar. O token recém-emitido é a única fonte do tenant do paciente
// (o corpo da resposta não o expõe).
function autorDoToken(token: string) {
  const payload = verifyToken(token);
  return { userId: payload.user_id, tenantId: payload.tenant_id };
}

export class AuthController {
  constructor(
    private readonly service: AuthService = new AuthService(),
    private readonly audit: AuditService = new AuditService(),
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = registerSchema.parse(req.body);
      const result = await this.service.register(input);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let input: LoginInput | undefined;
    try {
      input = loginSchema.parse(req.body);
      // O IP entra no bloqueio E-04 para que errar a senha de um e-mail alheio
      // não tranque a conta do dono (ver loginAttempts).
      const result = await this.service.login(input, req.ip);
      await this.audit.record(req, 'LOGIN_SUCESSO', { papel: result.role }, autorDoToken(result.token));
      res.status(200).json(result);
    } catch (error) {
      // RNF-10: tentativas inválidas também são auditadas — sem autor, já que
      // ninguém se autenticou; o e-mail tentado é o que identifica o alvo.
      if (
        input &&
        (error instanceof InvalidCredentialsError ||
          error instanceof AccountLockedError ||
          error instanceof EmailNotConfirmedError)
      ) {
        await this.audit.record(req, 'LOGIN_FALHOU', {
          email: input.email,
          motivo:
            error instanceof AccountLockedError
              ? 'bloqueado'
              : error instanceof EmailNotConfirmedError
                ? 'email_nao_confirmado'
                : 'credenciais_invalidas',
        });
      }
      next(error);
    }
  };

  // RF-02: primeiro acesso do paciente (define a senha e já devolve o JWT).
  setPatientPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = setPatientPasswordSchema.parse(req.body);
      const result = await this.service.setPatientPassword(input);
      await this.audit.record(req, 'PRIMEIRO_ACESSO', { papel: result.role }, autorDoToken(result.token));
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // Link do e-mail de confirmação: confirma e já devolve a sessão.
  confirmEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = tokenSchema.parse(req.body);
      const result = await this.service.confirmEmail(token);
      await this.audit.record(req, 'EMAIL_CONFIRMADO', { papel: result.role }, autorDoToken(result.token));
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  resendConfirmation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = emailSchema.parse(req.body);
      await this.service.resendConfirmation(email);
      res.status(202).json(RESPOSTA_DE_ENVIO);
    } catch (error) {
      next(error);
    }
  };

  requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = emailSchema.parse(req.body);
      await this.service.requestPasswordReset(email);
      res.status(202).json(RESPOSTA_DE_ENVIO);
    } catch (error) {
      next(error);
    }
  };

  // Link do e-mail de redefinição: grava a senha nova e já devolve a sessão.
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = resetPasswordSchema.parse(req.body);
      const result = await this.service.resetPassword(input, req.ip);
      await this.audit.record(req, 'SENHA_REDEFINIDA', { papel: result.role }, autorDoToken(result.token));
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
