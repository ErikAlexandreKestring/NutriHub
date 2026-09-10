import { asRecord, asTrimmedString, Validator } from '../../shared/validation/validator';

// RF-08: cadastro de um intervalo de disponibilidade (dia da semana + horário).
export interface CreateAvailabilityInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createAvailabilitySchema = {
  parse(body: unknown): CreateAvailabilityInput {
    const data = asRecord(body);
    const validator = new Validator();

    const dayOfWeek = typeof data.day_of_week === 'number' ? data.day_of_week : Number(data.day_of_week);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      validator.fail('day_of_week', 'Dia da semana deve ser um número entre 0 (domingo) e 6 (sábado)');
    }

    const startTime = asTrimmedString(data.start_time);
    const endTime = asTrimmedString(data.end_time);

    if (!TIME_REGEX.test(startTime)) {
      validator.fail('start_time', 'Horário inicial inválido, use o formato HH:MM');
    }
    if (!TIME_REGEX.test(endTime)) {
      validator.fail('end_time', 'Horário final inválido, use o formato HH:MM');
    }
    if (TIME_REGEX.test(startTime) && TIME_REGEX.test(endTime) && startTime >= endTime) {
      validator.fail('end_time', 'Horário final deve ser depois do horário inicial');
    }

    validator.throwIfInvalid();

    return { dayOfWeek, startTime, endTime };
  },
};
