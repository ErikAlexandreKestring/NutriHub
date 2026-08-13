import { AuthService } from '../../src/modules/auth/auth.service';
import { AuthRepository, TenantRecord } from '../../src/modules/auth/auth.repository';
import { hashPassword } from '../../src/shared/utils/password';
import { verifyToken } from '../../src/shared/utils/jwt';
import {
  AccountLockedError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from '../../src/shared/errors/AppError';
import { __resetAllAttempts } from '../../src/modules/auth/loginAttempts';

function buildTenant(overrides: Partial<TenantRecord> = {}): TenantRecord {
  return {
    id: 'tenant-1',
    nome: 'Eridiane Kestring',
    email: 'eridiane@nutrihub.com',
    crn: 'CRN-12345',
    senha_hash: '',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let repository: jest.Mocked<AuthRepository>;
  let service: AuthService;

  beforeEach(() => {
    __resetAllAttempts();
    repository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;
    service = new AuthService(repository);
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
});
