import { AppointmentsRepository } from './appointments.repository';
import { AvailabilityRepository } from '../availability/availability.repository';
import { PatientsRepository } from '../patients/patients.repository';
import { AuthRepository } from '../auth/auth.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { Ator, DateTimeInput, FreeSlotsQuery } from './appointments.validation';
import {
  addDays,
  dayOfWeekOf,
  getZonedDate,
  getZonedDayAndTime,
  zonedDateTimeToUtc,
} from '../../shared/utils/timezone';
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

// Duração de uma consulta na oferta de horários (fluxo 3.4, passo 2). A grade
// guarda só intervalos de atendimento; é daqui que saem os horários
// selecionáveis dentro de cada intervalo.
export const SLOT_MINUTES = 60;
const SLOT_MS = SLOT_MINUTES * 60 * 1000;

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export class AppointmentsService {
  constructor(
    private readonly repository: AppointmentsRepository = new AppointmentsRepository(),
    private readonly availabilityRepository: AvailabilityRepository = new AvailabilityRepository(),
    private readonly patientsRepository: PatientsRepository = new PatientsRepository(),
    private readonly authRepository: AuthRepository = new AuthRepository(),
    private readonly notifications: NotificationsService = new NotificationsService(),
  ) {}

  // RF-08, fluxo 3.4: agenda uma consulta validando RN-07, RN-08 e RN-09 e
  // avisa as duas partes (passo 8).
  async create(tenantId: string, patientId: string, input: DateTimeInput) {
    const patient = await this.patientsRepository.findById(tenantId, patientId);
    if (!patient) {
      throw new PatientNotFoundError();
    }

    const dataHora = new Date(input.dataHora);
    await this.validateSlot(tenantId, dataHora);

    const appointment = await this.repository.create(tenantId, patientId, dataHora);
    await this.notifications.consultaAgendada(tenantId, appointment);
    return appointment;
  }

  async listByPatient(tenantId: string, patientId: string) {
    const patient = await this.patientsRepository.findById(tenantId, patientId);
    if (!patient) {
      throw new PatientNotFoundError();
    }
    return this.repository.listByPatient(tenantId, patientId);
  }

  // RF-08/RF-10: consultas confirmadas do consultório a partir do início de
  // hoje — a consulta das 10h ainda aparece às 10h20, enquanto está acontecendo.
  async listUpcoming(tenantId: string) {
    const startOfToday = zonedDateTimeToUtc(getZonedDate(new Date()), '00:00');
    return this.repository.listConfirmedFrom(tenantId, startOfToday);
  }

  /**
   * RF-08, fluxo 3.4 passo 2 (e 3.6, passo 3B): horários que o paciente pode
   * escolher entre `de` e `ate`. Cada intervalo da grade é fatiado em consultas
   * de SLOT_MINUTES; somem os horários passados (RN-07) e os que colidem com
   * uma consulta confirmada (RN-09). O horário atual de uma consulta sendo
   * remarcada sai pelo mesmo motivo — ela ainda está confirmada.
   *
   * É uma oferta, não a validação: `create`/`reschedule` continuam checando
   * tudo de novo, porque entre a listagem e a confirmação outro paciente pode
   * ter ficado com o horário.
   */
  async listFreeSlots(tenantId: string, query: FreeSlotsQuery): Promise<Array<{ data_hora: string }>> {
    const grid = await this.availabilityRepository.list(tenantId);
    const from = zonedDateTimeToUtc(query.de, '00:00');
    const to = zonedDateTimeToUtc(addDays(query.ate, 1), '00:00');
    const booked = await this.repository.listConfirmedTimesBetween(tenantId, from, to);

    const now = Date.now();
    // Map por instante: dois intervalos sobrepostos na grade gerariam o mesmo
    // horário duas vezes.
    const slots = new Map<number, Date>();

    for (let day = query.de; day <= query.ate; day = addDays(day, 1)) {
      const dayOfWeek = dayOfWeekOf(day);

      for (const interval of grid.filter((slot) => slot.day_of_week === dayOfWeek)) {
        const end = toMinutes(interval.end_time);

        for (let start = toMinutes(interval.start_time); start + SLOT_MINUTES <= end; start += SLOT_MINUTES) {
          const slot = zonedDateTimeToUtc(day, toTime(start));
          const taken = booked.some((time) => Math.abs(time.getTime() - slot.getTime()) < SLOT_MS);
          if (slot.getTime() > now && !taken) {
            slots.set(slot.getTime(), slot);
          }
        }
      }
    }

    return [...slots.values()]
      .sort((a, b) => a.getTime() - b.getTime())
      .map((slot) => ({ data_hora: slot.toISOString() }));
  }

  // RF-11: cancelamento. RN-10 só se aplica quando o ator é o paciente. A outra
  // parte é avisada.
  // `restrictToPatientId` vem preenchido quando quem chama é o próprio paciente,
  // para que ele não alcance a consulta de outro paciente do mesmo tenant.
  async cancel(tenantId: string, id: string, ator: Ator, restrictToPatientId?: string) {
    const appointment = await this.getConfirmedOrThrow(tenantId, id, restrictToPatientId);

    await this.assertNoticePeriod(tenantId, ator, appointment.data_hora);

    const cancelled = await this.repository.updateStatus(tenantId, id, 'cancelado');
    await this.notifications.consultaCancelada(tenantId, cancelled, ator);
    return cancelled;
  }

  // RF-12: remarcação — mesmas validações RN-07/08/09 do agendamento original,
  // mais a RN-10. Para o nutricionista, remarcar é uma consulta que muda de
  // horário; para o paciente, o horário original é liberado exatamente como num
  // cancelamento, então a antecedência mínima tem de valer aqui também — sem
  // isso bastava remarcar a consulta em vez de cancelá-la para furar a RN-10.
  async reschedule(
    tenantId: string,
    id: string,
    input: DateTimeInput,
    ator: Ator,
    restrictToPatientId?: string,
  ) {
    const appointment = await this.getConfirmedOrThrow(tenantId, id, restrictToPatientId);

    // A antecedência é medida contra o horário ATUAL da consulta: é ele que está
    // sendo desmarcado. O horário novo responde pela RN-07/08/09 em validateSlot.
    await this.assertNoticePeriod(tenantId, ator, appointment.data_hora);

    const novaDataHora = new Date(input.dataHora);
    await this.validateSlot(tenantId, novaDataHora, id);

    const rescheduled = await this.repository.reschedule(tenantId, id, novaDataHora);
    await this.notifications.consultaRemarcada(tenantId, rescheduled, appointment.data_hora);
    return rescheduled;
  }

  // RN-10 / E-19: antecedência mínima configurável pelo nutricionista, exigida
  // só do paciente — o nutricionista opera a própria agenda a qualquer momento.
  private async assertNoticePeriod(tenantId: string, ator: Ator, dataHora: Date): Promise<void> {
    if (ator !== 'paciente') return;

    const tenant = await this.authRepository.findById(tenantId);
    const minHoras = tenant?.cancelamento_antecedencia_horas ?? DEFAULT_CANCELLATION_NOTICE_HOURS;
    const horasAteConsulta = (dataHora.getTime() - Date.now()) / HOUR_MS;

    if (horasAteConsulta < minHoras) {
      throw new CancellationWindowError();
    }
  }

  private async getConfirmedOrThrow(tenantId: string, id: string, restrictToPatientId?: string) {
    const appointment = await this.repository.findById(tenantId, id);
    if (!appointment) {
      throw new AppointmentNotFoundError();
    }
    // 404 em vez de 403: para o paciente, a consulta de outro paciente não deve
    // sequer ter a existência confirmada.
    if (restrictToPatientId && appointment.patient_id !== restrictToPatientId) {
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
