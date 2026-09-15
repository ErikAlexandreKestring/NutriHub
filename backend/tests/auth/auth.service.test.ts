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
    acesso_token_expira_em: new Date(Date.now() + 72 * 60 * 60 * 1000),
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
      findByAccessTokenHash: jest.fn(),
      setPassword: jest.fn(),
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
      patientAuthRepository.findByAccessTokenHash.mockResolvedValue(buildAccessTokenRecord());

      const result = await service.setPatientPassword({ token, senha: 'senhaDoPaciente1' });

      // A busca é feita pelo HASH: o token em claro nunca vai ao banco.
      expect(patientAuthRepository.findByAccessTokenHash).toHaveBeenCalledWith(hashAccessToken(token));
      expect(patientAuthRepository.setPassword).toHaveBeenCalledWith(
        'tenant-1',
        'patient-1',
        expect.any(String),
      );

      const [, , senhaHashGravado] = patientAuthRepository.setPassword.mock.calls[0];
      expect(senhaHashGravado).not.toBe('senhaDoPaciente1');

      expect(verifyToken(result.token).role).toBe('paciente');
    });

    it('rejeita token inexistente ou já utilizado', async () => {
      patientAuthRepository.findByAccessTokenHash.mockResolvedValue(undefined);

      await expect(
        service.setPatientPassword({ token: generateAccessToken(), senha: 'senhaDoPaciente1' }),
      ).rejects.toThrow(InvalidAccessTokenError);

      expect(patientAuthRepository.setPassword).not.toHaveBeenCalled();
    });

    it('rejeita token expirado', async () => {
      patientAuthRepository.findByAccessTokenHash.mockResolvedValue(
        buildAccessTokenRecord({ acesso_token_expira_em: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.setPatientPassword({ token: generateAccessToken(), senha: 'senhaDoPaciente1' }),
      ).rejects.toThrow(InvalidAccessTokenError);

      expect(patientAuthRepository.setPassword).not.toHaveBeenCalled();
    });
  });
});
