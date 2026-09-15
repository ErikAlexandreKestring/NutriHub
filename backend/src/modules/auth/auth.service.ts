import { AuthRepository } from './auth.repository';
import { PatientAuthRepository } from './patientAuth.repository';
import { hashPassword, comparePassword } from '../../shared/utils/password';
import { signToken } from '../../shared/utils/jwt';
import {
  AccountLockedError,
  EmailAlreadyRegisteredError,
  InvalidAccessTokenError,
  InvalidCredentialsError,
} from '../../shared/errors/AppError';
import { hashAccessToken } from '../../shared/utils/accessToken';
import { isLocked, registerFailedAttempt, clearAttempts } from './loginAttempts';
import { RegisterInput, LoginInput, SetPatientPasswordInput } from './auth.validation';

export interface AuthResult {
  token: string;
  role: 'nutricionista';
  tenant: {
    id: string;
    nome: string;
    email: string;
    crn: string;
  };
}

export interface PatientAuthResult {
  token: string;
  role: 'paciente';
  patient: {
    id: string;
    nome: string;
    email: string;
  };
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository = new AuthRepository(),
    private readonly patientAuthRepository: PatientAuthRepository = new PatientAuthRepository(),
  ) {}

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
      role: 'nutricionista',
      tenant: { id: tenant.id, nome: tenant.nome, email: tenant.email, crn: tenant.crn },
    };
  }

  /**
   * RF-02 + E-04: login único para os dois papéis, como descreve o fluxo 3.3 da
   * RFC ("busca o usuário pelo e-mail"). Procura primeiro em `tenants`
   * (nutricionista, JWT de 8h) e depois em `patients` (paciente, JWT de 24h).
   *
   * O bloqueio após 5 tentativas (E-04) é por e-mail e vale para os dois papéis.
   */
  async login(input: LoginInput): Promise<AuthResult | PatientAuthResult> {
    if (isLocked(input.email)) {
      throw new AccountLockedError();
    }

    const tenant = await this.repository.findByEmail(input.email);
    if (tenant) {
      if (!(await comparePassword(input.senha, tenant.senha_hash))) {
        registerFailedAttempt(input.email);
        throw new InvalidCredentialsError();
      }

      clearAttempts(input.email);

      return {
        token: signToken({ user_id: tenant.id, tenant_id: tenant.id, role: 'nutricionista' }),
        role: 'nutricionista',
        tenant: { id: tenant.id, nome: tenant.nome, email: tenant.email, crn: tenant.crn },
      };
    }

    // `patients` é único por (tenant_id, email): o mesmo e-mail pode pertencer a
    // pacientes de nutricionistas diferentes. Quem desempata é a senha — por isso
    // a comparação percorre os candidatos em vez de exigir e-mail global único.
    const candidatos = await this.patientAuthRepository.findAuthCandidatesByEmail(input.email);
    for (const candidato of candidatos) {
      // Paciente inativado (RF-03) perde o acesso, mas sem revelar o motivo.
      if (candidato.status !== 'ativo') continue;

      if (await comparePassword(input.senha, candidato.senha_hash)) {
        clearAttempts(input.email);

        return {
          token: signToken({ user_id: candidato.id, tenant_id: candidato.tenant_id, role: 'paciente' }),
          role: 'paciente',
          patient: { id: candidato.id, nome: candidato.nome, email: candidato.email },
        };
      }
    }

    registerFailedAttempt(input.email);
    throw new InvalidCredentialsError();
  }

  /**
   * RF-02, primeiro acesso do paciente: o paciente é cadastrado pelo
   * nutricionista (RF-03) e nasce sem senha. O nutricionista gera um token de
   * acesso e o repassa; aqui o paciente troca esse token pela sua senha e já
   * sai autenticado, sem precisar de um segundo login.
   */
  async setPatientPassword(input: SetPatientPasswordInput): Promise<PatientAuthResult> {
    const patient = await this.patientAuthRepository.findByAccessTokenHash(hashAccessToken(input.token));

    if (!patient?.acesso_token_expira_em || patient.acesso_token_expira_em.getTime() <= Date.now()) {
      throw new InvalidAccessTokenError();
    }

    const senhaHash = await hashPassword(input.senha);
    await this.patientAuthRepository.setPassword(patient.tenant_id, patient.id, senhaHash);

    return {
      token: signToken({ user_id: patient.id, tenant_id: patient.tenant_id, role: 'paciente' }),
      role: 'paciente',
      patient: { id: patient.id, nome: patient.nome, email: patient.email },
    };
  }
}
