import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockarApi, renderizarEm, respostaJson, tokenCom } from '@/test/utils';
import { ConfirmarEmail } from '../ConfirmarEmail';
import { EsqueciSenha } from '../EsqueciSenha';
import { RedefinirSenha } from '../RedefinirSenha';

const TOKEN_DO_LINK = 'c'.repeat(64);

const SESSAO_DO_NUTRICIONISTA = {
  token: tokenCom('nutricionista'),
  role: 'nutricionista',
  tenant: { id: 't1', nome: 'Ana Nutri', email: 'ana@clinica.com', crn: 'CRN-10 1234' },
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ConfirmarEmail', () => {
  function abrirLink(token = TOKEN_DO_LINK) {
    window.history.replaceState(null, '', token ? `/confirmar-email#${token}` : '/confirmar-email');
    return renderizarEm('/confirmar-email', <ConfirmarEmail />, '/confirmar-email', {
      '/painel': 'Painel do nutricionista',
    });
  }

  it('confirma assim que abre o link, uma vez só, e entra no painel', async () => {
    const api = mockarApi({ 'POST /api/auth/confirmar-email': () => respostaJson(200, SESSAO_DO_NUTRICIONISTA) });

    abrirLink();

    expect(await screen.findByText('Painel do nutricionista')).toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(1);
    expect(JSON.parse(api.mock.calls[0][1]?.body as string)).toEqual({ token: TOKEN_DO_LINK });
    expect(window.location.hash).toBe('');
  });

  it('com o link vencido, mostra o erro e deixa pedir outro', async () => {
    const api = mockarApi({
      'POST /api/auth/confirmar-email': () =>
        respostaJson(400, { code: 'E-26', message: 'Link de confirmação inválido ou expirado. Peça um novo link de confirmação.' }),
      'POST /api/auth/reenviar-confirmacao': () =>
        respostaJson(202, { mensagem: 'Se houver uma conta de nutricionista com esse e-mail, enviamos o link para ele.' }),
    });

    abrirLink();
    expect(await screen.findByRole('alert')).toHaveTextContent('inválido ou expirado');

    await userEvent.type(screen.getByLabelText('E-mail do cadastro'), 'ana@clinica.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar novo link' }));

    expect(await screen.findByText(/Se houver uma conta/)).toBeInTheDocument();
    expect(JSON.parse(api.mock.calls[1][1]?.body as string)).toEqual({ email: 'ana@clinica.com' });
  });

  it('sem token no link, explica e não chama o servidor', () => {
    const api = mockarApi({});

    abrirLink('');

    expect(screen.getByText('Link incompleto')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});

describe('EsqueciSenha', () => {
  it('pede o link e mostra a mesma resposta para qualquer e-mail', async () => {
    const api = mockarApi({
      'POST /api/auth/esqueci-senha': () =>
        respostaJson(202, { mensagem: 'Se houver uma conta de nutricionista com esse e-mail, enviamos o link para ele.' }),
    });

    renderizarEm('/esqueci-senha', <EsqueciSenha />, '/esqueci-senha');
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@clinica.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }));

    expect(await screen.findByText(/Se houver uma conta/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar link' })).not.toBeInTheDocument();
    expect(JSON.parse(api.mock.calls[0][1]?.body as string)).toEqual({ email: 'ana@clinica.com' });
  });

  it('orienta o paciente a pedir um novo link ao nutricionista', () => {
    renderizarEm('/esqueci-senha', <EsqueciSenha />, '/esqueci-senha');
    expect(screen.getByText(/É paciente\? Peça ao seu nutricionista/)).toBeInTheDocument();
  });
});

describe('RedefinirSenha', () => {
  function abrirLink() {
    window.history.replaceState(null, '', `/redefinir-senha#${TOKEN_DO_LINK}`);
    return renderizarEm('/redefinir-senha', <RedefinirSenha />, '/redefinir-senha', {
      '/painel': 'Painel do nutricionista',
    });
  }

  async function preencher(senha: string, confirmacao = senha) {
    await userEvent.type(screen.getByLabelText('Nova senha'), senha);
    await userEvent.type(screen.getByLabelText('Repita a senha'), confirmacao);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar senha e entrar' }));
  }

  it('grava a senha nova com o token do link e entra no painel', async () => {
    const api = mockarApi({ 'POST /api/auth/redefinir-senha': () => respostaJson(200, SESSAO_DO_NUTRICIONISTA) });

    abrirLink();
    expect(window.location.hash).toBe('');
    await preencher('SenhaNova123');

    expect(await screen.findByText('Painel do nutricionista')).toBeInTheDocument();
    expect(JSON.parse(api.mock.calls[0][1]?.body as string)).toEqual({ token: TOKEN_DO_LINK, senha: 'SenhaNova123' });
  });

  it('barra senha sem números e senhas diferentes sem chamar o servidor', async () => {
    const api = mockarApi({});

    abrirLink();
    await preencher('somenteletras');
    expect(screen.getByText('Use letras e números na senha.')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Nova senha'));
    await userEvent.clear(screen.getByLabelText('Repita a senha'));
    await preencher('SenhaNova123', 'OutraSenha123');
    expect(screen.getByText('As senhas não conferem.')).toBeInTheDocument();

    expect(api).not.toHaveBeenCalled();
  });

  it('mostra o erro de link vencido vindo do backend', async () => {
    mockarApi({
      'POST /api/auth/redefinir-senha': () =>
        respostaJson(400, { code: 'E-27', message: 'Link de redefinição de senha inválido ou expirado. Peça um novo link.' }),
    });

    abrirLink();
    await preencher('SenhaNova123');

    expect(await screen.findByRole('alert')).toHaveTextContent('inválido ou expirado');
  });
});
