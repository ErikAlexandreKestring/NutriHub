import { AuthRepository, StoredToken, TenantRecord } from './auth.repository';
import { PatientAuthRepository } from './patientAuth.repository';
import { AuthEmails } from './auth.emails';
import { hashPassword, comparePassword } from '../../shared/utils/password';
import { signToken } from '../../shared/utils/jwt';
import {
  AccountLockedError,
  EmailAlreadyRegisteredError,
  EmailNotConfirmedError,
  InvalidAccessTokenError,
  InvalidConfirmationLinkError,
  InvalidCredentialsError,
  InvalidPasswordResetLinkError,
} from '../../shared/errors/AppError';
import {
  accessTokenExpiresAt,
  EMAIL_CONFIRMATION_TTL_HOURS,
  generateAccessToken,
  hashAccessToken,
  PASSWORD_RESET_TTL_HOURS,
} from '../../shared/utils/accessToken';
import { isLocked, registerFailedAttempt, clearAttempts } from './loginAttempts';
import {
  RegisterInput,
  LoginInput,
  ResetPasswordInput,
  SetPatientPasswordInput,
} from './auth.validation';

/**
 * Pedir de novo o mesmo link antes disso não gera outro e-mail: segura cliques
 * repetidos e quem tente usar o formulário para lotar a caixa de alguém.
 */
export const INTERVALO_ENTRE_ENVIOS_MS = 60 * 1000;

const HORA_MS = 60 * 60 * 1000;

/** O cadastro não entra direto: espera a confirmação do e-mail. */
export interface RegisterResult {
  email: string;
  confirmacao_pendente: true;
}

/** Um token novo: o valor vai no link do e-mail, o hash fica no banco. */
function novoToken(ttlHoras: number): { valor: string; armazenado: StoredToken } {
  const valor = generateAccessToken();
  return { valor, armazenado: { hash: hashAccessToken(valor), expiraEm: accessTokenExpiresAt(new Date(), ttlHoras) } };
}

/** O último link foi emitido há menos de INTERVALO_ENTRE_ENVIOS_MS? A emissão é a validade menos o TTL. */
function enviadoHaPouco(expiraEm: Date | null, ttlHoras: number): boolean {
  if (!expiraEm) return false;
  const emitidoEm = new Date(expiraEm).getTime() - ttlHoras * HORA_MS;
  return Date.now() - emitidoEm < INTERVALO_ENTRE_ENVIOS_MS;
}

function resultadoDoNutricionista(tenant: TenantRecord): AuthResult {
  return {
    token: signToken({ user_id: tenant.id, tenant_id: tenant.id, role: 'nutricionista' }),
    role: 'nutricionista',
    tenant: { id: tenant.id, nome: tenant.nome, email: tenant.email, crn: tenant.crn },
  };
}

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
    private readonly emails: AuthEmails = new AuthEmails(),
  ) {}

  // RF-01 + RN-06: cadastro do nutricionista provisiona o tenant automaticamente,
  // sem processo manual de criação por administrador. A conta nasce sem o
  // e-mail confirmado e só entra depois de abrir o link enviado para ele.
  async register(input: RegisterInput): Promise<RegisterResult> {
    const existing = await this.repository.findByEmail(input.email);
    if (existing) {
      throw new EmailAlreadyRegisteredError();
    }

    const senhaHash = await hashPassword(input.senha);
    const confirmacao = novoToken(EMAIL_CONFIRMATION_TTL_HOURS);
    const tenant = await this.repository.create({
      nome: input.nome,
      email: input.email,
      crn: input.crn,
      telefone: input.telefone,
      senhaHash,
      confirmacao: confirmacao.armazenado,
    });

    // A conta já existe: se o e-mail falhar, a tela de "confirme seu e-mail"
    // oferece reenviar, então o cadastro não volta como erro.
    await this.enviarSemFalhar('confirmação de e-mail', () =>
      this.emails.confirmacaoDeEmail(tenant, confirmacao.valor),
    );

    return { email: tenant.email, confirmacao_pendente: true };
  }

  /** Confirma o e-mail pelo link e já entra, como no primeiro acesso do paciente. */
  async confirmEmail(token: string): Promise<AuthResult> {
    const tenant = await this.repository.confirmEmail(hashAccessToken(token));
    if (!tenant) {
      throw new InvalidConfirmationLinkError();
    }
    return resultadoDoNutricionista(tenant);
  }

  /**
   * Manda um novo link de confirmação. Não diz se o e-mail existe nem se já
   * estava confirmado: a resposta é a mesma para todos, para o formulário não
   * servir de consulta de quais e-mails têm conta.
   */
  async resendConfirmation(email: string): Promise<void> {
    const tenant = await this.repository.findByEmail(email);
    if (!tenant || tenant.email_confirmado_em) return;
    if (enviadoHaPouco(tenant.confirmacao_token_expira_em, EMAIL_CONFIRMATION_TTL_HOURS)) return;

    const confirmacao = novoToken(EMAIL_CONFIRMATION_TTL_HOURS);
    await this.repository.saveConfirmationToken(tenant.id, confirmacao.armazenado);
    await this.enviarSemFalhar('confirmação de e-mail', () =>
      this.emails.confirmacaoDeEmail(tenant, confirmacao.valor),
    );
  }

  /**
   * "Esqueci minha senha" do nutricionista. Mesma resposta para qualquer
   * e-mail, pelo mesmo motivo do reenvio. O paciente não passa por aqui: quem
   * gera o acesso dele é o nutricionista (link de primeiro acesso).
   */
  async requestPasswordReset(email: string): Promise<void> {
    const tenant = await this.repository.findByEmail(email);
    if (!tenant) return;
    if (enviadoHaPouco(tenant.senha_token_expira_em, PASSWORD_RESET_TTL_HOURS)) return;

    const redefinicao = novoToken(PASSWORD_RESET_TTL_HOURS);
    await this.repository.savePasswordResetToken(tenant.id, redefinicao.armazenado);
    await this.enviarSemFalhar('redefinição de senha', () =>
      this.emails.redefinicaoDeSenha(tenant, redefinicao.valor),
    );
  }

  /**
   * Grava a senha nova pelo link do e-mail e já entra. O bloqueio de tentativas
   * (E-04) desse e-mail é zerado: quem trocou a senha não deve continuar
   * trancado pelas tentativas erradas de antes.
   */
  async resetPassword(input: ResetPasswordInput, origem?: string): Promise<AuthResult> {
    const senhaHash = await hashPassword(input.senha);
    const tenant = await this.repository.resetPassword(hashAccessToken(input.token), senhaHash);
    if (!tenant) {
      throw new InvalidPasswordResetLinkError();
    }

    clearAttempts(tenant.email, origem);
    return resultadoDoNutricionista(tenant);
  }

  private async enviarSemFalhar(oQue: string, enviar: () => Promise<void>): Promise<void> {
    try {
      await enviar();
    } catch (erro) {
      // eslint-disable-next-line no-console
      console.error(`Falha ao enviar o e-mail de ${oQue}`, erro);
    }
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

      // Senha certa, e-mail ainda não confirmado: diz isso em vez de "senha
      // inválida". Só chega aqui quem sabe a senha, então não expõe a conta.
      if (!tenant.email_confirmado_em) {
        throw new EmailNotConfirmedError(tenant.email);
      }

      return resultadoDoNutricionista(tenant);
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
