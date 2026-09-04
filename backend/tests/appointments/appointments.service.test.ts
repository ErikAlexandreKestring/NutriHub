import { AppointmentsService } from '../../src/modules/appointments/appointments.service';
import { AppointmentsRepository, AppointmentRecord } from '../../src/modules/appointments/appointments.repository';
import { AvailabilityRepository, AvailabilityRecord } from '../../src/modules/availability/availability.repository';
import { PatientsRepository, PatientRecord } from '../../src/modules/patients/patients.repository';
import { AuthRepository, TenantRecord } from '../../src/modules/auth/auth.repository';
import {
  AppointmentAlreadyCancelledError,
  AppointmentNotFoundError,
  CancellationWindowError,
  OutsideAvailabilityError,
  PastDateTimeError,
  PatientNotFoundError,
  ScheduleConflictError,
} from '../../src/shared/errors/AppError';

function buildPatient(overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    id: 'patient-1',
    tenant_id: 'tenant-1',
    nome: 'Paciente Teste',
    email: 'paciente@nutrihub.com',
    data_nascimento: '1990-01-01',
    contato: null,
    historico: null,
    status: 'ativo',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildTenant(overrides: Partial<TenantRecord> = {}): TenantRecord {
  return {
    id: 'tenant-1',
    nome: 'Nutri Teste',
    email: 'nutri@nutrihub.com',
    crn: 'CRN-1',
    senha_hash: '',
    cancelamento_antecedencia_horas: 24,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildAppointment(overrides: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    id: 'appt-1',
    tenant_id: 'tenant-1',
    patient_id: 'patient-1',
    data_hora: new Date(Date.now() + 48 * 60 * 60 * 1000),
    status: 'confirmado',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Grade que cobre o dia inteiro para o dia da semana de `date` — usada nos
// testes que não são sobre a própria RN-08, evitando acoplar o teste a um
// dia da semana fixo (que dependeria do fuso horário do ambiente).
function buildFullDaySlot(date: Date): AvailabilityRecord {
  return {
    id: 'slot-1',
    tenant_id: 'tenant-1',
    day_of_week: date.getDay(),
    start_time: '00:00:00',
    end_time: '23:59:00',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

describe('AppointmentsService (RF-08/11/12)', () => {
  let repository: jest.Mocked<AppointmentsRepository>;
  let availabilityRepository: jest.Mocked<AvailabilityRepository>;
  let patientsRepository: jest.Mocked<PatientsRepository>;
  let authRepository: jest.Mocked<AuthRepository>;
  let service: AppointmentsService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      listByPatient: jest.fn(),
      findConflict: jest.fn(),
      updateStatus: jest.fn(),
      reschedule: jest.fn(),
    } as unknown as jest.Mocked<AppointmentsRepository>;

    availabilityRepository = {
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      listByDay: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<AvailabilityRepository>;

    patientsRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      inactivate: jest.fn(),
    } as unknown as jest.Mocked<PatientsRepository>;

    authRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<AuthRepository>;

    service = new AppointmentsService(repository, availabilityRepository, patientsRepository, authRepository);
  });

  describe('create (RN-07/08/09)', () => {
    it('agenda quando a data é futura, está na grade e não há conflito', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(futureDate)]);
      repository.findConflict.mockResolvedValue(undefined);
      repository.create.mockResolvedValue(buildAppointment({ data_hora: futureDate }));

      const result = await service.create('tenant-1', 'patient-1', { dataHora: futureDate.toISOString() });
      expect(result.status).toBe('confirmado');
    });

    it('lança PatientNotFoundError se o paciente não existe no tenant', async () => {
      patientsRepository.findById.mockResolvedValue(undefined);
      await expect(
        service.create('tenant-1', 'inexistente', { dataHora: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
      ).rejects.toThrow(PatientNotFoundError);
    });

    it('rejeita data no passado (RN-07 / E-10)', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);

      await expect(service.create('tenant-1', 'patient-1', { dataHora: pastDate.toISOString() })).rejects.toThrow(
        PastDateTimeError,
      );
    });

    it('rejeita horário fora da grade de disponibilidade (RN-08 / E-11)', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      availabilityRepository.listByDay.mockResolvedValue([]);
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

      await expect(
        service.create('tenant-1', 'patient-1', { dataHora: futureDate.toISOString() }),
      ).rejects.toThrow(OutsideAvailabilityError);
    });

    it('rejeita conflito com outro agendamento confirmado no mesmo horário (RN-09 / E-12)', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(futureDate)]);
      repository.findConflict.mockResolvedValue(buildAppointment({ id: 'outro-appt' }));

      await expect(
        service.create('tenant-1', 'patient-1', { dataHora: futureDate.toISOString() }),
      ).rejects.toThrow(ScheduleConflictError);
    });
  });

  describe('cancel (RN-10 / E-19)', () => {
    it('nutricionista pode cancelar a qualquer momento, mesmo em cima da hora', async () => {
      const soon = new Date(Date.now() + 60 * 60 * 1000);
      repository.findById.mockResolvedValue(buildAppointment({ data_hora: soon }));
      repository.updateStatus.mockResolvedValue(buildAppointment({ data_hora: soon, status: 'cancelado' }));

      const result = await service.cancel('tenant-1', 'appt-1', 'nutricionista');
      expect(result.status).toBe('cancelado');
      expect(authRepository.findById).not.toHaveBeenCalled();
    });

    it('paciente pode cancelar respeitando a antecedência mínima do tenant', async () => {
      const farEnough = new Date(Date.now() + 48 * 60 * 60 * 1000);
      repository.findById.mockResolvedValue(buildAppointment({ data_hora: farEnough }));
      authRepository.findById.mockResolvedValue(buildTenant({ cancelamento_antecedencia_horas: 24 }));
      repository.updateStatus.mockResolvedValue(buildAppointment({ data_hora: farEnough, status: 'cancelado' }));

      const result = await service.cancel('tenant-1', 'appt-1', 'paciente');
      expect(result.status).toBe('cancelado');
    });

    it('rejeita cancelamento do paciente fora da antecedência mínima (RN-10 / E-19)', async () => {
      const tooSoon = new Date(Date.now() + 2 * 60 * 60 * 1000);
      repository.findById.mockResolvedValue(buildAppointment({ data_hora: tooSoon }));
      authRepository.findById.mockResolvedValue(buildTenant({ cancelamento_antecedencia_horas: 24 }));

      await expect(service.cancel('tenant-1', 'appt-1', 'paciente')).rejects.toThrow(CancellationWindowError);
      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it('lança AppointmentNotFoundError para agendamento inexistente', async () => {
      repository.findById.mockResolvedValue(undefined);
      await expect(service.cancel('tenant-1', 'inexistente', 'nutricionista')).rejects.toThrow(
        AppointmentNotFoundError,
      );
    });

    it('lança AppointmentAlreadyCancelledError ao cancelar um agendamento já cancelado', async () => {
      repository.findById.mockResolvedValue(buildAppointment({ status: 'cancelado' }));
      await expect(service.cancel('tenant-1', 'appt-1', 'nutricionista')).rejects.toThrow(
        AppointmentAlreadyCancelledError,
      );
    });
  });

  describe('reschedule (RF-12)', () => {
    it('remarca quando o novo horário é válido', async () => {
      repository.findById.mockResolvedValue(buildAppointment());
      const novoHorario = new Date(Date.now() + 72 * 60 * 60 * 1000);
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(novoHorario)]);
      repository.findConflict.mockResolvedValue(undefined);
      repository.reschedule.mockResolvedValue(buildAppointment({ data_hora: novoHorario }));

      const result = await service.reschedule('tenant-1', 'appt-1', { dataHora: novoHorario.toISOString() });
      expect(result.data_hora).toEqual(novoHorario);
    });

    it('exclui o próprio agendamento da checagem de conflito ao remarcar', async () => {
      repository.findById.mockResolvedValue(buildAppointment({ id: 'appt-1' }));
      const novoHorario = new Date(Date.now() + 72 * 60 * 60 * 1000);
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(novoHorario)]);
      repository.findConflict.mockResolvedValue(undefined);
      repository.reschedule.mockResolvedValue(buildAppointment({ data_hora: novoHorario }));

      await service.reschedule('tenant-1', 'appt-1', { dataHora: novoHorario.toISOString() });
      expect(repository.findConflict).toHaveBeenCalledWith('tenant-1', novoHorario, 'appt-1');
    });

    it('rejeita remarcar um agendamento já cancelado', async () => {
      repository.findById.mockResolvedValue(buildAppointment({ status: 'cancelado' }));
      await expect(
        service.reschedule('tenant-1', 'appt-1', { dataHora: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
      ).rejects.toThrow(AppointmentAlreadyCancelledError);
    });
  });
});
