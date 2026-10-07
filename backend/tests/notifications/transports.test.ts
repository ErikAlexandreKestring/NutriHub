import type { Transporter } from 'nodemailer';
import {
  ConsoleEmailTransport,
  ConsoleWhatsAppTransport,
  createEmailTransport,
  createWhatsAppTransport,
  isWhatsAppEnabled,
  MetaWhatsAppTransport,
  NotificationDeliveryError,
  SmtpEmailTransport,
} from '../../src/modules/notifications/transports';
import { env } from '../../src/config/env';

const SMTP = { host: 'smtp.exemplo.com', port: 587, secure: false };

describe('SmtpEmailTransport', () => {
  it('envia com o remetente configurado', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const transport = new SmtpEmailTransport(SMTP, 'Nutri-Hub <nao-responda@nutrihub.com>', {
      sendMail,
    } as unknown as Transporter);

    await transport.send({ to: 'maria@email.com', subject: 'Assunto', text: 'Corpo' });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'Nutri-Hub <nao-responda@nutrihub.com>',
      to: 'maria@email.com',
      subject: 'Assunto',
      text: 'Corpo',
    });
  });

  it.each([
    [550, true],
    [421, false],
    [undefined, false],
  ])('resposta SMTP %s → permanente = %s', async (responseCode, permanente) => {
    const sendMail = jest.fn().mockRejectedValue(Object.assign(new Error('recusado'), { responseCode }));
    const transport = new SmtpEmailTransport(SMTP, 'x@x.com', { sendMail } as unknown as Transporter);

    const erro = await transport.send({ to: 'a@a.com', subject: 's', text: 't' }).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(NotificationDeliveryError);
    expect((erro as NotificationDeliveryError).permanente).toBe(permanente);
  });
});

describe('MetaWhatsAppTransport (RN-04)', () => {
  const config = {
    apiVersion: 'v21.0',
    phoneNumberId: '123456',
    accessToken: 'token-secreto',
    templateLanguage: 'pt_BR',
  };
  const message = { to: '5547999990000', template: 'consulta_confirmada', parametros: ['Maria', 'Eridiane'] };

  it('envia um template pela Cloud API', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const transport = new MetaWhatsAppTransport(config, fetchFn);

    await transport.send(message);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v21.0/123456/messages');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-secreto' });
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      to: '5547999990000',
      type: 'template',
      template: {
        name: 'consulta_confirmada',
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Maria' },
              { type: 'text', text: 'Eridiane' },
            ],
          },
        ],
      },
    });
  });

  it.each([
    [400, true],
    [404, true],
    [401, false],
    [429, false],
    [503, false],
  ])('HTTP %s → permanente = %s', async (status, permanente) => {
    const fetchFn = jest.fn().mockResolvedValue(new Response('{"error":{}}', { status }));
    const transport = new MetaWhatsAppTransport(config, fetchFn);

    const erro = await transport.send(message).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(NotificationDeliveryError);
    expect((erro as NotificationDeliveryError).permanente).toBe(permanente);
    expect((erro as Error).message).toContain(String(status));
  });

  it('falha de rede é temporária', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    const transport = new MetaWhatsAppTransport(config, fetchFn);

    const erro = await transport.send(message).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(NotificationDeliveryError);
    expect((erro as NotificationDeliveryError).permanente).toBe(false);
  });
});

describe('fábricas de transporte', () => {
  it('escolhe o transporte de e-mail pela configuração', () => {
    expect(createEmailTransport({ ...env.email, transport: 'console' })).toBeInstanceOf(ConsoleEmailTransport);
    expect(
      createEmailTransport({ ...env.email, transport: 'smtp', smtp: { ...env.email.smtp, host: 'smtp.exemplo.com' } }),
    ).toBeInstanceOf(SmtpEmailTransport);
  });

  it('recusa SMTP sem host e transporte desconhecido', () => {
    expect(() => createEmailTransport({ ...env.email, transport: 'smtp', smtp: { ...env.email.smtp, host: undefined } })).toThrow(
      'SMTP_HOST',
    );
    expect(() => createEmailTransport({ ...env.email, transport: 'pombo' })).toThrow('EMAIL_TRANSPORT');
  });

  it('escolhe o transporte de WhatsApp pela configuração', () => {
    expect(createWhatsAppTransport({ ...env.whatsapp, transport: 'desativado' })).toBeNull();
    expect(createWhatsAppTransport({ ...env.whatsapp, transport: 'console' })).toBeInstanceOf(ConsoleWhatsAppTransport);
    expect(
      createWhatsAppTransport({ ...env.whatsapp, transport: 'meta', phoneNumberId: '1', accessToken: 't' }),
    ).toBeInstanceOf(MetaWhatsAppTransport);
    expect(isWhatsAppEnabled({ ...env.whatsapp, transport: 'desativado' })).toBe(false);
  });

  it('recusa Meta sem credenciais e transporte desconhecido', () => {
    expect(() =>
      createWhatsAppTransport({ ...env.whatsapp, transport: 'meta', phoneNumberId: undefined, accessToken: undefined }),
    ).toThrow('WHATSAPP_PHONE_NUMBER_ID');
    expect(() => createWhatsAppTransport({ ...env.whatsapp, transport: 'sms' })).toThrow('WHATSAPP_TRANSPORT');
  });
});
