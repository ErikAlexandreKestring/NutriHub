import { signToken, verifyToken } from '../../src/shared/utils/jwt';

describe('jwt utils (RF-02)', () => {
  it('assina e verifica um token de nutricionista com os campos esperados', () => {
    const token = signToken({ user_id: 'u1', tenant_id: 't1', role: 'nutricionista' });
    const payload = verifyToken(token);

    expect(payload.user_id).toBe('u1');
    expect(payload.tenant_id).toBe('t1');
    expect(payload.role).toBe('nutricionista');
  });

  it('assina um token de paciente', () => {
    const token = signToken({ user_id: 'u2', tenant_id: 't1', role: 'paciente' });
    const payload = verifyToken(token);

    expect(payload.role).toBe('paciente');
  });

  it('lança erro ao verificar um token inválido', () => {
    expect(() => verifyToken('token-invalido')).toThrow();
  });
});
