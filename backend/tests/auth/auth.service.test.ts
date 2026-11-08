import { AuthService, INTERVALO_ENTRE_ENVIOS_MS } from '../../src/modules/auth/auth.service';
import { AuthEmails } from '../../src/modules/auth/auth.emails';
import { AuthRepository, TenantRecord } from '../../src/modules/auth/auth.repository';
import {
  PatientAuthRepository,
  PatientAuthRecord,
  PatientAccessTokenRecord,
} from '../../src/modules/auth/patientAuth.repository';
import { hashPassword } from '../../src/shared/utils/password';
import { verifyToken } from '../../src/shared/utils/jwt';
import {
  AccountLockedError,
  EmailAlreadyRegisteredError,
  EmailNotConfirmedError,
  InvalidAccessTokenError,
  InvalidConfirmationLinkError,
  InvalidCredentialsError,
  InvalidPasswordResetLinkError,
} from '../../src/shared/errors/AppError';
import {
  EMAIL_CONFIRMATION_TTL_HOURS,
  generateAccessToken,
  hashAccessToken,
  PASSWORD_RESET_TTL_HOURS,
} from '../../src/shared/utils/accessToken';
import { __resetAllAttempts, isLocked, registerFailedAttempt } from '../../src/modules/auth/loginAttempts';

const HORA_MS = 60 * 60 * 1000;

function buildTenant(overrides: Partial<TenantRecord> = {}): TenantRecord {
  return {
    id: 'tenant-1',
    nome: 'Eridiane Kestring',
    email: 'eridiane@nutrihub.com',
    crn: 'CRN-12345',
    telefone: null,
    senha_hash: '',
    cancelamento_antecedencia_horas: 24,
    email_confirmado_em: new Date(),
    confirmacao_token_hash: null,
    confirmacao_token_expira_em: null,
    senha_token_hash: null,
    senha_token_expira_em: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildPatientAuth(overrides: Partial<PatientAuthRecord> = {}): PatientAuthRecord {
  return {
    id: 'patient-1',
    tenant_id: 'tenant-1',
    nome: 'Paciente Teste',
    email: 'paciente@nutrihub.com',
    senha_hash: '',
    status: 'ativo',
    ...overrides,
  };
}

function buildAccessTokenRecord(overrides: Partial<PatientAccessTokenRecord> = {}): PatientAccessTokenRecord {
  return {
    id: 'patient-1',
    tenant_id: 'tenant-1',
    nome: 'Paciente Teste',
    email: 'paciente@nutrihub.com',
    ...overrides,
  };
}

describe('AuthService', () => {
  let repository: jest.Mocked<AuthRepository>;
  let patientAuthRepository: jest.Mocked<PatientAuthRepository>;
  let emails: jest.Mocked<AuthEmails>;
  let service: AuthService;

  beforeEach(() => {
    __resetAllAttempts();
    repository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      saveConfirmationToken: jest.fn(),
      confirmEmail: jest.fn(),
      savePasswordResetToken: jest.fn(),
      resetPassword: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;
    emails = {
      confirmacaoDeEmail: jest.fn(),
      redefinicaoDeSenha: jest.fn(),
    } as unknown as jest.Mocked<AuthEmails>;
    patientAuthRepository = {
      findAuthCandidatesByEmail: jest.fn().mockResolvedValue([]),
      consumeAccessToken: jest.fn(),
      saveAccessToken: jest.fn(),
    } as unknown as jest.Mocked<PatientAuthRepository>;
    service = new AuthService(repository, patientAuthRepository, emails);
  });

  describe('register (RF-01)', () => {
    const CADASTRO = {
      nome: 'Eridiane Kestring',
      email: 'eridiane@nutrihub.com',
      crn: 'CRN-12345',
      telefone: '(47) 99999-0000',
      senha: 'senhaSegura123',
    };

    it('cria o tenant sem entrar e manda o link de confirmação por e-mail', async () => {
      repository.findByEmail.mockResolvedValue(undefined);
      const tenant = buildTenant({ email_confirmado_em: null });
      repository.create.mockResolvedValue(tenant);

      const result = await service.register(CADASTRO);

      expect(result).toEqual({ email: 'eridiane@nutrihub.com', confirmacao_pendente: true });
      expect(result).not.toHaveProperty('token');

      // O banco recebe só o hash; o e-mail leva o token que gera esse hash.
      const { confirmacao } = repository.create.mock.calls[0][0];
      const [destino, token] = emails.confirmacaoDeEmail.mock.calls[0];
      expect(destino).toBe(tenant);
      expect(hashAccessToken(token)).toBe(confirmacao.hash);
      const validadeEmHoras = (confirmacao.expiraEm.getTime() - Date.now()) / HORA_MS;
      expect(validadeEmHoras).toBeCloseTo(EMAIL_CONFIRMATION_TTL_HOURS, 1);
    });

    it('o cadastro vale mesmo se o envio do e-mail falhar (dá para reenviar)', async () => {
      repository.findByEmail.mockResolvedValue(undefined);
      repository.create.mockResolvedValue(buildTenant({ email_confirmado_em: null }));
      emails.confirmacaoDeEmail.mockRejectedValue(new Error('SMTP fora do ar'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(service.register(CADASTRO)).resolves.toMatchObject({ confirmacao_pendente: true });
    });

    it('rejeita cadastro com e-mail já existente', async () => {
      repository.findByEmail.mockResolvedValue(buildTenant());

      await expect(
        service.register({
          nome: 'Eridiane Kestring',
          email: 'eridiane@nutrihub.com',
          crn: 'CRN-12345',
          telefone: '(47) 99999-0000',
          senha: 'senhaSegura123',
        }),
      ).rejects.toThrow(EmailAlreadyRegisteredError);

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmação do e-mail', () => {
    it('confirma pelo hash do token do link e já entra', async () => {
      const token = generateAccessToken();
      repository.confirmEmail.mockResolvedValue(buildTenant());

      const result = await service.confirmEmail(token);

      expect(repository.confirmEmail).toHaveBeenCalledWith(hashAccessToken(token));
      expect(verifyToken(result.token)).toMatchObject({ role: 'nutricionista', tenant_id: 'tenant-1' });
    });

    it('recusa link inválido, vencido ou já usado (E-26)', async () => {
      repository.confirmEmail.mockResolvedValue(undefined);

      await expect(service.confirmEmail(generateAccessToken())).rejects.toThrow(InvalidConfirmationLinkError);
    });

    it('com a senha certa e o e-mail sem confirmar, o login avisa em vez de dizer senha inválida (E-25)', async () => {
      const senhaHash = await hashPassword('senhaSegura123');
      repository.findByEmail.mockResolvedValue(buildTenant({ senha_hash: senhaHash, email_confirmado_em: null }));

      await expect(
        service.login({ email: 'eridiane@nutrihub.com', senha: 'senhaSegura123' }),
      ).rejects.toThrow(EmailNotConfirmedError);
    });

    it('com a senha errada, a conta sem confirmar continua dando "e-mail ou senha inválidos"', async () => {
      const senhaHash = await hashPassword('senhaSegura123');
      repository.findByEmail.mockResolvedValue(buildTenant({ senha_hash: senhaHash, email_confirmado_em: null }));

      await expect(
        service.login({ email: 'eridiane@nutrihub.com', senha: 'senhaErrada1' }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('reenvia um link novo para a conta ainda não confirmada', async () => {
      const tenant = buildTenant({
        email_confirmado_em: null,
        confirmacao_token_expira_em: new Date(Date.now() + EMAIL_CONFIRMATION_TTL_HOURS * HORA_MS - 5 * 60 * 1000),
      });
      repository.findByEmail.mockResolvedValue(tenant);

      await service.resendConfirmation('eridiane@nutrihub.com');

      const [id, novo] = repository.saveConfirmationToken.mock.calls[0];
      expect(id).toBe('tenant-1');
      expect(hashAccessToken(emails.confirmacaoDeEmail.mock.calls[0][1])).toBe(novo.hash);
    });

    it.each([
      ['e-mail sem conta', undefined],
      ['conta já confirmada', buildTenant()],
    ])('não reenvia nada para %s, sem dizer isso a quem pediu', async (_caso, tenant) => {
      repository.findByEmail.mockResolvedValue(tenant);

      await expect(service.resendConfirmation('eridiane@nutrihub.com')).resolves.toBeUndefined();
      expect(repository.saveConfirmationToken).not.toHaveBeenCalled();
      expect(emails.confirmacaoDeEmail).not.toHaveBeenCalled();
    });

    it(`não manda outro e-mail se o último saiu há menos de ${INTERVALO_ENTRE_ENVIOS_MS / 1000}s`, async () => {
      repository.findByEmail.mockResolvedValue(
        buildTenant({
          email_confirmado_em: null,
          confirmacao_token_expira_em: new Date(Date.now() + EMAIL_CONFIRMATION_TTL_HOURS * HORA_MS - 10 * 1000),
        }),
      );

      await service.resendConfirmation('eridiane@nutrihub.com');

      expect(emails.confirmacaoDeEmail).not.toHaveBeenCalled();
    });
  });

  describe('esqueci minha senha', () => {
    it('manda o link de redefinição, válido por 1 hora', async () => {
      const tenant = buildTenant();
      repository.findByEmail.mockResolvedValue(tenant);

      await service.requestPasswordReset('eridiane@nutrihub.com');

      const [id, token] = repository.savePasswordResetToken.mock.calls[0];
      expect(id).toBe('tenant-1');
      expect(hashAccessToken(emails.redefinicaoDeSenha.mock.calls[0][1])).toBe(token.hash);
      expect((token.expiraEm.getTime() - Date.now()) / HORA_MS).toBeCloseTo(PASSWORD_RESET_TTL_HOURS, 1);
    });

    it('para e-mail sem conta de nutricionista, responde igual e não envia nada', async () => {
      repository.findByEmail.mockResolvedValue(undefined);

      await expect(service.requestPasswordReset('ninguem@nutrihub.com')).resolves.toBeUndefined();
      expect(emails.redefinicaoDeSenha).not.toHaveBeenCalled();
    });

    it('não manda outro e-mail se o último saiu há pouco', async () => {
      repository.findByEmail.mockResolvedValue(
        buildTenant({ senha_token_expira_em: new Date(Date.now() + PASSWORD_RESET_TTL_HOURS * HORA_MS - 5 * 1000) }),
      );

      await service.requestPasswordReset('eridiane@nutrihub.com');

      expect(emails.redefinicaoDeSenha).not.toHaveBeenCalled();
    });

    it('grava a senha nova pelo link, já entra e destrava o bloqueio de tentativas', async () => {
      const token = generateAccessToken();
      repository.resetPassword.mockResolvedValue(buildTenant());
      for (let i = 0; i < 5; i += 1) registerFailedAttempt('eridiane@nutrihub.com', '10.0.0.1');
      expect(isLocked('eridiane@nutrihub.com', '10.0.0.1')).toBe(true);

      const result = await service.resetPassword({ token, senha: 'novaSenha123' }, '10.0.0.1');

      const [hash, senhaHash] = repository.resetPassword.mock.calls[0];
      expect(hash).toBe(hashAccessToken(token));
      expect(senhaHash).not.toBe('novaSenha123');
      expect(verifyToken(result.token)).toMatchObject({ role: 'nutricionista' });
      expect(isLocked('eridiane@nutrihub.com', '10.0.0.1')).toBe(false);
    });

    it('recusa link inválido, vencido ou já usado (E-27)', async () => {
      repository.resetPassword.mockResolvedValue(undefined);

      await expect(
        service.resetPassword({ token: generateAccessToken(), senha: 'novaSenha123' }),
      ).rejects.toThrow(InvalidPasswordResetLinkError);
    });
  });

  describe('login (RF-02 / E-04)', () => {
    it('autentica com sucesso quando as credenciais são válidas', async () => {
      const senhaHash = await hashPassword('senhaSegura123');
      repository.findByEmail.mockResolvedValue(buildTenant({ senha_hash: senhaHash }));

      const result = await service.login({ email: 'eridiane@nutrihub.com', senha: 'senhaSegura123' });

      expect(result.token).toEqual(expect.any(String));
      const payload = verifyToken(result.token);
      expect(payload.role).toBe('nutricionista');
    });

    it('rejeita login com senha incorreta', async () => {
      const senhaHash = await hashPassword('senhaSegura123');
      repository.findByEmail.mockResolvedValue(buildTenant({ senha_hash: senhaHash }));

      await expect(
        service.login({ email: 'eridiane@nutrihub.com', senha: 'senhaErrada' }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('rejeita login para e-mail inexistente sem revelar qual campo está errado', async () => {
      repository.findByEmail.mockResolvedValue(undefined);

      await expect(
        service.login({ email: 'naoexiste@nutrihub.com', senha: 'qualquer123' }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('bloqueia o e-mail após 5 tentativas inválidas consecutivas (E-04)', async () => {
      const senhaHash = await hashPassword('senhaSegura123');
      repository.findByEmail.mockResolvedValue(buildTenant({ senha_hash: senhaHash }));

      for (let i = 0; i < 5; i += 1) {
        await expect(
          service.login({ email: 'eridiane@nutrihub.com', senha: 'senhaErrada' }),
        ).rejects.toThrow(InvalidCredentialsError);
      }

      await expect(
        service.login({ email: 'eridiane@nutrihub.com', senha: 'senhaSegura123' }),
      ).rejects.toThrow(AccountLockedError);
    });

    it('não deixa uma origem trancar a conta de outra (E-04 por e-mail + origem)', async () => {
      // O bloqueio chaveado só pelo e-mail virava negação de serviço: bastava
      // conhecer o e-mail alheio e errar a senha 5 vezes.
      const senhaHash = await hashPassword('senhaSegura123');
      repository.findByEmail.mockResolvedValue(buildTenant({ senha_hash: senhaHash }));

      for (let i = 0; i < 5; i += 1) {
        await expect(
          service.login({ email: 'eridiane@nutrihub.com', senha: 'senhaErrada' }, '203.0.113.9'),
        ).rejects.toThrow(InvalidCredentialsError);
      }

      // O atacante trancou a si mesmo...
      await expect(
        service.login({ email: 'eridiane@nutrihub.com', senha: 'senhaSegura123' }, '203.0.113.9'),
      ).rejects.toThrow(AccountLockedError);

      // ...mas a dona da conta continua entrando normalmente.
      await expect(
        service.login({ email: 'eridiane@nutrihub.com', senha: 'senhaSegura123' }, '198.51.100.4'),
      ).resolves.toBeDefined();
    });

    it('limpa o contador de tentativas após um login bem-sucedido', async () => {
      const senhaHash = await hashPassword('senhaSegura123');
      repository.findByEmail.mockResolvedValue(buildTenant({ senha_hash: senhaHash }));

      await expect(
        service.login({ email: 'eridiane@nutrihub.com', senha: 'senhaErrada' }),
      ).rejects.toThrow(InvalidCredentialsError);

      await expect(
        service.login({ email: 'eridiane@nutrihub.com', senha: 'senhaSegura123' }),
      ).resolves.toBeDefined();
    });
  });

  describe('login do paciente (RF-02)', () => {
    beforeEach(() => {
      // Nenhum nutricionista com esse e-mail: a busca cai em `patients`.
      repository.findByEmail.mockResolvedValue(undefined);
    });

    it('emite um JWT de paciente com o tenant_id do seu nutricionista', async () => {
      const senhaHash = await hashPassword('senhaDoPaciente1');
      patientAuthRepository.findAuthCandidatesByEmail.mockResolvedValue([
        buildPatientAuth({ senha_hash: senhaHash }),
      ]);

      const result = await service.login({ email: 'paciente@nutrihub.com', senha: 'senhaDoPaciente1' });

      const payload = verifyToken(result.token);
      expect(payload.role).toBe('paciente');
      // O user_id do paciente é o próprio patients.id — é o que amarra as rotas
      // de escopo (ensurePatientScope) e a checagem de dono das consultas.
      expect(payload.user_id).toBe('patient-1');
      expect(payload.tenant_id).toBe('tenant-1');
    });

    it('rejeita paciente sem senha definida (nunca fez o primeiro acesso)', async () => {
      // A função SQL já filtra senha_hash IS NULL, então não vem candidato algum.
      patientAuthRepository.findAuthCandidatesByEmail.mockResolvedValue([]);

      await expect(
        service.login({ email: 'paciente@nutrihub.com', senha: 'senhaDoPaciente1' }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('rejeita paciente inativado mesmo com a senha correta (RF-03)', async () => {
      const senhaHash = await hashPassword('senhaDoPaciente1');
      patientAuthRepository.findAuthCandidatesByEmail.mockResolvedValue([
        buildPatientAuth({ senha_hash: senhaHash, status: 'inativo' }),
      ]);

      await expect(
        service.login({ email: 'paciente@nutrihub.com', senha: 'senhaDoPaciente1' }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('desempata pelo bcrypt quando o mesmo e-mail existe em tenants diferentes', async () => {
      // `patients` é único por (tenant_id, email): o mesmo paciente pode ser
      // atendido por dois nutricionistas, com senhas distintas.
      patientAuthRepository.findAuthCandidatesByEmail.mockResolvedValue([
        buildPatientAuth({ id: 'patient-a', tenant_id: 'tenant-a', senha_hash: await hashPassword('senhaNoTenantA') }),
        buildPatientAuth({ id: 'patient-b', tenant_id: 'tenant-b', senha_hash: await hashPassword('senhaNoTenantB') }),
      ]);

      const result = await service.login({ email: 'paciente@nutrihub.com', senha: 'senhaNoTenantB' });

      const payload = verifyToken(result.token);
      expect(payload.user_id).toBe('patient-b');
      expect(payload.tenant_id).toBe('tenant-b');
    });

    it('autentica o paciente mesmo quando o e-mail também é de um nutricionista', async () => {
      // `tenants` é único por e-mail e `patients` por (tenant_id, email): nada
      // impede a colisão. Antes, o ramo do nutricionista lançava na senha errada
      // e o paciente nunca era consultado — o dono do e-mail ficava sem login.
      repository.findByEmail.mockResolvedValue(
        buildTenant({ email: 'paciente@nutrihub.com', senha_hash: await hashPassword('senhaDoNutri123') }),
      );
      patientAuthRepository.findAuthCandidatesByEmail.mockResolvedValue([
        buildPatientAuth({ senha_hash: await hashPassword('senhaDoPaciente1') }),
      ]);

      const result = await service.login({ email: 'paciente@nutrihub.com', senha: 'senhaDoPaciente1' });

      expect(result.role).toBe('paciente');
      expect(verifyToken(result.token).user_id).toBe('patient-1');
    });

    it('ainda autentica o nutricionista quando o e-mail colide, com a senha dele', async () => {
      repository.findByEmail.mockResolvedValue(
        buildTenant({ email: 'paciente@nutrihub.com', senha_hash: await hashPassword('senhaDoNutri123') }),
      );
      patientAuthRepository.findAuthCandidatesByEmail.mockResolvedValue([
        buildPatientAuth({ senha_hash: await hashPassword('senhaDoPaciente1') }),
      ]);

      const result = await service.login({ email: 'paciente@nutrihub.com', senha: 'senhaDoNutri123' });

      expect(result.role).toBe('nutricionista');
      // Senha do nutricionista confere: nem chega a procurar entre os pacientes.
      expect(patientAuthRepository.findAuthCandidatesByEmail).not.toHaveBeenCalled();
    });

    it('aplica o bloqueio de 5 tentativas também ao paciente (E-04)', async () => {
      const senhaHash = await hashPassword('senhaDoPaciente1');
      patientAuthRepository.findAuthCandidatesByEmail.mockResolvedValue([
        buildPatientAuth({ senha_hash: senhaHash }),
      ]);

      for (let i = 0; i < 5; i += 1) {
        await expect(
          service.login({ email: 'paciente@nutrihub.com', senha: 'senhaErrada' }),
        ).rejects.toThrow(InvalidCredentialsError);
      }

      await expect(
        service.login({ email: 'paciente@nutrihub.com', senha: 'senhaDoPaciente1' }),
      ).rejects.toThrow(AccountLockedError);
    });
  });

  describe('setPatientPassword — primeiro acesso (RF-02)', () => {
    it('define a senha, consome o token e já devolve um JWT de paciente', async () => {
      const token = generateAccessToken();
      patientAuthRepository.consumeAccessToken.mockResolvedValue(buildAccessTokenRecord());

      const result = await service.setPatientPassword({ token, senha: 'senhaDoPaciente1' });

      // A busca é feita pelo HASH: o token em claro nunca vai ao banco. E a
      // senha vai já hasheada, na MESMA chamada que valida o token.
      const [tokenHashEnviado, senhaHashGravado] =
        patientAuthRepository.consumeAccessToken.mock.calls[0];
      expect(tokenHashEnviado).toBe(hashAccessToken(token));
      expect(senhaHashGravado).not.toBe('senhaDoPaciente1');

      expect(verifyToken(result.token).role).toBe('paciente');
    });

    // Token inexistente, expirado, já consumido ou de paciente inativo são o
    // mesmo caso para o serviço: o UPDATE condicional não alcançou linha alguma.
    it('rejeita token que o banco não conseguiu consumir (inexistente, expirado ou já usado)', async () => {
      patientAuthRepository.consumeAccessToken.mockResolvedValue(undefined);

      await expect(
        service.setPatientPassword({ token: generateAccessToken(), senha: 'senhaDoPaciente1' }),
      ).rejects.toThrow(InvalidAccessTokenError);
    });

    it('só um de dois primeiros acessos concorrentes com o mesmo token vence', async () => {
      const token = generateAccessToken();
      // O UPDATE condicional é atômico: o segundo request não encontra mais a
      // linha (o token já foi apagado) e cai no erro, em vez de sobrescrever a
      // senha que o primeiro acabou de gravar. Qual dos dois chega primeiro ao
      // repositório depende de qual bcrypt termina antes, então o teste não
      // fixa o vencedor — só exige que haja exatamente um.
      patientAuthRepository.consumeAccessToken
        .mockResolvedValueOnce(buildAccessTokenRecord())
        .mockResolvedValueOnce(undefined);

      const resultados = await Promise.allSettled([
        service.setPatientPassword({ token, senha: 'senhaDoPaciente1' }),
        service.setPatientPassword({ token, senha: 'senhaDoAtacante9' }),
      ]);

      const vencedores = resultados.filter((r) => r.status === 'fulfilled');
      const perdedores = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(vencedores).toHaveLength(1);
      expect(perdedores).toHaveLength(1);
      expect(perdedores[0].reason).toBeInstanceOf(InvalidAccessTokenError);
    });
  });
});
