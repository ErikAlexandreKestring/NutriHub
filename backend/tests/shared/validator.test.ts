import { isValidEmail } from '../../src/shared/validation/validator';

describe('isValidEmail', () => {
  it.each(['ana@clinica.com', 'ana.souza@clinica.com.br', 'nutri+teste@sub.dominio.org'])('aceita %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    'ana@clinica',
    'ana clinica@x.com',
    'ana.clinica.com',
    'ana@clinica..com',
    'ana@.clinica.com',
    'ana@clinica.com.',
    '@clinica.com',
  ])('recusa %s', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  // ReDoS: com a regex antiga, um domínio longo cheio de pontos sem final válido
  // fazia a checagem crescer de forma quadrática.
  it('responde rápido a um texto enorme e malicioso', () => {
    const malicioso = 'a@' + 'a.'.repeat(50_000) + '@';

    const inicio = performance.now();
    expect(isValidEmail(malicioso)).toBe(false);
    expect(performance.now() - inicio).toBeLessThan(100);
  });
});
