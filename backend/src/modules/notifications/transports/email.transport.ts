import nodemailer, { Transporter } from 'nodemailer';
import { NotificationDeliveryError } from './deliveryError';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
}

/** E-mail transacional via SMTP (Nodemailer — RFC seção 5.5). */
export class SmtpEmailTransport implements EmailTransport {
  private readonly transporter: Transporter;

  constructor(
    config: SmtpConfig,
    private readonly from: string,
    transporter?: Transporter,
  ) {
    this.transporter =
      transporter ??
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.user ? { user: config.user, pass: config.password } : undefined,
      });
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to: message.to, subject: message.subject, text: message.text });
    } catch (erro) {
      // Resposta 5xx do servidor SMTP é recusa definitiva (caixa inexistente,
      // domínio inválido); 4xx e erros de rede são temporários.
      const responseCode = (erro as { responseCode?: number }).responseCode;
      const permanente = typeof responseCode === 'number' && responseCode >= 500;
      const motivo = erro instanceof Error ? erro.message : String(erro);
      throw new NotificationDeliveryError(`Falha no envio do e-mail: ${motivo}`, permanente);
    }
  }
}

/** Desenvolvimento: só escreve a mensagem no log, sem servidor SMTP. */
export class ConsoleEmailTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(`[e-mail] para ${message.to} — ${message.subject}\n${message.text}`);
  }
}
