import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema, setPatientPasswordSchema } from './auth.validation';

export class AuthController {
  constructor(private readonly service: AuthService = new AuthService()) {}

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
    try {
      const input = loginSchema.parse(req.body);
      // O IP entra no bloqueio E-04 para que errar a senha de um e-mail alheio
      // não tranque a conta do dono (ver loginAttempts).
      const result = await this.service.login(input, req.ip);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // RF-02: primeiro acesso do paciente (define a senha e já devolve o JWT).
  setPatientPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = setPatientPasswordSchema.parse(req.body);
      const result = await this.service.setPatientPassword(input);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
