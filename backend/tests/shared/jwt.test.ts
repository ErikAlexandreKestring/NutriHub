import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';
import { JwtPayload, signToken, verifyToken } from '../../src/shared/utils/jwt';

const payload: JwtPayload = {
  user_id: '11111111-1111-4111-8111-111111111111',
  tenant_id: '11111111-1111-4111-8111-111111111111',
  role: 'nutricionista',
};

describe('JWT (RF-02)', () => {
  const segredoOriginal = env.jwt.secret;

  afterEach(() => {
    env.jwt.secret = segredoOriginal;
  });

  it('verifica o token que assinou', () => {
    expect(verifyToken(signToken(payload))).toMatchObject(payload);
  });

  it('assina com HS256', () => {
    const cabecalho = jwt.decode(signToken(payload), { complete: true })?.header;
    expect(cabecalho?.alg).toBe('HS256');
  });

  it('aceita token HS256 assinado com o segredo em texto, como os emitidos antes da troca', () => {
    const token = jwt.sign(payload, env.jwt.secret, { algorithm: 'HS256', expiresIn: '1h' });
    expect(verifyToken(token)).toMatchObject(payload);
  });

  it('recusa token assinado com outro algoritmo, mesmo com o segredo certo', () => {
    const token = jwt.sign(payload, env.jwt.secret, { algorithm: 'HS512', expiresIn: '1h' });
    expect(() => verifyToken(token)).toThrow();
  });

  it('recusa token sem assinatura', () => {
    const token = jwt.sign(payload, '', { algorithm: 'none' });
    expect(() => verifyToken(token)).toThrow();
  });

  it('recusa token adulterado', () => {
    const [cabecalho, , assinatura] = signToken(payload).split('.');
    const outroPayload = Buffer.from(JSON.stringify({ ...payload, role: 'paciente' })).toString('base64url');
    expect(() => verifyToken(`${cabecalho}.${outroPayload}.${assinatura}`)).toThrow();
  });

  it('recusa token expirado', () => {
    const token = jwt.sign({ ...payload, exp: Math.floor(Date.now() / 1000) - 60 }, env.jwt.secret);
    expect(() => verifyToken(token)).toThrow(jwt.TokenExpiredError);
  });

  it('acompanha a troca do segredo: o token antigo deixa de valer', () => {
    const token = signToken(payload);
    env.jwt.secret = 'outro-segredo-de-teste';
    expect(() => verifyToken(token)).toThrow();
    expect(verifyToken(signToken(payload))).toMatchObject(payload);
  });
});
