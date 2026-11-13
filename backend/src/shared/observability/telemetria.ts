import type * as ApplicationInsights from 'applicationinsights';

/**
 * Observabilidade com o Azure Application Insights: requisições (volume,
 * latência e falhas por rota), dependências (as consultas ao PostgreSQL),
 * exceções, uso de CPU e memória e o que a API escreve no console.
 *
 * Só liga quando há uma connection string (`APPLICATIONINSIGHTS_CONNECTION_STRING`,
 * o nome que a própria Azure usa). Em desenvolvimento e nos testes ela não
 * existe e nada é enviado.
 *
 * O SDK é carregado só nesse caso: ele depende de pacotes ESM que exigem
 * Node 22.12 ou mais novo, e quem não liga a telemetria (testes, CI, um
 * desenvolvimento em Node mais antigo) não deve pagar por isso.
 */
let sdk: typeof ApplicationInsights | undefined;

export function iniciarTelemetria(connectionString: string | undefined): boolean {
  if (sdk) return true;
  if (!connectionString) return false;

  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const appInsights = require('applicationinsights') as typeof ApplicationInsights;
  appInsights
    .setup(connectionString)
    .setAutoCollectRequests(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectConsole(true, true)
    .start();
  const { context } = appInsights.defaultClient;
  context.tags[context.keys.cloudRole] = 'nutrihub-api';

  sdk = appInsights;
  return true;
}

/** Erros tratados (o 500 do errorHandler) não chegam ao coletor sozinhos: registra à mão. */
export function registrarErro(erro: unknown): void {
  if (!sdk) return;
  const excecao = erro instanceof Error ? erro : new Error(String(erro));
  sdk.defaultClient.trackException({ exception: excecao });
}

/** Esvazia o que ainda está na fila antes de o processo sair (SIGTERM do App Service). */
export async function encerrarTelemetria(): Promise<void> {
  if (!sdk) return;
  const atual = sdk;
  sdk = undefined;
  await atual.defaultClient.flush();
  atual.dispose();
}
