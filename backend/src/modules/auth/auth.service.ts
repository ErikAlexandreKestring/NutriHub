import { AuthRepository } from './auth.repository';
import { hashPassword, comparePassword } from '../../shared/utils/password';
import { signToken } from '../../shared/utils/jwt';
import {
  AccountLockedError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from '../../shared/errors/AppError';
import { isLocked, registerFailedAttempt, clearAttempts } from './loginAttempts';
import { RegisterInput, LoginInput } from './auth.validation';

export interface AuthResult {
  token: string;
  tenant: {
    id: string;
    nome: string;
    email: string;
    crn: string;
  };
}

export class AuthService {
  constructor(private readonly repository: AuthRepository = new AuthRepository()) {}

  // RF-01 + RN-06: cadastro do nutricionista provisiona o tenant automaticamente,
  // sem processo manual de criação por administrador.
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.repository.findByEmail(input.email);
    if (existing) {
      throw new EmailAlreadyRegisteredError();
    }

    const senhaHash = await hashPassword(input.senha);
    const tenant = await this.repository.create({
      nome: input.nome,
      email: input.email,
      crn: input.crn,
      senhaHash,
    });

    const token = signToken({ user_id: tenant.id, tenant_id: tenant.id, role: 'nutricionista' });

    return {
      token,
      tenant: { id: tenant.id, nome: tenant.nome, email: tenant.email, crn: tenant.crn },
    };
  }

  // RF-02 + E-04: autenticação com bloqueio após 5 tentativas inválidas.
  async login(input: LoginInput): Promise<AuthResult> {
    if (isLocked(input.email)) {
      throw new AccountLockedError();
    }

    const tenant = await this.repository.findByEmail(input.email);
    if (!tenant) {
      registerFailedAttempt(input.email);
      throw new InvalidCredentialsError();
    }

    const senhaValida = await comparePassword(input.senha, tenant.senha_hash);
    if (!senhaValida) {
      registerFailedAttempt(input.email);
      throw new InvalidCredentialsError();
    }

    clearAttempts(input.email);

    const token = signToken({ user_id: tenant.id, tenant_id: tenant.id, role: 'nutricionista' });

    return {
      token,
      tenant: { id: tenant.id, nome: tenant.nome, email: tenant.email, crn: tenant.crn },
    };
  }
}
