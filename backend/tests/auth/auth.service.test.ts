import { AuthService } from '../../src/modules/auth/auth.service';
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
  InvalidAccessTokenError,
  InvalidCredentialsError,
} from '../../src/shared/errors/AppError';
import { generateAccessToken, hashAccessToken } from '../../src/shared/utils/accessToken';
import { __resetAllAttempts } from '../../src/modules/auth/loginAttempts';

function buildTenant(overrides: Partial<TenantRecord> = {}): TenantRecord {
  return {
    id: 'tenant-1',
    nome: 'Eridiane Kestring',
    email: 'eridiane@nutrihub.com',
    crn: 'CRN-12345',
    senha_hash: '',
    cancelamento_antecedencia_horas: 24,
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
  let service: AuthService;

  beforeEach(() => {
    __resetAllAttempts();
    repository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;
    patientAuthRepository = {
      findAuthCandidatesByEmail: jest.fn().mockResolvedValue([]),
      consumeAccessToken: jest.fn(),
      saveAccessToken: jest.fn(),
    } as unknown as jest.Mocked<PatientAuthRepository>;
    service = new AuthService(repository, patientAuthRepository);
  });

  describe('register (RF-01)', () => {
    it('cria o tenant e retorna um token JWT válido quando o e-mail não existe', async () => {
      repository.findByEmail.mockResolvedValue(undefined);
      repository.create.mockResolvedValue(buildTenant());

      const result = await service.register({
        nome: 'Eridiane Kestring',
        email: 'eridiane@nutrihub.com',
        crn: 'CRN-12345',
        senha: 'senhaSegura123',
      });

      expect(result.tenant.email).toBe('eridiane@nutrihub.com');
      expect(result.token).toEqual(expect.any(String));

      const payload = verifyToken(result.token);
      expect(payload.role).toBe('nutricionista');
      expect(payload.tenant_id).toBe('tenant-1');
    });

    it('rejeita cadastro com e-mail já existente', async () => {
      repository.findByEmail.mockResolvedValue(buildTenant());

      await expect(
        service.register({
          nome: 'Eridiane Kestring',
          email: 'eridiane@nutrihub.com',
          crn: 'CRN-12345',
          senha: 'senhaSegura123',
        }),
      ).rejects.toThrow(EmailAlreadyRegisteredError);

      expect(repository.create).not.toHaveBeenCalled();
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
      // senha que o primeiro acabou de gravar.
      patientAuthRepository.consumeAccessToken
        .mockResolvedValueOnce(buildAccessTokenRecord())
        .mockResolvedValueOnce(undefined);

      const [primeiro, segundo] = await Promise.allSettled([
        service.setPatientPassword({ token, senha: 'senhaDoPaciente1' }),
        service.setPatientPassword({ token, senha: 'senhaDoAtacante9' }),
      ]);

      expect(primeiro.status).toBe('fulfilled');
      expect(segundo.status).toBe('rejected');
      expect((segundo as PromiseRejectedResult).reason).toBeInstanceOf(InvalidAccessTokenError);
    });
  });
});
