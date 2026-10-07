import { NotificationDeliveryError } from './deliveryError';

/**
 * RN-04: fora da janela de 24 h aberta pelo próprio usuário, a Meta só aceita
 * mensagens de template pré-aprovado. Todo aviso do Nutri-Hub é iniciado pelo
 * sistema, então todo envio é de template — nunca texto livre.
 */
export interface WhatsAppMessage {
  to: string;
  template: string;
  parametros: string[];
}

export interface WhatsAppTransport {
  send(message: WhatsAppMessage): Promise<void>;
}

export interface MetaWhatsAppConfig {
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
  templateLanguage: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

/** WhatsApp Business via Meta Cloud API (RFC seção 5.5). */
export class MetaWhatsAppTransport implements WhatsAppTransport {
  constructor(
    private readonly config: MetaWhatsAppConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(message: WhatsAppMessage): Promise<void> {
    const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to: message.to,
      type: 'template',
      template: {
        name: message.template,
        language: { code: this.config.templateLanguage },
        components: [
          {
            type: 'body',
            parameters: message.parametros.map((text) => ({ type: 'text', text })),
          },
        ],
      },
    };

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      throw new NotificationDeliveryError(`Falha de conexão com o WhatsApp: ${motivo}`);
    }

    if (!response.ok) {
      const detalhe = (await response.text().catch(() => '')).slice(0, 500);
      // 400/404: número, template ou parâmetros inválidos — repetir a mesma
      // requisição dá o mesmo erro. Credencial (401/403), limite (429) e
      // instabilidade (5xx) podem se resolver até a próxima tentativa.
      const permanente = response.status === 400 || response.status === 404;
      throw new NotificationDeliveryError(`WhatsApp respondeu ${response.status}: ${detalhe}`, permanente);
    }
  }
}

/** Desenvolvimento: só escreve a mensagem no log, sem credenciais da Meta. */
export class ConsoleWhatsAppTransport implements WhatsAppTransport {
  async send(message: WhatsAppMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(`[whatsapp] para ${message.to} — template ${message.template}: ${message.parametros.join(' | ')}`);
  }
}
