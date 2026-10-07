import { env } from '../../../config/env';
import { ConsoleEmailTransport, EmailTransport, SmtpEmailTransport } from './email.transport';
import { ConsoleWhatsAppTransport, MetaWhatsAppTransport, WhatsAppTransport } from './whatsapp.transport';

export * from './deliveryError';
export * from './email.transport';
export * from './whatsapp.transport';

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

/** `null` quando o WhatsApp está desativado: os avisos seguem só por e-mail. */
export function createWhatsAppTransport(config = env.whatsapp): WhatsAppTransport | null {
  switch (config.transport) {
    case 'desativado':
      return null;
    case 'console':
      return new ConsoleWhatsAppTransport();
    case 'meta':
      if (!config.phoneNumberId || !config.accessToken) {
        throw new Error('WHATSAPP_TRANSPORT=meta exige WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ACCESS_TOKEN');
      }
      return new MetaWhatsAppTransport({
        apiVersion: config.apiVersion,
        phoneNumberId: config.phoneNumberId,
        accessToken: config.accessToken,
        templateLanguage: config.templateLanguage,
      });
    default:
      throw new Error(`WHATSAPP_TRANSPORT inválido: ${config.transport} (use console, meta ou desativado)`);
  }
}

export function isWhatsAppEnabled(config = env.whatsapp): boolean {
  return config.transport !== 'desativado';
}
