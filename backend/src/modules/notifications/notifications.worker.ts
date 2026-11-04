import { FeedbacksRepository } from '../feedbacks/feedbacks.repository';
import { NotificationRecord, NotificationsRepository } from './notifications.repository';
import { EmailTransport, NotificationDeliveryError } from './transports';

export interface NotificationsWorkerDeps {
  repository: Pick<NotificationsRepository, 'claim' | 'markSent' | 'scheduleRetry' | 'markFailed'>;
  feedbacks: Pick<FeedbacksRepository, 'markNotificationFailed'>;
  email: EmailTransport;
  intervalMs: number;
  batchSize?: number;
  /** Quanto tempo uma notificação pode ficar em 'enviando' antes de voltar à fila. */
  leaseSeconds?: number;
}

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_LEASE_SECONDS = 300;

/**
 * Worker de notificações (RFC seção 5.2): varre a fila a cada `intervalMs`,
 * envia o que venceu e aplica as regras de falha dos fluxos:
 *
 *   - E-17: e-mail com nova tentativa em 2 min; esgotadas as 3, o feedback que
 *     originou o alerta fica marcado como "notificação falha";
 *   - E-13 / E-18 / E-21: a falha fica registrada na própria fila e no log.
 */
export class NotificationsWorker {
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<number> | undefined;

  constructor(private readonly deps: NotificationsWorkerDeps) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.deps.intervalMs);
    // Não segura o processo vivo sozinho (testes, scripts, shutdown).
    this.timer.unref();
  }

  /** Para de agendar novas varreduras e espera a que estiver em andamento. */
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.running;
  }

  /**
   * Uma varredura. Se a anterior ainda não terminou (provedor lento), devolve
   * a mesma em vez de começar outra — o lote dela continua 'enviando'.
   */
  runOnce(): Promise<number> {
    if (!this.running) {
      this.running = this.processBatch().finally(() => {
        this.running = undefined;
      });
    }
    return this.running;
  }

  private async processBatch(): Promise<number> {
    let batch: NotificationRecord[];
    try {
      batch = await this.deps.repository.claim(
        this.deps.batchSize ?? DEFAULT_BATCH_SIZE,
        this.deps.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
      );
    } catch (erro) {
      console.error('Falha ao buscar notificações pendentes', erro);
      return 0;
    }

    // Em paralelo: o lote é pequeno, e um provedor lento não deve atrasar os
    // outros avisos além dos 30 s do RF-06.
    await Promise.all(batch.map((notification) => this.process(notification)));
    return batch.length;
  }

  private async process(notification: NotificationRecord): Promise<void> {
    try {
      await this.send(notification);
    } catch (erro) {
      await this.handleFailure(notification, erro).catch((falha: unknown) => {
        console.error(`Falha ao registrar o erro da notificação ${notification.id}`, falha);
      });
      return;
    }

    await this.deps.repository.markSent(notification.tenant_id, notification.id).catch((erro: unknown) => {
      // Enviada, mas sem o registro: o lease a devolve à fila e ela pode sair
      // de novo. Entrega "pelo menos uma vez" é preferível a perder o aviso.
      console.error(`Notificação ${notification.id} enviada, mas não marcada como enviada`, erro);
    });
  }

  private async send(notification: NotificationRecord): Promise<void> {
    const { conteudo } = notification;
    await this.deps.email.send({ to: notification.destino, subject: conteudo.assunto, text: conteudo.texto });
  }

  private async handleFailure(notification: NotificationRecord, erro: unknown): Promise<void> {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    const permanente = erro instanceof NotificationDeliveryError && erro.permanente;
    const esgotou = permanente || notification.tentativas >= notification.max_tentativas;
    const { repository } = this.deps;

    console.error(
      `Notificação ${notification.evento} (${notification.canal}) falhou na tentativa ` +
        `${notification.tentativas}/${notification.max_tentativas}${esgotou ? ', sem novas tentativas' : ''}: ${motivo}`,
    );

    if (esgotou) {
      await repository.markFailed(notification.tenant_id, notification.id, motivo);
    } else {
      const proxima = new Date(Date.now() + notification.intervalo_segundos * 1000);
      await repository.scheduleRetry(notification.tenant_id, notification.id, motivo, proxima);
    }

    // E-17: o nutricionista não recebeu o alerta por e-mail; o painel precisa mostrar isso.
    if (esgotou && notification.evento === 'FEEDBACK_REGISTRADO' && notification.referencia_id) {
      await this.deps.feedbacks.markNotificationFailed(notification.tenant_id, notification.referencia_id);
    }
  }
}
