import { env } from '../../../config/env';
import { ConsoleEmailTransport, EmailTransport, SmtpEmailTransport } from './email.transport';

export * from './deliveryError';
export * from './email.transport';

// Configuração inválida derruba a subida do processo, em vez de cada
// notificação falhar em silêncio horas depois.
export function createEmailTransport(config = env.email): EmailTransport {
  switch (config.transport) {
    case 'console':
      return new ConsoleEmailTransport();
    case 'smtp':
      if (!config.smtp.host) {
        throw new Error('EMAIL_TRANSPORT=smtp exige SMTP_HOST');
      }
      return new SmtpEmailTransport({ ...config.smtp, host: config.smtp.host }, config.from);
    default:
      throw new Error(`EMAIL_TRANSPORT inválido: ${config.transport} (use console ou smtp)`);
  }
}
