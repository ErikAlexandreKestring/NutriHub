import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db } from '../../src/db/connection';
import { down, up } from '../../src/db/migrations/20261108130000_confirmacao_email_e_recuperacao_senha';
import { AuthEmails } from '../../src/modules/auth/auth.emails';
import { AuthService } from '../../src/modules/auth/auth.service';
import { EmailTransport } from '../../src/modules/notifications/transports';
import {
  EmailNotConfirmedError,
  InvalidConfirmationLinkError,
  InvalidCredentialsError,
  InvalidPasswordResetLinkError,
} from '../../src/shared/errors/AppError';
import { __resetAllAttempts } from '../../src/modules/auth/loginAttempts';

/**
 * Confirmação do e-mail e "esqueci minha senha" do nutricionista contra o
 * banco de verdade, pegando o link no e-mail que seria enviado: os links são
 * de uso único, vencem, e a conta só entra depois de confirmada.
 */

const owner: Knex = knexLib(knexConfig.test);
const sufixo = randomUUID().slice(0, 8);
const enviados: Array<{ to: string; text: string }> = [];
const transporte: EmailTransport = { send: async (mensagem) => void enviados.push(mensagem) };
const auth = new AuthService(undefined, undefined, new AuthEmails(transporte, 'https://app.teste'));
let contador = 0;

/** Token do último link enviado para `email`, tirado do fragmento (#) do link. */
function tokenDoUltimoEmail(email: string, caminho: string): string {
  const mensagem = [...enviados].reverse().find((m) => m.to === email);
  const link = mensagem?.text.match(new RegExp(`https://app\\.teste${caminho}#([0-9a-f]{64})`));
  if (!link) throw new Error(`Nenhum link ${caminho} enviado para ${email}`);
  return link[1];
}

async function cadastrar(): Promise<string> {
  contador += 1;
  const email = `nutri-${contador}-${sufixo}@conta.test`;
  await auth.register({
    nome: 'Nutri Teste',
    email,
    crn: 'CRN-10 12345',
    telefone: '(47) 99999-0000',
    senha: 'SenhaInicial1',
  });
  return email;
}

beforeEach(() => __resetAllAttempts());

afterAll(async () => {
  await owner('tenants').where('email', 'like', `%-${sufixo}@conta.test`).delete();
  await owner.destroy();
  await db.destroy();
});

describe('Confirmação do e-mail do nutricionista', () => {
  it('a conta só entra depois de abrir o link, e o link vale uma vez só', async () => {
    const email = await cadastrar();
    await expect(auth.login({ email, senha: 'SenhaInicial1' })).rejects.toThrow(EmailNotConfirmedError);

    const token = tokenDoUltimoEmail(email, '/confirmar-email');
    const confirmado = await auth.confirmEmail(token);

    expect(confirmado.tenant.email).toBe(email);
    await expect(auth.login({ email, senha: 'SenhaInicial1' })).resolves.toMatchObject({ role: 'nutricionista' });
    await expect(auth.confirmEmail(token)).rejects.toThrow(InvalidConfirmationLinkError);
  });

  it('o banco guarda só o hash do token, nunca o token do link', async () => {
    const email = await cadastrar();
    const token = tokenDoUltimoEmail(email, '/confirmar-email');

    const linha = await owner('tenants').where({ email }).first();
    expect(linha.confirmacao_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(linha.confirmacao_token_hash).not.toBe(token);
  });

  it('o link vencido não confirma', async () => {
    const email = await cadastrar();
    const token = tokenDoUltimoEmail(email, '/confirmar-email');
    await owner('tenants').where({ email }).update({ confirmacao_token_expira_em: new Date(Date.now() - 1000) });

    await expect(auth.confirmEmail(token)).rejects.toThrow(InvalidConfirmationLinkError);
  });

  it('o reenvio troca o link: o antigo deixa de valer', async () => {
    const email = await cadastrar();
    const antigo = tokenDoUltimoEmail(email, '/confirmar-email');
    // Fora do intervalo mínimo entre envios.
    await owner('tenants')
      .where({ email })
      .update({ confirmacao_token_expira_em: new Date(Date.now() + 23 * 60 * 60 * 1000) });

    await auth.resendConfirmation(email);
    const novo = tokenDoUltimoEmail(email, '/confirmar-email');

    expect(novo).not.toBe(antigo);
    await expect(auth.confirmEmail(antigo)).rejects.toThrow(InvalidConfirmationLinkError);
    await expect(auth.confirmEmail(novo)).resolves.toBeDefined();
  });
});

describe('Esqueci minha senha do nutricionista', () => {
  async function contaConfirmada(): Promise<string> {
    const email = await cadastrar();
    await auth.confirmEmail(tokenDoUltimoEmail(email, '/confirmar-email'));
    return email;
  }

  it('troca a senha pelo link: a nova entra, a antiga não, e o link vale uma vez só', async () => {
    const email = await contaConfirmada();

    await auth.requestPasswordReset(email);
    const token = tokenDoUltimoEmail(email, '/redefinir-senha');
    await auth.resetPassword({ token, senha: 'SenhaNova123' });

    await expect(auth.login({ email, senha: 'SenhaNova123' })).resolves.toMatchObject({ role: 'nutricionista' });
    await expect(auth.login({ email, senha: 'SenhaInicial1' })).rejects.toThrow(InvalidCredentialsError);
    await expect(auth.resetPassword({ token, senha: 'OutraSenha123' })).rejects.toThrow(
      InvalidPasswordResetLinkError,
    );
  });

  it('o link vencido não troca a senha', async () => {
    const email = await contaConfirmada();
    await auth.requestPasswordReset(email);
    const token = tokenDoUltimoEmail(email, '/redefinir-senha');
    await owner('tenants').where({ email }).update({ senha_token_expira_em: new Date(Date.now() - 1000) });

    await expect(auth.resetPassword({ token, senha: 'SenhaNova123' })).rejects.toThrow(InvalidPasswordResetLinkError);
    await expect(auth.login({ email, senha: 'SenhaInicial1' })).resolves.toBeDefined();
  });

  it('redefinir a senha também confirma uma conta que ainda não tinha confirmado', async () => {
    const email = await cadastrar();

    await auth.requestPasswordReset(email);
    await auth.resetPassword({ token: tokenDoUltimoEmail(email, '/redefinir-senha'), senha: 'SenhaNova123' });

    await expect(auth.login({ email, senha: 'SenhaNova123' })).resolves.toMatchObject({ role: 'nutricionista' });
  });

  it('e-mail sem conta não recebe nada', async () => {
    const antes = enviados.length;

    await auth.requestPasswordReset(`ninguem-${sufixo}@conta.test`);

    expect(enviados).toHaveLength(antes);
  });
});

describe('Migration da confirmação', () => {
  it('as contas que já existiam ficam confirmadas, com a data de criação', async () => {
    await down(owner);
    contador += 1;
    const [antiga] = await owner('tenants')
      .insert({ nome: 'Nutri Antiga', email: `nutri-${contador}-${sufixo}@conta.test`, crn: 'CRN-3 1', senha_hash: 'x' })
      .returning(['id', 'created_at']);

    await up(owner);

    const linha = await owner('tenants').where({ id: antiga.id }).first();
    expect(linha.email_confirmado_em).toEqual(antiga.created_at);
  });
});
