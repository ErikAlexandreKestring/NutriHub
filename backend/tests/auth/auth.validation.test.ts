import {
  registerSchema,
  loginSchema,
  setPatientPasswordSchema,
} from '../../src/modules/auth/auth.validation';
import { ValidationError } from '../../src/shared/errors/AppError';

describe('auth.validation', () => {
  describe('registerSchema (RF-01)', () => {
    it('aceita um payload válido e retorna os campos normalizados', () => {
      const result = registerSchema.parse({
        nome: '  Eridiane Kestring  ',
        email: '  Eridiane@Nutrihub.com  ',
        crn: 'CRN-12345',
        senha: 'senhaSegura123',
      });

      expect(result).toEqual({
        nome: 'Eridiane Kestring',
        email: 'Eridiane@Nutrihub.com',
        crn: 'CRN-12345',
        senha: 'senhaSegura123',
      });
    });

    it.each([
      ['nome muito curto', { nome: 'ab', email: 'a@a.com', crn: 'CRN-1', senha: '12345678' }],
      ['e-mail inválido', { nome: 'Eridiane', email: 'nao-e-email', crn: 'CRN-1', senha: '12345678' }],
      ['senha curta', { nome: 'Eridiane', email: 'a@a.com', crn: 'CRN-1', senha: '123' }],
      ['crn muito curto', { nome: 'Eridiane', email: 'a@a.com', crn: 'ab', senha: '12345678' }],
      ['payload vazio', {}],
    ])('rejeita payload com %s', (_desc, payload) => {
      expect(() => registerSchema.parse(payload)).toThrow(ValidationError);
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