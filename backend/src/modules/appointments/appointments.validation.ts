import { asRecord, asTrimmedString, isValidDate, Validator } from '../../shared/validation/validator';

// RF-08/RF-11/RF-12: criação e remarcação usam o mesmo formato de entrada.
export interface DateTimeInput {
  dataHora: string;
}

export const dateTimeSchema = {
  parse(body: unknown): DateTimeInput {
    const data = asRecord(body);
    const validator = new Validator();

    const dataHora = asTrimmedString(data.data_hora);
    if (!isValidDate(dataHora)) {
      validator.fail('data_hora', 'Data/hora inválida, use um formato ISO (ex: 2026-09-01T10:00:00)');
    }

    validator.throwIfInvalid();

    return { dataHora };
  },
};

export type Ator = 'paciente' | 'nutricionista';

export interface CancelAppointmentInput {
  ator: Ator;
}

// RN-10: só se aplica quando o ator é o paciente. Como ainda não existe login
// de paciente, o ator é informado explicitamente no corpo da requisição
// (default 'nutricionista', que pode cancelar a qualquer momento).
export const cancelAppointmentSchema = {
  parse(body: unknown): CancelAppointmentInput {
    const data = asRecord(body);
    const validator = new Validator();

    let ator: Ator = 'nutricionista';
    if (data.ator !== undefined) {
      const atorRaw = asTrimmedString(data.ator);
      if (atorRaw !== 'paciente' && atorRaw !== 'nutricionista') {
        validator.fail('ator', "ator deve ser 'paciente' ou 'nutricionista'");
      } else {
        ator = atorRaw;
      }
    }

    validator.throwIfInvalid();

    return { ator };
  },
};
