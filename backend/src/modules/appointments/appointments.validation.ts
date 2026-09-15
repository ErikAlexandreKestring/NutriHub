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

/**
 * RN-10 (antecedência mínima) só vale quando quem cancela é o paciente.
 *
 * O ator vem do `role` do JWT, NUNCA do corpo da requisição: enquanto não havia
 * login de paciente, o ator era enviado no body — o que permitia a qualquer
 * cliente mandar `ator: 'nutricionista'` e pular a RN-10 inteira.
 */
export type Ator = 'paciente' | 'nutricionista';
