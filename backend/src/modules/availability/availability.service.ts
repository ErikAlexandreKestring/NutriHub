import { AvailabilityRepository } from './availability.repository';
import { CreateAvailabilityInput } from './availability.validation';
import { AvailabilityNotFoundError, ValidationError } from '../../shared/errors/AppError';

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/** "08:00:00" (coluna time do Postgres) → "08:00". */
function hhmm(horario: string): string {
  return horario.slice(0, 5);
}

export class AvailabilityService {
  constructor(private readonly repository: AvailabilityRepository = new AvailabilityRepository()) {}

  /**
   * RF-08: dois intervalos sobrepostos no mesmo dia deixariam a grade ambígua
   * (qual vale?) e duplicariam os horários que o paciente vê ao agendar. O
   * erro vai no campo "Início", com o intervalo que já ocupa o horário.
   */
  async create(tenantId: string, input: CreateAvailabilityInput) {
    const resultado = await this.repository.create(tenantId, input);
    if (resultado.conflito) {
      const { start_time, end_time } = resultado.conflito;
      throw new ValidationError([
        {
          path: 'start_time',
          message: `Este horário se sobrepõe ao intervalo ${hhmm(start_time)}–${hhmm(end_time)} de ${DIAS[input.dayOfWeek]}, já cadastrado.`,
        },
      ]);
    }
    return resultado.criado;
  }

  async list(tenantId: string) {
    return this.repository.list(tenantId);
  }

  async delete(tenantId: string, id: string) {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new AvailabilityNotFoundError();
    }
    await this.repository.delete(tenantId, id);
  }
}
