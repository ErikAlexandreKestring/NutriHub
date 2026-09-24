import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockarApi, renderizarEm, respostaJson, tokenCom } from '@/test/utils';
import { Cadastro } from '../Cadastro';
import { PrimeiroAcesso } from '../PrimeiroAcesso';

const TOKEN_DE_ACESSO = 'b'.repeat(64);

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Cadastro (RF-01)', () => {
  it('cria a conta, inicia a sessão e leva à lista de pacientes', async () => {
    const api = mockarApi({
      'POST /api/auth/register': () =>
        respostaJson(201, {
          token: tokenCom('nutricionista'),
          role: 'nutricionista',
          tenant: { id: 't1', nome: 'Ana Nutri', email: 'ana@clinica.com', crn: 'CRN-10 1234' },
        }),
    });

    renderizarEm('/cadastro', <Cadastro />, '/cadastro', { '/pacientes': 'Lista de pacientes' });
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Ana Nutri');
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@clinica.com');
    await userEvent.type(screen.getByLabelText('CRN'), 'CRN-10 1234');
    await userEvent.type(screen.getByLabelText('Senha'), 'SenhaForte123');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Lista de pacientes')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('nutrihub.sessao') ?? '{}').papel).toBe('nutricionista');
    expect(JSON.parse(api.mock.calls[0][1]?.body as string)).toEqual({
      nome: 'Ana Nutri',
      email: 'ana@clinica.com',
      crn: 'CRN-10 1234',
      senha: 'SenhaForte123',
    });
  });

  it('aponta o campo recusado pelo backend', async () => {
    mockarApi({
      'POST /api/auth/register': () =>
        respostaJson(400, {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          issues: [{ path: 'crn', message: 'CRN inválido' }],
        }),
    });

    renderizarEm('/cadastro', <Cadastro />, '/cadastro');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('CRN inválido')).toBeInTheDocument();
    expect(screen.getByLabelText('CRN')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('PrimeiroAcesso (RF-02)', () => {
  function abrirLink(token = TOKEN_DE_ACESSO) {
    window.history.replaceState(null, '', `/primeiro-acesso#${token}`);
    return renderizarEm('/primeiro-acesso', <PrimeiroAcesso />, '/primeiro-acesso', {
      '/meu-plano': 'Plano do paciente',
    });
  }

  it('define a senha com o token do link e entra como paciente', async () => {
    const api = mockarApi({
      'POST /api/auth/patient/definir-senha': () =>
        respostaJson(200, {
          token: tokenCom('paciente'),
          role: 'paciente',
          patient: { id: 'p1', nome: 'João Silva', email: 'joao@nutrihub.com' },
        }),
    });

    abrirLink();
    // O token sai da barra de endereço assim que é lido.
    expect(window.location.hash).toBe('');

    await userEvent.type(screen.getByLabelText('Nova senha'), 'SenhaForte123');
    await userEvent.type(screen.getByLabelText('Repita a senha'), 'SenhaForte123');
    await userEvent.click(screen.getByRole('button', { name: 'Criar senha e entrar' }));

    expect(await screen.findByText('Plano do paciente')).toBeInTheDocument();
    expect(JSON.parse(api.mock.calls[0][1]?.body as string)).toEqual({
      token: TOKEN_DE_ACESSO,
      senha: 'SenhaForte123',
    });
  });

  it('barra senhas diferentes sem chamar o servidor', async () => {
    const api = mockarApi({});

    abrirLink();
    await userEvent.type(screen.getByLabelText('Nova senha'), 'SenhaForte123');
    await userEvent.type(screen.getByLabelText('Repita a senha'), 'OutraSenha123');
    await userEvent.click(screen.getByRole('button', { name: 'Criar senha e entrar' }));

    expect(screen.getByText('As senhas não conferem.')).toBeInTheDocument();
    expect(screen.getByLabelText('Repita a senha')).toHaveFocus();
    expect(api).not.toHaveBeenCalled();
  });

  it('mostra o erro de link expirado vindo do backend', async () => {
    mockarApi({
      'POST /api/auth/patient/definir-senha': () =>
        respostaJson(400, {
          code: 'E-21',
          message: 'Link de primeiro acesso inválido ou expirado. Solicite um novo ao seu nutricionista.',
        }),
    });

    abrirLink();
    await userEvent.type(screen.getByLabelText('Nova senha'), 'SenhaForte123');
    await userEvent.type(screen.getByLabelText('Repita a senha'), 'SenhaForte123');
    await userEvent.click(screen.getByRole('button', { name: 'Criar senha e entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('inválido ou expirado');
  });

  it('explica o problema quando o link chega sem token', () => {
    window.history.replaceState(null, '', '/primeiro-acesso');
    renderizarEm('/primeiro-acesso', <PrimeiroAcesso />, '/primeiro-acesso');

    expect(screen.getByText('Link incompleto')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
  });
});
