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
   * Um e-mail pode existir nas DUAS tabelas: `tenants` é único por e-mail, mas
   * `patients` é único por (tenant_id, email), então nada impede que o e-mail de
   * um nutricionista seja também o de um paciente de outro consultório. Por isso
   * a busca em `tenants` que falha não encerra o login — ela apenas não
   * autentica, e a procura continua em `patients`. Só há um `throw`, no fim,
   * depois de esgotados todos os candidatos dos dois papéis.
   *
   * `origem` (o IP do cliente) participa do bloqueio E-04; ver loginAttempts.
   */
  async login(input: LoginInput, origem?: string): Promise<AuthResult | PatientAuthResult> {
    if (isLocked(input.email, origem)) {
      throw new AccountLockedError();
    }

    const tenant = await this.repository.findByEmail(input.email);
    if (tenant && (await comparePassword(input.senha, tenant.senha_hash))) {
      clearAttempts(input.email, origem);

      return {
        token: signToken({ user_id: tenant.id, tenant_id: tenant.id, role: 'nutricionista' }),
        role: 'nutricionista',
        tenant: { id: tenant.id, nome: tenant.nome, email: tenant.email, crn: tenant.crn },
      };
    }

    // O mesmo e-mail pode pertencer a pacientes de nutricionistas diferentes.
    // Quem desempata é a senha — por isso a comparação percorre os candidatos
    // em vez de exigir e-mail global único.
    const candidatos = await this.patientAuthRepository.findAuthCandidatesByEmail(input.email);
    for (const candidato of candidatos) {
      // Paciente inativado (RF-03) perde o acesso, mas sem revelar o motivo.
      if (candidato.status !== 'ativo') continue;

      if (await comparePassword(input.senha, candidato.senha_hash)) {
        clearAttempts(input.email, origem);

        return {
          token: signToken({ user_id: candidato.id, tenant_id: candidato.tenant_id, role: 'paciente' }),
          role: 'paciente',
          patient: { id: candidato.id, nome: candidato.nome, email: candidato.email },
        };
      }
    }

    registerFailedAttempt(input.email, origem);
    throw new InvalidCredentialsError();
  }

  /**
   * RF-02, primeiro acesso do paciente: o paciente é cadastrado pelo
   * nutricionista (RF-03) e nasce sem senha. O nutricionista gera um token de
   * acesso e o repassa; aqui o paciente troca esse token pela sua senha e já
   * sai autenticado, sem precisar de um segundo login.
   */
  async setPatientPassword(input: SetPatientPasswordInput): Promise<PatientAuthResult> {
    // O hash da senha é calculado ANTES de olhar o token porque a validação do
    // token e a gravação da senha acontecem numa única operação atômica (ver
    // consumeAccessToken): validar aqui e gravar depois abria uma janela em que
    // duas requisições simultâneas com o mesmo token definiam duas senhas
    // diferentes, e a última vencia.
    const senhaHash = await hashPassword(input.senha);
    const patient = await this.patientAuthRepository.consumeAccessToken(
      hashAccessToken(input.token),
      senhaHash,
    );

    if (!patient) {
      throw new InvalidAccessTokenError();
    }

    return {
      token: signToken({ user_id: patient.id, tenant_id: patient.tenant_id, role: 'paciente' }),
      role: 'paciente',
      patient: { id: patient.id, nome: patient.nome, email: patient.email },
    };
  }
}
