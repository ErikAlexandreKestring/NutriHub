/**
 * Falha de entrega devolvida por um transporte. `permanente` indica que tentar
 * de novo não adianta (destinatário inexistente, número inválido, template
 * recusado): o worker marca a notificação como falha na hora, sem gastar as
 * novas tentativas de E-09/E-17.
 */
export class NotificationDeliveryError extends Error {
  constructor(
    message: string,
    public readonly permanente = false,
  ) {
    super(message);
    this.name = 'NotificationDeliveryError';
  }
}
