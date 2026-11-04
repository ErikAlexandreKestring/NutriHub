import { env } from '../../config/env';
import { FeedbacksRepository } from '../feedbacks/feedbacks.repository';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsWorker } from './notifications.worker';
import { createEmailTransport } from './transports';

export { NotificationsService } from './notifications.service';
export { NotificationsWorker } from './notifications.worker';

/** Worker com o transporte de e-mail escolhido pelas variáveis de ambiente. */
export function createNotificationsWorker(): NotificationsWorker {
  return new NotificationsWorker({
    repository: new NotificationsRepository(),
    feedbacks: new FeedbacksRepository(),
    email: createEmailTransport(),
    intervalMs: env.notifications.pollIntervalMs,
  });
}
