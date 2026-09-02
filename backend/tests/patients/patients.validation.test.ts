import { createPatientSchema, updatePatientSchema } from '../../src/modules/patients/patients.validation';
import { ValidationError } from '../../src/shared/errors/AppError';

describe('patients.validation', () => {
  describe('createPatientSchema (RF-03)', () => {
    it('aceita um payload válido e normaliza os campos', () => {
      const result = createPatientSchema.parse({
        nome: '  João Silva  ',
        email: '  joao@nutrihub.com  ',
        data_nascimento: '1990-05-20',
        contato: '  11999998888  ',
        historico: '  Sem restrições  ',
      });

      expect(result).toEqual({
        nome: 'João Silva',
        email: 'joao@nutrihub.com',
        dataNascimento: '1990-05-20',
        contato: '11999998888',
        historico: 'Sem restrições',
      });
    });

    it('aceita payload sem contato/histórico (opcionais)', () => {
      const result = createPatientSchema.parse({
        nome: 'João Silva',
        email: 'joao@nutrihub.com',
        data_nascimento: '1990-05-20',
      });

      expect(result.contato).toBeUndefined();
      expect(result.historico).toBeUndefined();
    });

    it.each([
      ['nome muito curto', { nome: 'ab', email: 'a@a.com', data_nascimento: '1990-01-01' }],
      ['e-mail inválido', { nome: 'João Silva', email: 'nao-e-email', data_nascimento: '1990-01-01' }],
      ['data de nascimento inválida', { nome: 'João Silva', email: 'a@a.com', data_nascimento: 'abc' }],
      ['data de nascimento no futuro', { nome: 'João Silva', email: 'a@a.com', data_nascimento: '2999-01-01' }],
      ['payload vazio', {}],
    ])('rejeita payload com %s', (_desc, payload) => {
      expect(() => createPatientSchema.parse(payload)).toThrow(ValidationError);
    });
  });

  describe('updatePatientSchema (RF-03)', () => {
    it('aceita atualização parcial de um único campo', () => {
      const result = updatePatientSchema.parse({ contato: '11988887777' });
      expect(result).toEqual({ contato: '11988887777' });
    });

    it('permite limpar contato/histórico enviando null', () => {
      const result = updatePatientSchema.parse({ contato: null, historico: null });
      expect(result).toEqual({ contato: null, historico: null });
    });

    it('rejeita payload vazio (nenhum campo enviado)', () => {
      expect(() => updatePatientSchema.parse({})).toThrow(ValidationError);
    });

    it('rejeita e-mail inválido em atualização', () => {
      expect(() => updatePatientSchema.parse({ email: 'invalido' })).toThrow(ValidationError);
    });
  });
});
