import {
  registerSchema,
  loginSchema,
  setPatientPasswordSchema,
} from '../../src/modules/auth/auth.validation';
import { ValidationError } from '../../src/shared/errors/AppError';

describe('auth.validation', () => {
  describe('registerSchema (RF-01)', () => {
    const BASE = {
      nome: 'Eridiane Kestring',
      email: 'eridiane@nutrihub.com',
      crn: 'CRN-10 12345',
      telefone: '(47) 99999-0000',
      senha: 'senhaSegura123',
    };

    function problemas(payload: unknown): Record<string, string> {
      try {
        registerSchema.parse(payload);
      } catch (erro) {
        expect(erro).toBeInstanceOf(ValidationError);
        return Object.fromEntries((erro as ValidationError).issues.map((i) => [i.path, i.message]));
      }
      throw new Error('deveria ter recusado');
    }

    it('aceita um payload válido e devolve os campos normalizados', () => {
      const result = registerSchema.parse({
        nome: '  Eridiane   Kestring  ',
        email: '  eridiane@nutrihub.com  ',
        crn: ' crn10 12345 ',
        telefone: '+55 47 999990000',
        senha: 'senhaSegura123',
      });

      expect(result).toEqual(BASE);
    });

    it('aponta cada campo vazio com a sua mensagem', () => {
      expect(problemas({})).toEqual({
        nome: 'Informe seu nome completo',
        email: 'Informe seu e-mail',
        crn: 'Informe seu CRN',
        telefone: 'Informe o celular com WhatsApp do consultório',
        senha: 'Senha deve ter entre 8 e 72 caracteres',
      });
    });

    it.each([
      ['só o primeiro nome', 'Eridiane', 'Informe nome e sobrenome'],
      ['número no nome', 'Eridiane K3string', 'Use apenas letras no nome'],
      ['nome curto demais', 'Ab', 'Nome deve ter entre 3 e 100 caracteres'],
    ])('nome: recusa %s', (_caso, nome, mensagem) => {
      expect(problemas({ ...BASE, nome }).nome).toBe(mensagem);
    });

    it("aceita nomes com acento, apóstrofo e hífen", () => {
      expect(registerSchema.parse({ ...BASE, nome: "Maria D'Ávila Sant-Anna" }).nome).toBe("Maria D'Ávila Sant-Anna");
    });

    it.each([
      ['sem @', 'eridiane.nutrihub.com', 'O e-mail precisa ter @, ex.: nome@clinica.com'],
      ['sem domínio', 'eridiane@nutrihub', 'E-mail inválido. Confira o endereço, ex.: nome@clinica.com'],
      ['com espaço', 'eri diane@nutrihub.com', 'E-mail inválido. Confira o endereço, ex.: nome@clinica.com'],
    ])('e-mail: recusa %s', (_caso, email, mensagem) => {
      expect(problemas({ ...BASE, email }).email).toBe(mensagem);
    });

    it.each([
      ['CRN-10 12345', 'CRN-10 12345'],
      ['crn-3 4567', 'CRN-3 4567'],
      ['CRN 1-890', 'CRN-1 890'],
      ['CRN-10/012345', 'CRN-10 12345'],
      ['CRN-3 4567/p', 'CRN-3 4567/P'],
      ['CRN-1 890 / S', 'CRN-1 890/S'],
    ])('CRN: normaliza %s → %s', (crn, esperado) => {
      expect(registerSchema.parse({ ...BASE, crn }).crn).toBe(esperado);
    });

    it.each([
      ['região inexistente', 'CRN-20 10458', 'Região do CRN inválida: os conselhos vão do CRN-1 ao CRN-11'],
      ['região zero', 'CRN-0 12345', 'Região do CRN inválida: os conselhos vão do CRN-1 ao CRN-11'],
      ['sem separador', 'CRN1012345', 'CRN inválido. Use região e número, ex.: CRN-10 12345'],
      ['sem o número', 'CRN-10', 'CRN inválido. Use região e número, ex.: CRN-10 12345'],
      ['texto qualquer', 'abc', 'CRN inválido. Use região e número, ex.: CRN-10 12345'],
      ['número zerado', 'CRN-10 0000', 'CRN inválido. Use região e número, ex.: CRN-10 12345'],
    ])('CRN: recusa %s', (_caso, crn, mensagem) => {
      expect(problemas({ ...BASE, crn }).crn).toBe(mensagem);
    });

    it.each([
      ['47999990000', '(47) 99999-0000'],
      ['(47) 9 9999-0000', '(47) 99999-0000'],
      ['+55 (11) 98765-4321', '(11) 98765-4321'],
    ])('celular: normaliza %s → %s', (telefone, esperado) => {
      expect(registerSchema.parse({ ...BASE, telefone }).telefone).toBe(esperado);
    });

    it.each([
      ['sem DDD', '99999-0000', 'Celular inválido. Informe DDD e os 9 dígitos, ex.: (47) 99999-0000'],
      ['fixo (8 dígitos)', '(47) 3333-4444', 'Celular inválido. Informe DDD e os 9 dígitos, ex.: (47) 99999-0000'],
      ['estrangeiro', '+1 415 555 2671', 'Celular inválido. Informe DDD e os 9 dígitos, ex.: (47) 99999-0000'],
      ['DDD inexistente', '(20) 99999-0000', 'DDD inválido. Confira os dois primeiros dígitos'],
      ['sem o 9', '(47) 89999-0000', 'Informe um celular: depois do DDD, o número começa com 9'],
    ])('celular: recusa %s', (_caso, telefone, mensagem) => {
      expect(problemas({ ...BASE, telefone }).telefone).toBe(mensagem);
    });

    it.each([
      ['curta', 'abc123', 'Senha deve ter entre 8 e 72 caracteres'],
      ['longa demais', `a1${'x'.repeat(71)}`, 'Senha deve ter entre 8 e 72 caracteres'],
      ['só letras', 'senhasegura', 'Use letras e números na senha'],
      ['só números', '12345678', 'Use letras e números na senha'],
    ])('senha: recusa %s', (_caso, senha, mensagem) => {
      expect(problemas({ ...BASE, senha }).senha).toBe(mensagem);
    });
  });

  describe('loginSchema (RF-02)', () => {
    it('aceita um payload válido', () => {
      const result = loginSchema.parse({ email: 'a@a.com', senha: 'qualquercoisa' });
      expect(result).toEqual({ email: 'a@a.com', senha: 'qualquercoisa' });
    });

    it('rejeita e-mail inválido', () => {
      expect(() => loginSchema.parse({ email: 'invalido', senha: 'x' })).toThrow(ValidationError);
    });

    it('rejeita senha ausente', () => {
      expect(() => loginSchema.parse({ email: 'a@a.com' })).toThrow(ValidationError);
    });
  });

  describe('setPatientPasswordSchema (RF-02)', () => {
    const tokenValido = 'a'.repeat(64);

    it('aceita token hexadecimal de 64 caracteres com senha válida', () => {
      const result = setPatientPasswordSchema.parse({ token: tokenValido, senha: 'senhaDoPaciente1' });
      expect(result).toEqual({ token: tokenValido, senha: 'senhaDoPaciente1' });
    });

    it.each([
      ['token ausente', { senha: 'senhaDoPaciente1' }],
      ['token curto demais', { token: 'abc123', senha: 'senhaDoPaciente1' }],
      ['token com caractere não-hex', { token: 'z'.repeat(64), senha: 'senhaDoPaciente1' }],
      ['senha com menos de 8 caracteres', { token: 'a'.repeat(64), senha: 'curta' }],
      ['senha acima do limite do bcrypt', { token: 'a'.repeat(64), senha: 'x'.repeat(73) }],
    ])('rejeita payload com %s', (_desc, payload) => {
      expect(() => setPatientPasswordSchema.parse(payload)).toThrow(ValidationError);
    });
  });
});