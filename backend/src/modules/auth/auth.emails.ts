import { env } from '../../config/env';
import { createEmailTransport, EmailTransport } from '../notifications/transports';

/**
 * E-mails da própria conta do nutricionista: confirmação do cadastro e
 * redefinição de senha. Saem direto pelo transporte de e-mail, sem a fila de
 * notificações: a fila é por consultório (RLS) e reenviada pelo worker, e
 * estes links são para quem está esperando na tela agora — se o envio falhar,
 * a própria tela oferece mandar de novo.
 *
 * O link leva o token no fragmento (#), como o de primeiro acesso do paciente:
 * o fragmento não vai para o servidor nem para os logs de acesso.
 */
export class AuthEmails {
  constructor(
    private readonly transport: EmailTransport = createEmailTransport(),
    private readonly appUrl: string = env.notifications.appUrl,
  ) {}

  async confirmacaoDeEmail(destino: { nome: string; email: string }, token: string): Promise<void> {
    await this.transport.send({
      to: destino.email,
      subject: 'Confirme seu e-mail no Nutri-Hub',
      text:
        `Olá, ${primeiroNome(destino.nome)}!\n\n` +
        'Falta pouco para usar o Nutri-Hub. Confirme seu e-mail abrindo o link abaixo:\n\n' +
        `${this.appUrl}/confirmar-email#${token}\n\n` +
        'O link vale por 24 horas. Se você não criou uma conta no Nutri-Hub, ignore este e-mail.',
    });
  }

  async redefinicaoDeSenha(destino: { nome: string; email: string }, token: string): Promise<void> {
    await this.transport.send({
      to: destino.email,
      subject: 'Redefinição de senha do Nutri-Hub',
      text:
        `Olá, ${primeiroNome(destino.nome)}!\n\n` +
        'Recebemos um pedido para redefinir a senha da sua conta. Para criar uma nova senha, abra o link abaixo:\n\n' +
        `${this.appUrl}/redefinir-senha#${token}\n\n` +
        'O link vale por 1 hora e só pode ser usado uma vez. Se você não pediu a redefinição, ignore este e-mail: ' +
        'sua senha continua a mesma.',
    });
  }
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}
