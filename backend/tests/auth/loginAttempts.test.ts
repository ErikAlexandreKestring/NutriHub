import {
  isLocked,
  registerFailedAttempt,
  clearAttempts,
  __resetAllAttempts,
} from '../../src/modules/auth/loginAttempts';

describe('loginAttempts (E-04)', () => {
  beforeEach(() => {
    __resetAllAttempts();
  });

  it('não bloqueia um e-mail sem tentativas registradas', () => {
    expect(isLocked('novo@nutrihub.com')).toBe(false);
  });

  it('bloqueia após 5 tentativas falhas', () => {
    for (let i = 0; i < 4; i += 1) {
      registerFailedAttempt('alvo@nutrihub.com');
      expect(isLocked('alvo@nutrihub.com')).toBe(false);
    }
    registerFailedAttempt('alvo@nutrihub.com');
    expect(isLocked('alvo@nutrihub.com')).toBe(true);
  });

  it('limpa o contador ao chamar clearAttempts', () => {
    for (let i = 0; i < 5; i += 1) registerFailedAttempt('alvo@nutrihub.com');
    expect(isLocked('alvo@nutrihub.com')).toBe(true);

    clearAttempts('alvo@nutrihub.com');
    expect(isLocked('alvo@nutrihub.com')).toBe(false);
  });

  it('não deixa uma origem trancar o e-mail para as outras', () => {
    // Antes o balde era só do e-mail: errar a senha 5 vezes trancava o dono.
    for (let i = 0; i < 5; i += 1) registerFailedAttempt('alvo@nutrihub.com', '203.0.113.9');

    expect(isLocked('alvo@nutrihub.com', '203.0.113.9')).toBe(true);
    expect(isLocked('alvo@nutrihub.com', '198.51.100.4')).toBe(false);
  });

  it('mantém um teto por e-mail contra força bruta distribuída', () => {
    // Um IP por tentativa: nenhum balde de origem chega ao limite, então quem
    // segura é o contador por e-mail.
    for (let i = 0; i < 49; i += 1) {
      registerFailedAttempt('alvo@nutrihub.com', `203.0.113.${i}`);
      expect(isLocked('alvo@nutrihub.com', '198.51.100.4')).toBe(false);
    }

    registerFailedAttempt('alvo@nutrihub.com', '203.0.113.49');
    expect(isLocked('alvo@nutrihub.com', '198.51.100.4')).toBe(true);
  });

  it('libera o e-mail automaticamente após os 15 minutos de bloqueio expirarem', () => {
    jest.useFakeTimers();
    try {
      for (let i = 0; i < 5; i += 1) registerFailedAttempt('expira@nutrihub.com');
      expect(isLocked('expira@nutrihub.com')).toBe(true);

      jest.advanceTimersByTime(15 * 60 * 1000 + 1);

      expect(isLocked('expira@nutrihub.com')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
