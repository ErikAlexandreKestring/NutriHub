import { createApp } from './app';
import { env } from './config/env';
import { createNotificationsWorker } from './modules/notifications';

const app = createApp();

// RF-06 / RF-07: o worker de notificações roda no mesmo processo da API.
const worker = env.notifications.workerEnabled ? createNotificationsWorker() : undefined;

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Nutri-Hub API rodando na porta ${env.port} [${env.nodeEnv}]`);
  worker?.start();
});

// O App Service manda SIGTERM antes de reciclar a instância: deixa o lote em
// envio terminar para não reenviar mensagens que já tinham saído.
function shutdown(): void {
  server.close();
  void (worker?.stop() ?? Promise.resolve()).finally(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
