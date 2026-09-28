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

// RF-08, fluxo 3.4 passo 2: período (datas de calendário em America/Sao_Paulo)
// em que o paciente procura horários livres.
export interface FreeSlotsQuery {
  de: string;
  ate: string;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// Teto do período consultado: cada dia vira uma varredura da grade, e ninguém
// escolhe consulta olhando mais de um mês adiante.
export const MAX_FREE_SLOTS_RANGE_DAYS = 31;

function isCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  // Date.parse aceita "2026-02-31" e rola para março; a volta ao texto pega isso.
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const freeSlotsQuerySchema = {
  parse(query: unknown): FreeSlotsQuery {
    const data = asRecord(query);
    const validator = new Validator();

    const de = asTrimmedString(data.de);
    const ate = asTrimmedString(data.ate);

    if (!isCalendarDate(de)) {
      validator.fail('de', 'Data inicial inválida, use o formato AAAA-MM-DD');
    }
    if (!isCalendarDate(ate)) {
      validator.fail('ate', 'Data final inválida, use o formato AAAA-MM-DD');
    }
    if (isCalendarDate(de) && isCalendarDate(ate)) {
      const days = (Date.parse(ate) - Date.parse(de)) / DAY_MS;
      if (days < 0) {
        validator.fail('ate', 'Data final deve ser igual ou posterior à data inicial');
      } else if (days >= MAX_FREE_SLOTS_RANGE_DAYS) {
        validator.fail('ate', `O período consultado pode ter no máximo ${MAX_FREE_SLOTS_RANGE_DAYS} dias`);
      }
    }

    validator.throwIfInvalid();

    return { de, ate };
  },
};
