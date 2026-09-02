import { asRecord, asTrimmedString, isValidEmail, isValidDate, Validator } from '../../shared/validation/validator';

// RF-03: cadastro de pacientes (nome, e-mail, data de nascimento, contato, histórico).
export interface CreatePatientInput {
  nome: string;
  email: string;
  dataNascimento: string;
  contato?: string;
  historico?: string;
}

export const createPatientSchema = {
  parse(body: unknown): CreatePatientInput {
    const data = asRecord(body);
    const validator = new Validator();

    const nome = asTrimmedString(data.nome);
    if (nome.length < 3 || nome.length > 100) {
      validator.fail('nome', 'Nome deve ter entre 3 e 100 caracteres');
    }

    const email = asTrimmedString(data.email);
    if (!isValidEmail(email) || email.length > 255) {
      validator.fail('email', 'E-mail inválido');
    }

    const dataNascimento = asTrimmedString(data.data_nascimento);
    if (!isValidDate(dataNascimento)) {
      validator.fail('data_nascimento', 'Data de nascimento inválida');
    } else if (new Date(dataNascimento).getTime() > Date.now()) {
      validator.fail('data_nascimento', 'Data de nascimento não pode ser no futuro');
    }

    const contatoRaw = asTrimmedString(data.contato);
    if (contatoRaw.length > 20) {
      validator.fail('contato', 'Contato deve ter no máximo 20 caracteres');
    }

    const historicoRaw = typeof data.historico === 'string' ? data.historico.trim() : '';

    validator.throwIfInvalid();

    return {
      nome,
      email,
      dataNascimento,
      contato: contatoRaw.length > 0 ? contatoRaw : undefined,
      historico: historicoRaw.length > 0 ? historicoRaw : undefined,
    };
  },
};

export interface UpdatePatientInput {
  nome?: string;
  email?: string;
  dataNascimento?: string;
  contato?: string | null;
  historico?: string | null;
}

export const updatePatientSchema = {
  parse(body: unknown): UpdatePatientInput {
    const data = asRecord(body);
    const validator = new Validator();
    const result: UpdatePatientInput = {};

    if (data.nome !== undefined) {
      const nome = asTrimmedString(data.nome);
      if (nome.length < 3 || nome.length > 100) {
        validator.fail('nome', 'Nome deve ter entre 3 e 100 caracteres');
      }
      result.nome = nome;
    }

    if (data.email !== undefined) {
      const email = asTrimmedString(data.email);
      if (!isValidEmail(email) || email.length > 255) {
        validator.fail('email', 'E-mail inválido');
      }
      result.email = email;
    }

    if (data.data_nascimento !== undefined) {
      const dataNascimento = asTrimmedString(data.data_nascimento);
      if (!isValidDate(dataNascimento)) {
        validator.fail('data_nascimento', 'Data de nascimento inválida');
      }
      result.dataNascimento = dataNascimento;
    }

    if (data.contato !== undefined) {
      result.contato = data.contato === null ? null : asTrimmedString(data.contato);
    }

    if (data.historico !== undefined) {
      result.historico = data.historico === null ? null : String(data.historico).trim();
    }

    if (Object.keys(result).length === 0) {
      validator.fail('body', 'Envie ao menos um campo para atualizar');
    }

    validator.throwIfInvalid();

    return result;
  },
};
