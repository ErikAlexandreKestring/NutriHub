// Observabilidade: o Application Insights só liga com a connection string, e o
// SDK nem é carregado sem ela (testes, CI e desenvolvimento seguem como eram).

const CONNECTION_STRING = 'InstrumentationKey=00000000-0000-0000-0000-000000000000';

function criarSdkFalso() {
  const contexto = { tags: {} as Record<string, string>, keys: { cloudRole: 'ai.cloud.role' } };
  const configuracao = {
    setAutoCollectRequests: jest.fn().mockReturnThis(),
    setAutoCollectDependencies: jest.fn().mockReturnThis(),
    setAutoCollectExceptions: jest.fn().mockReturnThis(),
    setAutoCollectPerformance: jest.fn().mockReturnThis(),
    setAutoCollectConsole: jest.fn().mockReturnThis(),
    start: jest.fn().mockReturnThis(),
  };
  return {
    contexto,
    configuracao,
    sdk: {
      setup: jest.fn().mockReturnValue(configuracao),
      dispose: jest.fn(),
      defaultClient: {
        context: contexto,
        trackException: jest.fn(),
        flush: jest.fn().mockResolvedValue(undefined),
      },
    },
  };
}

describe('shared/observability/telemetria', () => {
  let falso: ReturnType<typeof criarSdkFalso>;
  let telemetria: typeof import('../../src/shared/observability/telemetria');

  beforeEach(() => {
    jest.resetModules();
    falso = criarSdkFalso();
    jest.doMock('applicationinsights', () => falso.sdk);
    telemetria = require('../../src/shared/observability/telemetria');
  });

  afterAll(() => {
    jest.dontMock('applicationinsights');
  });

  it('fica desligada e não carrega o SDK sem connection string', () => {
    expect(telemetria.iniciarTelemetria(undefined)).toBe(false);
    expect(telemetria.iniciarTelemetria('')).toBe(false);

    expect(falso.sdk.setup).not.toHaveBeenCalled();
  });

  it('liga com a connection string e coleta requisições, dependências e exceções', () => {
    expect(telemetria.iniciarTelemetria(CONNECTION_STRING)).toBe(true);

    expect(falso.sdk.setup).toHaveBeenCalledWith(CONNECTION_STRING);
    expect(falso.configuracao.setAutoCollectRequests).toHaveBeenCalledWith(true);
    expect(falso.configuracao.setAutoCollectDependencies).toHaveBeenCalledWith(true);
    expect(falso.configuracao.setAutoCollectExceptions).toHaveBeenCalledWith(true);
    expect(falso.configuracao.start).toHaveBeenCalledTimes(1);
  });

  it('identifica a API pelo nome nutrihub-api no painel', () => {
    telemetria.iniciarTelemetria(CONNECTION_STRING);

    expect(falso.contexto.tags['ai.cloud.role']).toBe('nutrihub-api');
  });

  it('não liga duas vezes', () => {
    telemetria.iniciarTelemetria(CONNECTION_STRING);
    telemetria.iniciarTelemetria(CONNECTION_STRING);

    expect(falso.sdk.setup).toHaveBeenCalledTimes(1);
  });

  it('registra o erro como exceção quando está ligada', () => {
    telemetria.iniciarTelemetria(CONNECTION_STRING);
    const erro = new Error('falhou');

    telemetria.registrarErro(erro);

    expect(falso.sdk.defaultClient.trackException).toHaveBeenCalledWith({ exception: erro });
  });

  it('transforma um valor que não é Error em Error antes de registrar', () => {
    telemetria.iniciarTelemetria(CONNECTION_STRING);

    telemetria.registrarErro('texto solto');

    const enviado = falso.sdk.defaultClient.trackException.mock.calls[0][0].exception;
    expect(enviado).toBeInstanceOf(Error);
    expect(enviado.message).toBe('texto solto');
  });

  it('não faz nada ao registrar erro com a telemetria desligada', () => {
    expect(() => telemetria.registrarErro(new Error('x'))).not.toThrow();
    expect(falso.sdk.defaultClient.trackException).not.toHaveBeenCalled();
  });

  it('esvazia a fila e encerra o coletor ao desligar', async () => {
    telemetria.iniciarTelemetria(CONNECTION_STRING);

    await telemetria.encerrarTelemetria();

    expect(falso.sdk.defaultClient.flush).toHaveBeenCalledTimes(1);
    expect(falso.sdk.dispose).toHaveBeenCalledTimes(1);
  });

  it('encerrar sem ter ligado não faz nada', async () => {
    await telemetria.encerrarTelemetria();

    expect(falso.sdk.dispose).not.toHaveBeenCalled();
  });
});
