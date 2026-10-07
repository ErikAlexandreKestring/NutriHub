import { NotificationsWorker } from '../../src/modules/notifications/notifications.worker';
import { NotificationRecord, NotificationsRepository } from '../../src/modules/notifications/notifications.repository';
import { FeedbacksRepository } from '../../src/modules/feedbacks/feedbacks.repository';
import {
  EmailTransport,
  NotificationDeliveryError,
  WhatsAppTransport,
} from '../../src/modules/notifications/transports';

function buildNotification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: 'notif-1',
    tenant_id: 'tenant-1',
    evento: 'FEEDBACK_REGISTRADO',
    canal: 'email',
    destino: 'eridiane@nutrihub.com',
    conteudo: { assunto: 'Novo feedback', texto: 'Corpo' },
    fallback: null,
    referencia_id: 'feedback-1',
    status: 'enviando',
    tentativas: 1,
    max_tentativas: 3,
    intervalo_segundos: 120,
    proxima_tentativa_em: new Date(),
    ultimo_erro: null,
    enviado_em: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildWhatsApp(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return buildNotification({
    evento: 'PLANO_PUBLICADO',
    canal: 'whatsapp',
    destino: '5547999990000',
    conteudo: { template: 'novo_plano_disponivel', parametros: ['Maria', 'Eridiane', 'https://app/meu-plano'] },
    referencia_id: 'plan-1',
    intervalo_segundos: 300,
    ...overrides,
  });
}

describe('NotificationsWorker', () => {
  let repository: jest.Mocked<NotificationsRepository>;
  let feedbacks: jest.Mocked<FeedbacksRepository>;
  let email: jest.Mocked<EmailTransport>;
  let whatsapp: jest.Mocked<WhatsAppTransport>;
  let worker: NotificationsWorker;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    repository = {
      claim: jest.fn().mockResolvedValue([]),
      markSent: jest.fn().mockResolvedValue(undefined),
      scheduleRetry: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationsRepository>;
    feedbacks = { markNotificationFailed: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<
      FeedbacksRepository
    >;
    email = { send: jest.fn().mockResolvedValue(undefined) };
    whatsapp = { send: jest.fn().mockResolvedValue(undefined) };

    worker = new NotificationsWorker({ repository, feedbacks, email, whatsapp, intervalMs: 1000 });
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await worker.stop();
    consoleError.mockRestore();
    jest.useRealTimers();
  });

  it('reserva o lote com o tamanho e o lease configurados', async () => {
    await worker.runOnce();
    expect(repository.claim).toHaveBeenCalledWith(20, 300);
  });

  it('envia o e-mail e marca como enviado', async () => {
    repository.claim.mockResolvedValue([buildNotification()]);

    await expect(worker.runOnce()).resolves.toBe(1);

    expect(email.send).toHaveBeenCalledWith({ to: 'eridiane@nutrihub.com', subject: 'Novo feedback', text: 'Corpo' });
    expect(repository.markSent).toHaveBeenCalledWith('tenant-1', 'notif-1');
  });

  it('envia o WhatsApp como template (RN-04)', async () => {
    repository.claim.mockResolvedValue([buildWhatsApp()]);

    await worker.runOnce();

    expect(whatsapp.send).toHaveBeenCalledWith({
      to: '5547999990000',
      template: 'novo_plano_disponivel',
      parametros: ['Maria', 'Eridiane', 'https://app/meu-plano'],
    });
    expect(repository.markSent).toHaveBeenCalledWith('tenant-1', 'notif-1');
  });

  describe('E-17: falha no e-mail', () => {
    it('agenda nova tentativa em 2 minutos enquanto não esgota', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-07T12:00:00Z') });
      repository.claim.mockResolvedValue([buildNotification({ tentativas: 2 })]);
      email.send.mockRejectedValue(new NotificationDeliveryError('SMTP fora do ar'));

      await worker.runOnce();

      expect(repository.scheduleRetry).toHaveBeenCalledWith(
        'tenant-1',
        'notif-1',
        'SMTP fora do ar',
        new Date('2026-10-07T12:02:00Z'),
      );
      expect(repository.markFailed).not.toHaveBeenCalled();
      expect(feedbacks.markNotificationFailed).not.toHaveBeenCalled();
    });

    it('na 3ª falha marca a notificação como falha e o feedback como "notificação falha"', async () => {
      repository.claim.mockResolvedValue([buildNotification({ tentativas: 3 })]);
      email.send.mockRejectedValue(new Error('timeout'));

      await worker.runOnce();

      expect(repository.markFailed).toHaveBeenCalledWith('tenant-1', 'notif-1', 'timeout');
      expect(repository.scheduleRetry).not.toHaveBeenCalled();
      expect(feedbacks.markNotificationFailed).toHaveBeenCalledWith('tenant-1', 'feedback-1');
    });

    it('não marca feedback quando o e-mail esgotado é de outro evento', async () => {
      repository.claim.mockResolvedValue([
        buildNotification({ tentativas: 3, evento: 'CONSULTA_AGENDADA', referencia_id: 'appt-1' }),
      ]);
      email.send.mockRejectedValue(new Error('timeout'));

      await worker.runOnce();

      expect(repository.markFailed).toHaveBeenCalled();
      expect(feedbacks.markNotificationFailed).not.toHaveBeenCalled();
    });

    it('erro permanente encerra na primeira tentativa, sem gastar as outras', async () => {
      repository.claim.mockResolvedValue([buildNotification({ tentativas: 1 })]);
      email.send.mockRejectedValue(new NotificationDeliveryError('550 caixa inexistente', true));

      await worker.runOnce();

      expect(repository.markFailed).toHaveBeenCalledWith('tenant-1', 'notif-1', '550 caixa inexistente');
      expect(feedbacks.markNotificationFailed).toHaveBeenCalledWith('tenant-1', 'feedback-1');
    });
  });

  describe('E-09: falha no WhatsApp', () => {
    const fallback = {
      destino: 'eridiane@nutrihub.com',
      conteudo: { assunto: 'Não foi possível avisar Maria', texto: 'Corpo' },
    };

    it('agenda nova tentativa em 5 minutos e envia o e-mail alternativo na primeira falha', async () => {
      jest.useFakeTimers({ now: new Date('2026-10-07T12:00:00Z') });
      repository.claim.mockResolvedValue([buildWhatsApp({ fallback })]);
      whatsapp.send.mockRejectedValue(new NotificationDeliveryError('WhatsApp respondeu 503'));

      await worker.runOnce();

      expect(repository.scheduleRetry).toHaveBeenCalledWith(
        'tenant-1',
        'notif-1',
        'WhatsApp respondeu 503',
        new Date('2026-10-07T12:05:00Z'),
      );
      expect(repository.enqueue).toHaveBeenCalledWith('tenant-1', [
        {
          evento: 'PLANO_PUBLICADO',
          canal: 'email',
          destino: 'eridiane@nutrihub.com',
          conteudo: fallback.conteudo,
          referenciaId: 'plan-1',
        },
      ]);
    });

    it('não repete o e-mail alternativo nas tentativas seguintes', async () => {
      repository.claim.mockResolvedValue([buildWhatsApp({ fallback, tentativas: 2 })]);
      whatsapp.send.mockRejectedValue(new Error('timeout'));

      await worker.runOnce();

      expect(repository.scheduleRetry).toHaveBeenCalled();
      expect(repository.enqueue).not.toHaveBeenCalled();
    });

    it('sem fallback (E-18), a falha só fica registrada', async () => {
      repository.claim.mockResolvedValue([buildWhatsApp({ evento: 'FEEDBACK_REGISTRADO', tentativas: 3 })]);
      whatsapp.send.mockRejectedValue(new Error('timeout'));

      await worker.runOnce();

      expect(repository.markFailed).toHaveBeenCalledWith('tenant-1', 'notif-1', 'timeout');
      expect(repository.enqueue).not.toHaveBeenCalled();
      // E-17 é sobre o e-mail: a falha do WhatsApp não marca o feedback.
      expect(feedbacks.markNotificationFailed).not.toHaveBeenCalled();
    });

    it('com o WhatsApp desativado, encerra a notificação e ainda usa o e-mail alternativo', async () => {
      worker = new NotificationsWorker({ repository, feedbacks, email, whatsapp: null, intervalMs: 1000 });
      repository.claim.mockResolvedValue([buildWhatsApp({ fallback })]);

      await worker.runOnce();

      expect(repository.markFailed).toHaveBeenCalledWith('tenant-1', 'notif-1', 'WhatsApp desativado');
      expect(repository.enqueue).toHaveBeenCalled();
    });
  });

  it('uma notificação com falha não impede o envio das outras do lote', async () => {
    repository.claim.mockResolvedValue([
      buildNotification({ id: 'notif-1' }),
      buildNotification({ id: 'notif-2', destino: 'outro@nutrihub.com' }),
    ]);
    email.send.mockRejectedValueOnce(new Error('timeout'));
    repository.scheduleRetry.mockRejectedValue(new Error('banco fora do ar'));

    await worker.runOnce();

    expect(repository.markSent).toHaveBeenCalledWith('tenant-1', 'notif-2');
  });

  it('não lança quando a fila não pode ser lida', async () => {
    repository.claim.mockRejectedValue(new Error('banco fora do ar'));

    await expect(worker.runOnce()).resolves.toBe(0);
    expect(consoleError).toHaveBeenCalled();
  });

  it('não começa uma varredura nova enquanto a anterior está em andamento', async () => {
    let liberar!: () => void;
    email.send.mockReturnValue(new Promise<void>((resolve) => (liberar = resolve)));
    repository.claim.mockResolvedValue([buildNotification()]);

    const primeira = worker.runOnce();
    const segunda = worker.runOnce();
    expect(segunda).toBe(primeira);

    await Promise.resolve();
    await Promise.resolve();
    liberar();
    await primeira;
    expect(repository.claim).toHaveBeenCalledTimes(1);
  });

  it('start agenda varreduras periódicas e stop as interrompe', async () => {
    jest.useFakeTimers();
    worker.start();

    jest.advanceTimersByTime(1000);
    expect(repository.claim).toHaveBeenCalledTimes(1);

    await worker.stop();
    jest.advanceTimersByTime(5000);
    expect(repository.claim).toHaveBeenCalledTimes(1);
  });
});
