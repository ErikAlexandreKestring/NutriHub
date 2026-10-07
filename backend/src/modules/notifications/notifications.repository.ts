import { Knex } from 'knex';
import { db, withTenant } from '../../db/connection';
import { EmailContent, NotificationEvent, WhatsAppContent } from './notifications.messages';

export type NotificationChannel = 'email' | 'whatsapp';
export type NotificationStatus = 'pendente' | 'enviando' | 'enviado' | 'falha';

export interface EmailFallback {
  destino: string;
  conteudo: EmailContent;
}

/** O que quem dispara o aviso entrega para a fila. */
export type NotificationJob =
  | {
      evento: NotificationEvent;
      canal: 'email';
      destino: string;
      conteudo: EmailContent;
      referenciaId?: string;
    }
  | {
      evento: NotificationEvent;
      canal: 'whatsapp';
      destino: string;
      conteudo: WhatsAppContent;
      referenciaId?: string;
      fallback?: EmailFallback;
    };

export interface NotificationRecord {
  id: string;
  tenant_id: string;
  evento: NotificationEvent;
  canal: NotificationChannel;
  destino: string;
  conteudo: EmailContent | WhatsAppContent;
  fallback: EmailFallback | null;
  referencia_id: string | null;
  status: NotificationStatus;
  tentativas: number;
  max_tentativas: number;
  intervalo_segundos: number;
  proxima_tentativa_em: Date;
  ultimo_erro: string | null;
  enviado_em: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Política de novas tentativas por canal:
 *   - e-mail, E-17: nova tentativa em 2 minutos, até 3 tentativas;
 *   - WhatsApp, E-09: nova tentativa em 5 minutos, até 3 tentativas.
 */
export const RETRY_POLICY: Record<NotificationChannel, { maxTentativas: number; intervaloSegundos: number }> = {
  email: { maxTentativas: 3, intervaloSegundos: 120 },
  whatsapp: { maxTentativas: 3, intervaloSegundos: 300 },
};

// O texto do erro vem do provedor; o limite só evita guardar uma página HTML inteira.
const MAX_ERRO = 1000;

export class NotificationsRepository {
  constructor(private readonly connection: Knex = db) {}

  async enqueue(tenantId: string, jobs: NotificationJob[]): Promise<void> {
    if (jobs.length === 0) return;

    await withTenant(tenantId, (trx) =>
      trx('notifications').insert(
        jobs.map((job) => ({
          tenant_id: tenantId,
          evento: job.evento,
          canal: job.canal,
          destino: job.destino,
          conteudo: job.conteudo,
          fallback: job.canal === 'whatsapp' ? job.fallback ?? null : null,
          referencia_id: job.referenciaId ?? null,
          max_tentativas: RETRY_POLICY[job.canal].maxTentativas,
          intervalo_segundos: RETRY_POLICY[job.canal].intervaloSegundos,
        })),
      ),
    );
  }

  /**
   * Reserva até `limit` notificações vencidas de qualquer tenant, já marcadas
   * como 'enviando' e com a tentativa contada (ver claim_notifications na
   * migration). Fora do withTenant() de propósito: é o único ponto do worker
   * que precisa enxergar a fila inteira.
   */
  async claim(limit: number, leaseSeconds: number): Promise<NotificationRecord[]> {
    const result = await this.connection.raw('SELECT * FROM claim_notifications(?, ?)', [limit, leaseSeconds]);
    return result.rows;
  }

  async markSent(tenantId: string, id: string): Promise<void> {
    await withTenant(tenantId, (trx) =>
      trx('notifications')
        .where({ id, status: 'enviando' })
        .update({ status: 'enviado', enviado_em: trx.fn.now(), ultimo_erro: null, updated_at: trx.fn.now() }),
    );
  }

  async scheduleRetry(tenantId: string, id: string, erro: string, proximaTentativaEm: Date): Promise<void> {
    await withTenant(tenantId, (trx) =>
      trx('notifications')
        .where({ id, status: 'enviando' })
        .update({
          status: 'pendente',
          ultimo_erro: erro.slice(0, MAX_ERRO),
          proxima_tentativa_em: proximaTentativaEm,
          updated_at: trx.fn.now(),
        }),
    );
  }

  async markFailed(tenantId: string, id: string, erro: string): Promise<void> {
    await withTenant(tenantId, (trx) =>
      trx('notifications')
        .where({ id, status: 'enviando' })
        .update({ status: 'falha', ultimo_erro: erro.slice(0, MAX_ERRO), updated_at: trx.fn.now() }),
    );
  }
}
