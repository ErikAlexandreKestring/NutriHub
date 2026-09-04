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

// Extrai o horário (HH:MM) no fuso do processo. Consistente porque a mesma
// conversão é usada tanto ao gravar quanto ao validar contra a grade (RN-08) —
// não fixamos America/Sao_Paulo explicitamente, o que fica documentado aqui
// como simplificação aceitável para o MVP.
function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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
    const dayOfWeek = dataHora.getDay();
    const timeOfDay = formatTime(dataHora);
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
