import { asRecord, asTrimmedString, isValidEmail, Validator } from '../../shared/validation/validator';
import { normalizarCelular, ProblemaDoCelular } from '../../shared/utils/phone';
import { normalizarCrn, ProblemaDoCrn, REGIOES_DO_CRN } from '../../shared/utils/crn';

// RF-01: cadastro de nutricionista (nome, e-mail, CRN, celular, senha). O
// celular é o WhatsApp do consultório: o paciente fala com o nutricionista por
// um link direto (wa.me) a partir da PWA (RF-07).
export interface RegisterInput {
  nome: string;
  email: string;
  crn: string;
  telefone: string;
  senha: string;
}

// Nome e sobrenome, só letras (com acento), espaço, apóstrofo, hífen e ponto.
const NOME = /^\p{L}[\p{L}'. -]*$/u;

const MENSAGEM_DO_CRN: Record<ProblemaDoCrn, string> = {
  formato: 'CRN inválido. Use região e número, ex.: CRN-10 12345',
  regiao: `Região do CRN inválida: os conselhos vão do CRN-1 ao CRN-${REGIOES_DO_CRN}`,
};

const MENSAGEM_DO_CELULAR: Record<ProblemaDoCelular, string> = {
  incompleto: 'Celular inválido. Informe DDD e os 9 dígitos, ex.: (47) 99999-0000',
  ddd: 'DDD inválido. Confira os dois primeiros dígitos',
  'nao-celular': 'Informe um celular: depois do DDD, o número começa com 9',
};

export const registerSchema = {
  parse(body: unknown): RegisterInput {
    const data = asRecord(body);
    const validator = new Validator();

    const nome = asTrimmedString(data.nome).replace(/\s+/g, ' ');
    if (!nome) {
      validator.fail('nome', 'Informe seu nome completo');
    } else if (nome.length < 3 || nome.length > 100) {
      validator.fail('nome', 'Nome deve ter entre 3 e 100 caracteres');
    } else if (!NOME.test(nome)) {
      validator.fail('nome', 'Use apenas letras no nome');
    } else if (nome.split(' ').length < 2) {
      validator.fail('nome', 'Informe nome e sobrenome');
    }

    const email = asTrimmedString(data.email);
    if (!email) {
      validator.fail('email', 'Informe seu e-mail');
    } else if (!email.includes('@')) {
      validator.fail('email', 'O e-mail precisa ter @, ex.: nome@clinica.com');
    } else if (!isValidEmail(email) || email.length > 255) {
      validator.fail('email', 'E-mail inválido. Confira o endereço, ex.: nome@clinica.com');
    }

    let crn = asTrimmedString(data.crn);
    if (!crn) {
      validator.fail('crn', 'Informe seu CRN');
    } else {
      const resultado = normalizarCrn(crn);
      if ('problema' in resultado) validator.fail('crn', MENSAGEM_DO_CRN[resultado.problema]);
      else crn = resultado.crn;
    }

    // RF-07: é o destino do botão de WhatsApp do paciente. Recusar aqui um
    // número que não existe evita descobrir o erro só quando o paciente tocar
    // no botão e cair numa conversa com ninguém.
    let telefone = asTrimmedString(data.telefone);
    if (!telefone) {
      validator.fail('telefone', 'Informe o celular com WhatsApp do consultório');
    } else {
      const resultado = normalizarCelular(telefone);
      if ('problema' in resultado) validator.fail('telefone', MENSAGEM_DO_CELULAR[resultado.problema]);
      else telefone = resultado.celular;
    }

    // 72 é o limite do bcrypt. Letras e números: é a conta que abre os dados
    // de saúde de todos os pacientes do consultório (RNF-03).
    const senha = typeof data.senha === 'string' ? data.senha : '';
    if (senha.length < 8 || senha.length > 72) {
      validator.fail('senha', 'Senha deve ter entre 8 e 72 caracteres');
    } else if (!/\p{L}/u.test(senha) || !/\d/.test(senha)) {
      validator.fail('senha', 'Use letras e números na senha');
    }

    validator.throwIfInvalid();

    return { nome, email, crn, telefone, senha };
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
