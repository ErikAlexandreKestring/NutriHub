import { PatientsService } from '../../src/modules/patients/patients.service';
import { PatientsRepository, PatientRecord } from '../../src/modules/patients/patients.repository';
import { PatientAuthRepository } from '../../src/modules/auth/patientAuth.repository';
import { hashAccessToken } from '../../src/shared/utils/accessToken';
import { EmailAlreadyRegisteredError, PatientNotFoundError } from '../../src/shared/errors/AppError';

function buildPatient(overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    id: 'patient-1',
    tenant_id: 'tenant-1',
    nome: 'João Silva',
    email: 'joao@nutrihub.com',
    data_nascimento: '1990-05-20',
    contato: null,
    historico: null,
    status: 'ativo',
    acesso_liberado: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('PatientsService (RF-03)', () => {
  let repository: jest.Mocked<PatientsRepository>;
  let patientAuthRepository: jest.Mocked<PatientAuthRepository>;
  let service: PatientsService;

  beforeEach(() => {
    repository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      inactivate: jest.fn(),
    } as unknown as jest.Mocked<PatientsRepository>;
    patientAuthRepository = {
      findAuthCandidatesByEmail: jest.fn(),
      findByAccessTokenHash: jest.fn(),
      setPassword: jest.fn(),
      saveAccessToken: jest.fn(),
    } as unknown as jest.Mocked<PatientAuthRepository>;
    service = new PatientsService(repository, patientAuthRepository);
  });

  describe('create', () => {
    it('cria o paciente vinculado ao tenant quando o e-mail não existe', async () => {
      repository.findByEmail.mockResolvedValue(undefined);
      repository.create.mockResolvedValue(buildPatient());

      const result = await service.create('tenant-1', {
        nome: 'João Silva',
        email: 'joao@nutrihub.com',
        dataNascimento: '1990-05-20',
      });

      expect(result.email).toBe('joao@nutrihub.com');
      expect(repository.create).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ email: 'joao@nutrihub.com' }));
    });

    it('rejeita cadastro com e-mail já usado no mesmo tenant', async () => {
      repository.findByEmail.mockResolvedValue(buildPatient());

      await expect(
        service.create('tenant-1', { nome: 'João Silva', email: 'joao@nutrihub.com', dataNascimento: '1990-05-20' }),
      ).rejects.toThrow(EmailAlreadyRegisteredError);

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('retorna o paciente quando encontrado', async () => {
      repository.findById.mockResolvedValue(buildPatient());
      const result = await service.getById('tenant-1', 'patient-1');
      expect(result.id).toBe('patient-1');
    });

    it('lança PatientNotFoundError quando não encontrado', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(service.getById('tenant-1', 'inexistente')).rejects.toThrow(PatientNotFoundError);
    });
  });

  describe('update', () => {
    it('atualiza um paciente existente', async () => {
      repository.findById.mockResolvedValue(buildPatient());
      repository.update.mockResolvedValue(buildPatient({ contato: '11999998888' }));

      const result = await service.update('tenant-1', 'patient-1', { contato: '11999998888' });
      expect(result.contato).toBe('11999998888');
    });

    it('lança PatientNotFoundError ao atualizar paciente inexistente', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(service.update('tenant-1', 'inexistente', { contato: 'x' })).rejects.toThrow(PatientNotFoundError);
    });
  });

  describe('update — e-mail único por consultório', () => {
    it('lança EmailAlreadyRegisteredError ao trocar para um e-mail de outro paciente', async () => {
      repository.findById.mockResolvedValue(buildPatient());
      repository.findByEmail.mockResolvedValue(buildPatient({ id: 'patient-2', email: 'maria@nutrihub.com' }));

      await expect(service.update('tenant-1', 'patient-1', { email: 'maria@nutrihub.com' })).rejects.toThrow(
        EmailAlreadyRegisteredError,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('não confunde o e-mail atual do próprio paciente com duplicidade', async () => {
      repository.findById.mockResolvedValue(buildPatient());
      repository.update.mockResolvedValue(buildPatient());

      await service.update('tenant-1', 'patient-1', { email: 'joao@nutrihub.com', nome: 'João S.' });

      expect(repository.findByEmail).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalled();
    });
  });

  describe('inactivate', () => {
    it('inativa (não remove) o paciente', async () => {
      repository.findById.mockResolvedValue(buildPatient());
      repository.inactivate.mockResolvedValue(buildPatient({ status: 'inativo' }));

      const result = await service.inactivate('tenant-1', 'patient-1');
      expect(result.status).toBe('inativo');
    });

    it('lança PatientNotFoundError ao inativar paciente inexistente', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(service.inactivate('tenant-1', 'inexistente')).rejects.toThrow(PatientNotFoundError);
    });
  });

  describe('generateAccessToken (RF-02, primeiro acesso)', () => {
    it('grava apenas o hash do token e devolve o token em claro uma única vez', async () => {
      repository.findById.mockResolvedValue(buildPatient());

      const result = await service.generateAccessToken('tenant-1', 'patient-1');

      expect(result.token).toMatch(/^[0-9a-f]{64}$/);
      expect(patientAuthRepository.saveAccessToken).toHaveBeenCalledWith(
        'tenant-1',
        'patient-1',
        hashAccessToken(result.token),
        expect.any(Date),
      );

      // O que vai ao banco não pode ser o token que o paciente vai usar.
      const [, , tokenGravado] = patientAuthRepository.saveAccessToken.mock.calls[0];
      expect(tokenGravado).not.toBe(result.token);
    });

    it('gera um token diferente a cada chamada, invalidando o anterior', async () => {
      repository.findById.mockResolvedValue(buildPatient());

      const primeiro = await service.generateAccessToken('tenant-1', 'patient-1');
      const segundo = await service.generateAccessToken('tenant-1', 'patient-1');

      expect(primeiro.token).not.toBe(segundo.token);
    });

    it('não gera token para paciente de outro tenant (RN-01)', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(service.generateAccessToken('tenant-1', 'patient-de-outro-tenant')).rejects.toThrow(
        PatientNotFoundError,
      );
      expect(patientAuthRepository.saveAccessToken).not.toHaveBeenCalled();
    });
  });
});