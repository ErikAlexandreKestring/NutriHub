import type { Transporter } from 'nodemailer';
import {
  ConsoleEmailTransport,
  createEmailTransport,
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

describe('createEmailTransport', () => {
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
});
