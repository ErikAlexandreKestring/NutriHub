import { AppointmentsRepository } from './appointments.repository';
import { AvailabilityRepository } from '../availability/availability.repository';
import { PatientsRepository } from '../patients/patients.repository';
import { AuthRepository } from '../auth/auth.repository';
import { Ator, DateTimeInput } from './appointments.validation';
import {
  AppointmentAlreadyCancelledError,
  AppointmentNotFoundError,
  CancellationWindowError,
  OutsideAvailabilityError,
  PastDateTimeError,
  PatientNotFoundError,
  ScheduleConflictError,
} from '../../shared/errors/AppError';

const DEFAULT_CANCELLATION_NOTICE_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

// Fuso fixo (em vez do fuso do processo) para que a checagem contra a grade
// (RN-08) dê o mesmo resultado independente de onde o servidor rode — em um
// deploy com o processo em UTC, um horário dentro do expediente de Brasília
// não pode ser recusado por ter sido comparado contra a hora UTC.
const TIMEZONE = 'America/Sao_Paulo';

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Extrai o dia da semana (0=domingo..6=sábado, mesma convenção de
// availability.day_of_week) e o horário (HH:MM), sempre no fuso de TIMEZONE.
function getZonedDayAndTime(date: Date): { dayOfWeek: number; timeOfDay: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === 'weekday')!.value;
  const hour = parts.find((part) => part.type === 'hour')!.value;
  const minute = parts.find((part) => part.type === 'minute')!.value;

  // hour12: false pode formatar meia-noite como "24" em vez de "00".
  const hh = hour === '24' ? '00' : hour;

  return { dayOfWeek: WEEKDAY_TO_INDEX[weekday], timeOfDay: `${hh}:${minute}` };
}

export class AppointmentsService {
  constructor(
    private readonly repository: AppointmentsRepository = new AppointmentsRepository(),
    private readonly availabilityRepository: AvailabilityRepository = new AvailabilityRepository(),
    private readonly patientsRepository: PatientsRepository = new PatientsRepository(),
    private readonly authRepository: AuthRepository = new AuthRepository(),
  ) {}

  // RF-08, fluxo 3.4: agenda uma consulta validando RN-07, RN-08 e RN-09.
  async create(tenantId: string, patientId: string, input: DateTimeInput) {
    const patient = await this.patientsRepository.findById(tenantId, patientId);
    if (!patient) {
      throw new PatientNotFoundError();
    }

    const dataHora = new Date(input.dataHora);
    await this.validateSlot(tenantId, dataHora);

    return this.repository.create(tenantId, patientId, dataHora);
  }

  async listByPatient(tenantId: string, patientId: string) {
    const patient = await this.patientsRepository.findById(tenantId, patientId);
    if (!patient) {
      throw new PatientNotFoundError();
    }
    return this.repository.listByPatient(tenantId, patientId);
  }

  // RF-11: cancelamento. RN-10 só se aplica quando o ator é o paciente.
  async cancel(tenantId: string, id: string, ator: Ator) {
    const appointment = await this.getConfirmedOrThrow(tenantId, id);

    if (ator === 'paciente') {
      const tenant = await this.authRepository.findById(tenantId);
      const minHoras = tenant?.cancelamento_antecedencia_horas ?? DEFAULT_CANCELLATION_NOTICE_HOURS;
      const horasAteConsulta = (appointment.data_hora.getTime() - Date.now()) / HOUR_MS;

      if (horasAteConsulta < minHoras) {
        throw new CancellationWindowError();
      }
    }

    return this.repository.updateStatus(tenantId, id, 'cancelado');
  }

  // RF-12: remarcação — mesmas validações RN-07/08/09 do agendamento original.
  async reschedule(tenantId: string, id: string, input: DateTimeInput) {
    await this.getConfirmedOrThrow(tenantId, id);

    const novaDataHora = new Date(input.dataHora);
    await this.validateSlot(tenantId, novaDataHora, id);

    return this.repository.reschedule(tenantId, id, novaDataHora);
  }

  private async getConfirmedOrThrow(tenantId: string, id: string) {
    const appointment = await this.repository.findById(tenantId, id);
    if (!appointment) {
      throw new AppointmentNotFoundError();
    }
    if (appointment.status !== 'confirmado') {
      throw new AppointmentAlreadyCancelledError();
    }
    return appointment;
  }

  private async validateSlot(tenantId: string, dataHora: Date, excludeId?: string): Promise<void> {
    // RN-07 / E-10
    if (dataHora.getTime() <= Date.now()) {
      throw new PastDateTimeError();
    }

    // RN-08 / E-11
    const { dayOfWeek, timeOfDay } = getZonedDayAndTime(dataHora);
    const slots = await this.availabilityRepository.listByDay(tenantId, dayOfWeek);
    const withinGrid = slots.some(
      (slot) => timeOfDay >= slot.start_time.slice(0, 5) && timeOfDay < slot.end_time.slice(0, 5),
    );
    if (!withinGrid) {
      throw new OutsideAvailabilityError();
    }

    // RN-09 / E-12
    const conflict = await this.repository.findConflict(tenantId, dataHora, excludeId);
    if (conflict) {
      throw new ScheduleConflictError();
    }
  }
}
