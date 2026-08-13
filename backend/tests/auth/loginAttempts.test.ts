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
