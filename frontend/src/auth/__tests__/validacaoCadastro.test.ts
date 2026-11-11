import { describe, expect, it } from 'vitest';
import { mascararCelular, normalizarCrn, validarCelular, validarCrn, validarEmail } from '../validacaoCadastro';

// As mesmas tabelas de casos do backend (tests/auth/auth.validation.test.ts):
// se uma regra mudar de um lado só, um dos dois testes acusa.
describe('validação do cadastro (RF-01)', () => {
  it.each([
    ['(47) 99999-0000', '(47) 99999-0000'],
    ['47999990000', '(47) 99999-0000'],
    ['+55 47 99999-0000', '(47) 99999-0000'],
    ['47', '(47'],
    ['479999900001234', '(47) 99999-0000'],
  ])('máscara do celular: %s → %s', (entrada, esperado) => {
    expect(mascararCelular(entrada)).toBe(esperado);
  });

  it.each([
    ['CRN-10 12345', 'CRN-10 12345'],
    ['crn-3 4567', 'CRN-3 4567'],
    ['CRN 1-890', 'CRN-1 890'],
    ['CRN-10/012345', 'CRN-10 12345'],
    ['CRN-3 4567/p', 'CRN-3 4567/P'],
  ])('normaliza o CRN %s → %s', (entrada, esperado) => {
    expect(normalizarCrn(entrada)).toBe(esperado);
  });

  it.each(['CRN-20 10458', 'CRN-0 1', 'CRN1012345', 'CRN-10', 'CRN-10 0000', 'abc'])('recusa o CRN %s', (crn) => {
    expect(validarCrn(crn)).toBeDefined();
  });

  it.each(['(10) 99999-0000', '(47) 89999-0000', '(47) 3333-4444', '99999-0000'])('recusa o celular %s', (celular) => {
    expect(validarCelular(celular)).toBeDefined();
  });

  it.each([
    'ana@clinica',
    'ana clinica@x.com',
    'ana.clinica.com',
    'ana@clinica..com',
    'ana@.clinica.com',
    'ana@clinica.com.',
  ])('recusa o e-mail %s', (email) => {
    expect(validarEmail(email)).toBeDefined();
  });

  it.each(['ana@clinica.com', 'ana.souza@clinica.com.br'])('aceita o e-mail %s', (email) => {
    expect(validarEmail(email)).toBeUndefined();
  });

  it('responde rápido a um e-mail enorme e malicioso (ReDoS)', () => {
    const inicio = performance.now();
    expect(validarEmail('a@' + 'a.'.repeat(50_000) + '@')).toBeDefined();
    expect(performance.now() - inicio).toBeLessThan(100);
  });
});
