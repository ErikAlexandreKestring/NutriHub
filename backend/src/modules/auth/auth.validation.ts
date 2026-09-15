import { asRecord, asTrimmedString, isValidEmail, Validator } from '../../shared/validation/validator';

// RF-01: cadastro de nutricionista (nome, e-mail, CRN, senha)
export interface RegisterInput {
  nome: string;
  email: string;
  crn: string;
  senha: string;
}

export const registerSchema = {
  parse(body: unknown): RegisterInput {
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

    const crn = asTrimmedString(data.crn);
    if (crn.length < 3 || crn.length > 20) {
      validator.fail('crn', 'CRN inválido');
    }

    const senha = typeof data.senha === 'string' ? data.senha : '';
    if (senha.length < 8 || senha.length > 72) {
      validator.fail('senha', 'Senha deve ter ao menos 8 caracteres');
    }

    validator.throwIfInvalid();

    return { nome, email, crn, senha };
  },
};

// RF-02: login por e-mail e senha
export interface LoginInput {
  email: string;
  senha: string;
}

export const loginSchema = {
  parse(body: unknown): LoginInput {
    const data = asRecord(body);
    const validator = new Validator();

    const email = asTrimmedString(data.email);
    if (!isValidEmail(email)) {
      validator.fail('email', 'E-mail inválido');
    }

    const senha = typeof data.senha === 'string' ? data.senha : '';
    if (senha.length < 1) {
      validator.fail('senha', 'Senha é obrigatória');
    }

    validator.throwIfInvalid();

    return { email, senha };
  },
};

// RF-02: primeiro acesso do paciente — troca do token de acesso pela senha.
export interface SetPatientPasswordInput {
  token: string;
  senha: string;
}

export const setPatientPasswordSchema = {
  parse(body: unknown): SetPatientPasswordInput {
    const data = asRecord(body);
    const validator = new Validator();

    // 32 bytes em hex (ver shared/utils/accessToken).
    const token = asTrimmedString(data.token);
    if (!/^[0-9a-f]{64}$/.test(token)) {
      validator.fail('token', 'Token de acesso inválido');
    }

    // Mesma política do cadastro do nutricionista; 72 é o limite do bcrypt.
    const senha = typeof data.senha === 'string' ? data.senha : '';
    if (senha.length < 8 || senha.length > 72) {
      validator.fail('senha', 'Senha deve ter ao menos 8 caracteres');
    }

    validator.throwIfInvalid();

    return { token, senha };
  },
};
