// #41: os segredos (JWT_SECRET, DB_APP_PASSWORD, DATA_ENCRYPTION_KEY) só têm
// valor padrão em development e test. Fora deles a API se recusa a subir.

const SEGREDOS = ['JWT_SECRET', 'DB_APP_PASSWORD', 'DATA_ENCRYPTION_KEY'] as const;

const PRODUCAO_COMPLETA = {
  NODE_ENV: 'production',
  JWT_SECRET: 'segredo-de-producao',
  DB_APP_PASSWORD: 'senha-de-producao',
  DATA_ENCRYPTION_KEY: 'Y2hhdmUtZGUtcHJvZHVjYW8tY29tLTMyLWJ5dGVzISE=',
};

describe('config/env', () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    jest.resetModules();
    // Sem isto o dotenv completaria o ambiente com o backend/.env da máquina
    // de quem roda o teste, e "variável ausente" nunca aconteceria.
    jest.doMock('dotenv', () => ({ __esModule: true, default: { config: jest.fn() }, config: jest.fn() }));

    process.env = { ...ambienteOriginal };
    for (const nome of SEGREDOS) delete process.env[nome];
  });

  afterAll(() => {
    process.env = ambienteOriginal;
    jest.dontMock('dotenv');
  });

  async function carregarEnv() {
    return (await import('../../src/config/env')).env;
  }

  describe.each(['production', 'staging', undefined])('com NODE_ENV=%s', (nodeEnv) => {
    beforeEach(() => {
      if (nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = nodeEnv;
    });

    it.each(SEGREDOS)('recusa subir sem %s', async (ausente) => {
      for (const nome of SEGREDOS) {
        if (nome !== ausente) process.env[nome] = PRODUCAO_COMPLETA[nome];
      }

      await expect(carregarEnv()).rejects.toThrow(`Variável de ambiente obrigatória ausente: ${ausente}`);
    });
  });

  it('em produção usa os valores definidos no ambiente', async () => {
    Object.assign(process.env, PRODUCAO_COMPLETA);

    const env = await carregarEnv();

    expect(env.jwt.secret).toBe('segredo-de-producao');
    expect(env.db.appPassword).toBe('senha-de-producao');
    expect(env.dataEncryptionKey).toBe(PRODUCAO_COMPLETA.DATA_ENCRYPTION_KEY);
  });

  it('deixa a telemetria desligada sem a connection string', async () => {
    Object.assign(process.env, PRODUCAO_COMPLETA);
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    expect((await carregarEnv()).telemetry.connectionString).toBeUndefined();
  });

  it('lê a connection string do Application Insights do ambiente', async () => {
    Object.assign(process.env, PRODUCAO_COMPLETA, { APPLICATIONINSIGHTS_CONNECTION_STRING: 'InstrumentationKey=abc' });

    expect((await carregarEnv()).telemetry.connectionString).toBe('InstrumentationKey=abc');
  });

  it.each(['development', 'test'])('em %s sobe com os valores de desenvolvimento', async (nodeEnv) => {
    process.env.NODE_ENV = nodeEnv;

    const env = await carregarEnv();

    expect(env.jwt.secret).toBe('dev-secret-nao-use-em-producao');
    expect(env.db.appPassword).toBe('nutrihub_app_dev_password');
    expect(env.dataEncryptionKey).toBeTruthy();
  });

  it('tira as barras do final do APP_URL', async () => {
    process.env.APP_URL = 'https://appnutrihub.com.br///';

    const env = await carregarEnv();

    expect(env.notifications.appUrl).toBe('https://appnutrihub.com.br');
  });
});
