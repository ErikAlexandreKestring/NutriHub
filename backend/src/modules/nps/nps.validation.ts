import { asRecord, asTrimmedString, Validator } from '../../shared/validation/validator';

const MAX_COMENTARIO = 1000;

// UC-07: "avalia de 0 a 10 e opcionalmente deixa comentário".
export interface ResponderNpsInput {
  nota: number;
  comentario?: string;
}

export const responderNpsSchema = {
  parse(body: unknown): ResponderNpsInput {
    const data = asRecord(body);
    const validator = new Validator();

    const nota = data.nota;
    if (typeof nota !== 'number' || !Number.isInteger(nota) || nota < 0 || nota > 10) {
      validator.fail('nota', 'Escolha uma nota de 0 a 10');
    }

    const comentario = asTrimmedString(data.comentario);
    if (comentario.length > MAX_COMENTARIO) {
      validator.fail('comentario', `O comentário deve ter no máximo ${MAX_COMENTARIO} caracteres`);
    }

    validator.throwIfInvalid();

    return { nota: nota as number, comentario: comentario.length > 0 ? comentario : undefined };
  },
};
