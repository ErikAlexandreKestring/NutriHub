import {
  AppointmentsService,
  HORIZONTE_DE_AGENDAMENTO_DIAS,
  LIMITE_CONSULTAS_FUTURAS_DO_PACIENTE,
  SLOT_MINUTES,
} from '../../src/modules/appointments/appointments.service';
import { AppointmentsRepository, AppointmentRecord } from '../../src/modules/appointments/appointments.repository';
import { AvailabilityRepository, AvailabilityRecord } from '../../src/modules/availability/availability.repository';
import { PatientsRepository, PatientRecord } from '../../src/modules/patients/patients.repository';
import { AuthRepository, TenantRecord } from '../../src/modules/auth/auth.repository';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { getZonedDayAndTime } from '../../src/shared/utils/timezone';
import {
  AppointmentAlreadyCancelledError,
  AppointmentNotFoundError,
  CancellationWindowError,
  OffGridTimeError,
  OutsideAvailabilityError,
  PastDateTimeError,
  BookingHorizonError,
  PatientAppointmentLimitError,
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
    acesso_liberado: false,
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
    telefone: null,
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
    data_hora: horaCheia(Date.now() + 48 * 60 * 60 * 1000),
    status: 'confirmado',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const HORA_MS = 60 * 60 * 1000;

/**
 * Primeira hora cheia a partir de `ms` (epoch). #47: a consulta só começa em
 * hora cheia da grade, e o fuso de Brasília está a horas inteiras do UTC,
 * então hora cheia em UTC é hora cheia lá também.
 */
function horaCheia(ms: number): Date {
  return new Date(Math.ceil(ms / HORA_MS) * HORA_MS);
}

// Grade que cobre o dia inteiro para o dia da semana de `date` (no fuso de
// Brasília) — usada nos testes que não são sobre a própria RN-08, evitando
// acoplar o teste a um dia da semana fixo.
function buildFullDaySlot(date: Date): AvailabilityRecord {
  return {
    id: 'slot-1',
    tenant_id: 'tenant-1',
    day_of_week: getZonedDayAndTime(date).dayOfWeek,
    start_time: '00:00:00',
    end_time: '24:00:00',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

describe('AppointmentsService (RF-08/11/12)', () => {
  let repository: jest.Mocked<AppointmentsRepository>;
  let availabilityRepository: jest.Mocked<AvailabilityRepository>;
  let patientsRepository: jest.Mocked<PatientsRepository>;
  let authRepository: jest.Mocked<AuthRepository>;
  let notifications: jest.Mocked<NotificationsService>;
  let service: AppointmentsService;

  beforeEach(() => {
    repository = {
      createIfFree: jest.fn(),
      rescheduleIfFree: jest.fn(),
      findById: jest.fn(),
      listByPatient: jest.fn(),
      updateStatus: jest.fn(),
      listConfirmedFrom: jest.fn(),
      listConfirmedTimesBetween: jest.fn(),
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

    notifications = {
      consultaAgendada: jest.fn(),
      consultaCancelada: jest.fn(),
      consultaRemarcada: jest.fn(),
    } as unknown as jest.Mocked<NotificationsService>;

    service = new AppointmentsService(
      repository,
      availabilityRepository,
      patientsRepository,
      authRepository,
      notifications,
    );
  });

  describe('create (RN-07/08/09)', () => {
    it('agenda quando a data é futura, está na grade e não há conflito', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      const futureDate = horaCheia(Date.now() + 48 * 60 * 60 * 1000);
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(futureDate)]);
      const created = buildAppointment({ data_hora: futureDate });
      repository.createIfFree.mockResolvedValue({ criada: created });

      const result = await service.create('tenant-1', 'patient-1', { dataHora: futureDate.toISOString() }, 'nutricionista');
      expect(result.status).toBe('confirmado');
      // Fluxo 3.4, passo 8: as duas partes são avisadas.
      expect(notifications.consultaAgendada).toHaveBeenCalledWith('tenant-1', created);
    });

    it('lança PatientNotFoundError se o paciente não existe no tenant', async () => {
      patientsRepository.findById.mockResolvedValue(undefined);
      await expect(
        service.create('tenant-1', 'inexistente', { dataHora: horaCheia(Date.now() + 60 * 60 * 1000).toISOString() }, 'nutricionista'),
      ).rejects.toThrow(PatientNotFoundError);
    });

    it('rejeita data no passado (RN-07 / E-10)', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);

      await expect(service.create('tenant-1', 'patient-1', { dataHora: pastDate.toISOString() }, 'nutricionista')).rejects.toThrow(
        PastDateTimeError,
      );
    });

    it('rejeita horário fora da grade de disponibilidade (RN-08 / E-11)', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      availabilityRepository.listByDay.mockResolvedValue([]);
      const futureDate = horaCheia(Date.now() + 48 * 60 * 60 * 1000);

      await expect(
        service.create('tenant-1', 'patient-1', { dataHora: futureDate.toISOString() }, 'nutricionista'),
      ).rejects.toThrow(OutsideAvailabilityError);
    });

    describe('horário dentro da grade (#47)', () => {
      // Segunda-feira, 08:00–12:00 em Brasília. 2030-01-07 é uma segunda.
      function gradeDeSegunda(): void {
        patientsRepository.findById.mockResolvedValue(buildPatient());
        availabilityRepository.listByDay.mockResolvedValue([
          { ...buildFullDaySlot(new Date()), day_of_week: 1, start_time: '08:00:00', end_time: '12:00:00' },
        ]);
        repository.createIfFree.mockResolvedValue({ criada: buildAppointment() });
      }

      // Horário de Brasília → ISO em UTC (Brasília = UTC-3).
      const SEGUNDA = (hora: string) => `2030-01-07T${hora}-03:00`;

      it.each(['08:00:00', '11:00:00'])('aceita a consulta que começa em hora cheia da grade (%s)', async (hora) => {
        gradeDeSegunda();
        await expect(
          service.create('tenant-1', 'patient-1', { dataHora: SEGUNDA(hora) }, 'nutricionista'),
        ).resolves.toBeDefined();
      });

      it.each(['10:17:00', '10:30:00', '09:00:30'])('recusa minutos ou segundos quebrados (%s, E-24)', async (hora) => {
        gradeDeSegunda();
        await expect(
          service.create('tenant-1', 'patient-1', { dataHora: SEGUNDA(hora) }, 'nutricionista'),
        ).rejects.toThrow(OffGridTimeError);
        expect(repository.createIfFree).not.toHaveBeenCalled();
      });

      it.each(['11:30:00', '12:00:00', '07:00:00'])(
        'recusa a consulta que começaria ou terminaria fora do expediente (%s, E-11)',
        async (hora) => {
          gradeDeSegunda();
          await expect(
            service.create('tenant-1', 'patient-1', { dataHora: SEGUNDA(hora) }, 'nutricionista'),
          ).rejects.toThrow(OutsideAvailabilityError);
          expect(repository.createIfFree).not.toHaveBeenCalled();
        },
      );

      it('a hora cheia conta a partir do início de cada intervalo', async () => {
        patientsRepository.findById.mockResolvedValue(buildPatient());
        availabilityRepository.listByDay.mockResolvedValue([
          { ...buildFullDaySlot(new Date()), day_of_week: 1, start_time: '13:30:00', end_time: '17:30:00' },
        ]);
        repository.createIfFree.mockResolvedValue({ criada: buildAppointment() });

        await expect(
          service.create('tenant-1', 'patient-1', { dataHora: SEGUNDA('14:30:00') }, 'nutricionista'),
        ).resolves.toBeDefined();
        await expect(
          service.create('tenant-1', 'patient-1', { dataHora: SEGUNDA('14:00:00') }, 'nutricionista'),
        ).rejects.toThrow(OffGridTimeError);
      });
    });

    it('rejeita conflito com outra consulta confirmada (RN-09 / E-12)', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      const futureDate = horaCheia(Date.now() + 48 * 60 * 60 * 1000);
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(futureDate)]);
      repository.createIfFree.mockResolvedValue({ conflito: buildAppointment({ id: 'outro-appt' }) });

      await expect(
        service.create('tenant-1', 'patient-1', { dataHora: futureDate.toISOString() }, 'nutricionista'),
      ).rejects.toThrow(ScheduleConflictError);
      expect(notifications.consultaAgendada).not.toHaveBeenCalled();
    });
  });

  describe('limites do paciente ao agendar (#42)', () => {
    const DIA_MS = 24 * 60 * 60 * 1000;

    function prepararHorario(daquiA: number): Date {
      patientsRepository.findById.mockResolvedValue(buildPatient());
      const dataHora = horaCheia(Date.now() + daquiA);
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(dataHora)]);
      return dataHora;
    }

    it('o paciente agenda pelo caminho que respeita o limite de consultas futuras', async () => {
      const dataHora = prepararHorario(2 * DIA_MS);
      const criada = buildAppointment({ data_hora: dataHora });
      repository.createIfFree.mockResolvedValue({ criada });

      const result = await service.create('tenant-1', 'patient-1', { dataHora: dataHora.toISOString() }, 'paciente');

      expect(result).toBe(criada);
      expect(repository.createIfFree).toHaveBeenCalledWith(
        'tenant-1',
        'patient-1',
        dataHora,
        SLOT_MINUTES,
        LIMITE_CONSULTAS_FUTURAS_DO_PACIENTE,
      );
    });

    it('recusa uma segunda consulta futura e diz qual é a que já está marcada (E-22)', async () => {
      const dataHora = prepararHorario(3 * DIA_MS);
      // 14/10/2026, 12:00 UTC = 09:00 em São Paulo.
      const proxima = buildAppointment({ data_hora: new Date('2026-10-14T12:00:00.000Z') });
      repository.createIfFree.mockResolvedValue({ proxima });

      const tentativa = service.create('tenant-1', 'patient-1', { dataHora: dataHora.toISOString() }, 'paciente');

      await expect(tentativa).rejects.toThrow(PatientAppointmentLimitError);
      await expect(tentativa).rejects.toThrow(
        'Você já tem uma consulta marcada para quarta-feira, 14/10 às 09:00. Remarque-a se precisar de outro horário.',
      );
      expect(notifications.consultaAgendada).not.toHaveBeenCalled();
    });

    it(`recusa consulta além de ${HORIZONTE_DE_AGENDAMENTO_DIAS} dias (E-23)`, async () => {
      const dataHora = prepararHorario((HORIZONTE_DE_AGENDAMENTO_DIAS + 1) * DIA_MS);

      await expect(
        service.create('tenant-1', 'patient-1', { dataHora: dataHora.toISOString() }, 'paciente'),
      ).rejects.toThrow(BookingHorizonError);
      expect(repository.createIfFree).not.toHaveBeenCalled();
    });

    it('aceita consulta no último dia do horizonte', async () => {
      const dataHora = prepararHorario(HORIZONTE_DE_AGENDAMENTO_DIAS * DIA_MS - 60 * 60 * 1000);
      repository.createIfFree.mockResolvedValue({ criada: buildAppointment({ data_hora: dataHora }) });

      await expect(
        service.create('tenant-1', 'patient-1', { dataHora: dataHora.toISOString() }, 'paciente'),
      ).resolves.toBeDefined();
    });

    it('o nutricionista não tem limite de consultas nem horizonte', async () => {
      const dataHora = prepararHorario(180 * DIA_MS);
      repository.createIfFree.mockResolvedValue({ criada: buildAppointment({ data_hora: dataHora }) });

      await expect(
        service.create('tenant-1', 'patient-1', { dataHora: dataHora.toISOString() }, 'nutricionista'),
      ).resolves.toBeDefined();
      // Sem limite: o último argumento (limite do paciente) fica vazio.
      expect(repository.createIfFree).toHaveBeenCalledWith('tenant-1', 'patient-1', dataHora, SLOT_MINUTES, undefined);
    });

    it('o paciente também não remarca para além do horizonte', async () => {
      repository.findById.mockResolvedValue(buildAppointment({ data_hora: horaCheia(Date.now() + 5 * DIA_MS) }));
      authRepository.findById.mockResolvedValue(buildTenant());
      const novaData = horaCheia(Date.now() + (HORIZONTE_DE_AGENDAMENTO_DIAS + 1) * DIA_MS);
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(novaData)]);

      await expect(
        service.reschedule('tenant-1', 'appt-1', { dataHora: novaData.toISOString() }, 'paciente', 'patient-1'),
      ).rejects.toThrow(BookingHorizonError);
      expect(repository.rescheduleIfFree).not.toHaveBeenCalled();
    });
  });

  describe('cancel (RN-10 / E-19)', () => {
    it('nutricionista pode cancelar a qualquer momento, mesmo em cima da hora', async () => {
      const soon = horaCheia(Date.now() + 60 * 60 * 1000);
      repository.findById.mockResolvedValue(buildAppointment({ data_hora: soon }));
      repository.updateStatus.mockResolvedValue(buildAppointment({ data_hora: soon, status: 'cancelado' }));

      const result = await service.cancel('tenant-1', 'appt-1', 'nutricionista');
      expect(result.status).toBe('cancelado');
      expect(authRepository.findById).not.toHaveBeenCalled();
      // RF-11: quem cancelou foi o nutricionista, então o aviso vai para o paciente.
      expect(notifications.consultaCancelada).toHaveBeenCalledWith('tenant-1', result, 'nutricionista');
    });

    it('paciente pode cancelar respeitando a antecedência mínima do tenant', async () => {
      const farEnough = horaCheia(Date.now() + 48 * 60 * 60 * 1000);
      repository.findById.mockResolvedValue(buildAppointment({ data_hora: farEnough }));
      authRepository.findById.mockResolvedValue(buildTenant({ cancelamento_antecedencia_horas: 24 }));
      repository.updateStatus.mockResolvedValue(buildAppointment({ data_hora: farEnough, status: 'cancelado' }));

      const result = await service.cancel('tenant-1', 'appt-1', 'paciente');
      expect(result.status).toBe('cancelado');
    });

    it('rejeita cancelamento do paciente fora da antecedência mínima (RN-10 / E-19)', async () => {
      const tooSoon = horaCheia(Date.now() + 2 * 60 * 60 * 1000);
      repository.findById.mockResolvedValue(buildAppointment({ data_hora: tooSoon }));
      authRepository.findById.mockResolvedValue(buildTenant({ cancelamento_antecedencia_horas: 24 }));

      await expect(service.cancel('tenant-1', 'appt-1', 'paciente')).rejects.toThrow(CancellationWindowError);
      expect(repository.updateStatus).not.toHaveBeenCalled();
      expect(notifications.consultaCancelada).not.toHaveBeenCalled();
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

  // O ator deixou de vir do corpo da requisição e passa a sair do `role` do JWT
  // (ver appointments.controller). `restrictToPatientId` é preenchido só quando
  // quem chama é o paciente — dois pacientes do mesmo nutricionista dividem o
  // tenant_id, então o RLS não os separa.
  describe('escopo do paciente sobre a própria consulta (RF-02/RF-11/RF-12)', () => {
    const farEnough = horaCheia(Date.now() + 48 * 60 * 60 * 1000);

    it('deixa o paciente cancelar a consulta que é dele', async () => {
      repository.findById.mockResolvedValue(buildAppointment({ patient_id: 'patient-1', data_hora: farEnough }));
      authRepository.findById.mockResolvedValue(buildTenant({ cancelamento_antecedencia_horas: 24 }));
      repository.updateStatus.mockResolvedValue(buildAppointment({ status: 'cancelado' }));

      await expect(service.cancel('tenant-1', 'appt-1', 'paciente', 'patient-1')).resolves.toBeDefined();
    });

    it('esconde (404) a consulta de outro paciente do mesmo tenant no cancelamento', async () => {
      repository.findById.mockResolvedValue(buildAppointment({ patient_id: 'patient-2', data_hora: farEnough }));

      await expect(service.cancel('tenant-1', 'appt-1', 'paciente', 'patient-1')).rejects.toThrow(
        AppointmentNotFoundError,
      );
      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it('esconde (404) a consulta de outro paciente do mesmo tenant na remarcação', async () => {
      repository.findById.mockResolvedValue(buildAppointment({ patient_id: 'patient-2' }));

      await expect(
        service.reschedule('tenant-1', 'appt-1', { dataHora: farEnough.toISOString() }, 'paciente', 'patient-1'),
      ).rejects.toThrow(AppointmentNotFoundError);
      expect(repository.rescheduleIfFree).not.toHaveBeenCalled();
    });

    it('não restringe o nutricionista, que opera qualquer consulta do seu tenant', async () => {
      repository.findById.mockResolvedValue(buildAppointment({ patient_id: 'patient-2', data_hora: farEnough }));
      repository.updateStatus.mockResolvedValue(buildAppointment({ status: 'cancelado' }));

      await expect(service.cancel('tenant-1', 'appt-1', 'nutricionista')).resolves.toBeDefined();
    });
  });

  describe('reschedule (RF-12)', () => {
    it('remarca quando o novo horário é válido', async () => {
      const original = buildAppointment();
      repository.findById.mockResolvedValue(original);
      const novoHorario = horaCheia(Date.now() + 72 * 60 * 60 * 1000);
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(novoHorario)]);
      repository.rescheduleIfFree.mockResolvedValue({ remarcada: buildAppointment({ data_hora: novoHorario }) });

      const result = await service.reschedule(
        'tenant-1',
        'appt-1',
        { dataHora: novoHorario.toISOString() },
        'nutricionista',
      );
      expect(result.data_hora).toEqual(novoHorario);
      // Fluxo 3.6, passo 7B: o aviso leva o horário antigo e o novo.
      expect(notifications.consultaRemarcada).toHaveBeenCalledWith('tenant-1', result, original.data_hora);
    });

    it('remarca pela gravação que checa a sobreposição, ignorando a própria consulta', async () => {
      repository.findById.mockResolvedValue(buildAppointment({ id: 'appt-1' }));
      const novoHorario = horaCheia(Date.now() + 72 * 60 * 60 * 1000);
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(novoHorario)]);
      repository.rescheduleIfFree.mockResolvedValue({ remarcada: buildAppointment({ data_hora: novoHorario }) });

      await service.reschedule('tenant-1', 'appt-1', { dataHora: novoHorario.toISOString() }, 'nutricionista');
      expect(repository.rescheduleIfFree).toHaveBeenCalledWith('tenant-1', 'appt-1', novoHorario, SLOT_MINUTES);
    });

    it('rejeita remarcar para um horário que se sobrepõe a outra consulta (RN-09 / E-12)', async () => {
      repository.findById.mockResolvedValue(buildAppointment({ id: 'appt-1' }));
      const novoHorario = horaCheia(Date.now() + 72 * 60 * 60 * 1000);
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(novoHorario)]);
      repository.rescheduleIfFree.mockResolvedValue({ conflito: buildAppointment({ id: 'outra' }) });

      await expect(
        service.reschedule('tenant-1', 'appt-1', { dataHora: novoHorario.toISOString() }, 'nutricionista'),
      ).rejects.toThrow(ScheduleConflictError);
      expect(notifications.consultaRemarcada).not.toHaveBeenCalled();
    });

    it('rejeita remarcação do paciente fora da antecedência mínima (RN-10 / E-19)', async () => {
      // Remarcar libera o horário original exatamente como um cancelamento: sem
      // esta checagem, bastava remarcar em vez de cancelar para furar a RN-10.
      const tooSoon = horaCheia(Date.now() + 2 * 60 * 60 * 1000);
      repository.findById.mockResolvedValue(buildAppointment({ patient_id: 'patient-1', data_hora: tooSoon }));
      authRepository.findById.mockResolvedValue(buildTenant({ cancelamento_antecedencia_horas: 24 }));

      await expect(
        service.reschedule(
          'tenant-1',
          'appt-1',
          { dataHora: horaCheia(Date.now() + 96 * 60 * 60 * 1000).toISOString() },
          'paciente',
          'patient-1',
        ),
      ).rejects.toThrow(CancellationWindowError);
      expect(repository.rescheduleIfFree).not.toHaveBeenCalled();
    });

    it('deixa o nutricionista remarcar em cima da hora, sem RN-10', async () => {
      const tooSoon = horaCheia(Date.now() + 2 * 60 * 60 * 1000);
      const novoHorario = horaCheia(Date.now() + 96 * 60 * 60 * 1000);
      repository.findById.mockResolvedValue(buildAppointment({ data_hora: tooSoon }));
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(novoHorario)]);
      repository.rescheduleIfFree.mockResolvedValue({ remarcada: buildAppointment({ data_hora: novoHorario }) });

      await expect(
        service.reschedule('tenant-1', 'appt-1', { dataHora: novoHorario.toISOString() }, 'nutricionista'),
      ).resolves.toBeDefined();
      expect(authRepository.findById).not.toHaveBeenCalled();
    });

    it('deixa o paciente remarcar dentro da antecedência mínima', async () => {
      const farEnough = horaCheia(Date.now() + 48 * 60 * 60 * 1000);
      const novoHorario = horaCheia(Date.now() + 96 * 60 * 60 * 1000);
      repository.findById.mockResolvedValue(buildAppointment({ patient_id: 'patient-1', data_hora: farEnough }));
      authRepository.findById.mockResolvedValue(buildTenant({ cancelamento_antecedencia_horas: 24 }));
      availabilityRepository.listByDay.mockResolvedValue([buildFullDaySlot(novoHorario)]);
      repository.rescheduleIfFree.mockResolvedValue({ remarcada: buildAppointment({ data_hora: novoHorario }) });

      await expect(
        service.reschedule(
          'tenant-1',
          'appt-1',
          { dataHora: novoHorario.toISOString() },
          'paciente',
          'patient-1',
        ),
      ).resolves.toBeDefined();
    });

    it('rejeita remarcar um agendamento já cancelado', async () => {
      repository.findById.mockResolvedValue(buildAppointment({ status: 'cancelado' }));
      await expect(
        service.reschedule(
          'tenant-1',
          'appt-1',
          { dataHora: horaCheia(Date.now() + 60 * 60 * 1000).toISOString() },
          'nutricionista',
        ),
      ).rejects.toThrow(AppointmentAlreadyCancelledError);
    });
  });

  describe('listUpcoming (RF-08/RF-10)', () => {
    it('busca as consultas confirmadas desde o início do dia em Brasília', async () => {
      repository.listConfirmedFrom.mockResolvedValue([]);

      await service.listUpcoming('tenant-1');

      const from = repository.listConfirmedFrom.mock.calls[0][1];
      // Meia-noite em Brasília é 03:00 UTC, e nunca depois de agora.
      expect(from.toISOString()).toMatch(/T03:00:00.000Z$/);
      expect(from.getTime()).toBeLessThanOrEqual(Date.now());
      expect(Date.now() - from.getTime()).toBeLessThan(24 * 60 * 60 * 1000);
    });
  });

  describe('listFreeSlots (fluxo 3.4, passo 2)', () => {
    // 2030-01-07 é uma segunda-feira.
    function mondayGrid(start: string, end: string): AvailabilityRecord {
      return { ...buildFullDaySlot(new Date()), day_of_week: 1, start_time: start, end_time: end };
    }

    it('fatia a grade em consultas de 1h que caibam inteiras no intervalo', async () => {
      availabilityRepository.list.mockResolvedValue([mondayGrid('08:00:00', '10:30:00')]);
      repository.listConfirmedTimesBetween.mockResolvedValue([]);

      const slots = await service.listFreeSlots('tenant-1', { de: '2030-01-07', ate: '2030-01-07' });

      // 08h e 09h de Brasília; 10h terminaria às 11h, depois do fim da grade.
      expect(slots).toEqual([{ data_hora: '2030-01-07T11:00:00.000Z' }, { data_hora: '2030-01-07T12:00:00.000Z' }]);
    });

    it('consulta o período inteiro, do início do primeiro dia ao fim do último', async () => {
      availabilityRepository.list.mockResolvedValue([]);
      repository.listConfirmedTimesBetween.mockResolvedValue([]);

      await service.listFreeSlots('tenant-1', { de: '2030-01-07', ate: '2030-01-08' });

      const [, from, to] = repository.listConfirmedTimesBetween.mock.calls[0];
      expect(from.toISOString()).toBe('2030-01-07T03:00:00.000Z');
      expect(to.toISOString()).toBe('2030-01-09T03:00:00.000Z');
    });

    it('esconde horários ocupados por consulta confirmada (RN-09)', async () => {
      availabilityRepository.list.mockResolvedValue([mondayGrid('08:00:00', '11:00:00')]);
      // Uma consulta às 09h30 colide com as fatias das 09h e das 10h.
      repository.listConfirmedTimesBetween.mockResolvedValue([new Date('2030-01-07T12:30:00.000Z')]);

      const slots = await service.listFreeSlots('tenant-1', { de: '2030-01-07', ate: '2030-01-07' });

      expect(slots).toEqual([{ data_hora: '2030-01-07T11:00:00.000Z' }]);
    });

    it('ignora dias sem grade e não repete horário de intervalos sobrepostos', async () => {
      availabilityRepository.list.mockResolvedValue([
        mondayGrid('08:00:00', '09:00:00'),
        mondayGrid('08:00:00', '10:00:00'),
      ]);
      repository.listConfirmedTimesBetween.mockResolvedValue([]);

      // Segunda a quarta: só a segunda tem grade.
      const slots = await service.listFreeSlots('tenant-1', { de: '2030-01-07', ate: '2030-01-09' });

      expect(slots.map((slot) => slot.data_hora)).toEqual(['2030-01-07T11:00:00.000Z', '2030-01-07T12:00:00.000Z']);
    });

    it('não oferece horários no passado (RN-07)', async () => {
      // 2020-01-06 também é uma segunda-feira.
      availabilityRepository.list.mockResolvedValue([mondayGrid('08:00:00', '12:00:00')]);
      repository.listConfirmedTimesBetween.mockResolvedValue([]);

      const slots = await service.listFreeSlots('tenant-1', { de: '2020-01-06', ate: '2020-01-06' });

      expect(slots).toEqual([]);
    });
  });
});
