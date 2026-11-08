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
  function renderizar() {
    return renderizarEm('/cadastro', <Cadastro />, '/cadastro', { '/painel': 'Painel do nutricionista' });
  }

  async function preencher(sobrescritas: Partial<Record<'nome' | 'email' | 'crn' | 'celular' | 'senha', string>> = {}) {
    const valores = {
      nome: 'Ana Nutri',
      email: 'ana@clinica.com',
      crn: 'CRN-10 1234',
      celular: '(47) 99999-0000',
      senha: 'SenhaForte123',
      ...sobrescritas,
    };
    await userEvent.type(screen.getByLabelText('Nome completo'), valores.nome);
    await userEvent.type(screen.getByLabelText('E-mail'), valores.email);
    await userEvent.type(screen.getByLabelText('CRN'), valores.crn);
    await userEvent.type(screen.getByLabelText('Celular com WhatsApp'), valores.celular);
    await userEvent.type(screen.getByLabelText('Senha'), valores.senha);
  }

  it('cria a conta sem entrar e pede para confirmar o e-mail', async () => {
    const api = mockarApi({
      'POST /api/auth/register': () => respostaJson(201, { email: 'ana@clinica.com', confirmacao_pendente: true }),
    });

    renderizar();
    await preencher({ crn: 'crn10 1234', celular: '47999990000' });
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('heading', { name: 'Confirme seu e-mail' })).toBeInTheDocument();
    expect(screen.getByText('ana@clinica.com')).toBeInTheDocument();
    // Sem sessão: a conta só entra depois do link.
    expect(localStorage.getItem('nutrihub.sessao')).toBeNull();
    expect(screen.queryByText('Painel do nutricionista')).not.toBeInTheDocument();
    // O CRN sai normalizado e o celular com a máscara.
    expect(JSON.parse(api.mock.calls[0][1]?.body as string)).toEqual({
      nome: 'Ana Nutri',
      email: 'ana@clinica.com',
      crn: 'CRN-10 1234',
      telefone: '(47) 99999-0000',
      senha: 'SenhaForte123',
    });
  });

  it('reenvia o e-mail de confirmação pela tela de "confirme seu e-mail"', async () => {
    const api = mockarApi({
      'POST /api/auth/register': () => respostaJson(201, { email: 'ana@clinica.com', confirmacao_pendente: true }),
      'POST /api/auth/reenviar-confirmacao': () => respostaJson(202, { mensagem: 'ok' }),
    });

    renderizar();
    await preencher();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reenviar e-mail de confirmação' }));

    expect(await screen.findByRole('button', { name: 'E-mail reenviado' })).toBeDisabled();
    expect(JSON.parse(api.mock.calls[1][1]?.body as string)).toEqual({ email: 'ana@clinica.com' });
  });

  it('não envia o formulário vazio e aponta cada campo, com foco no primeiro', async () => {
    const api = mockarApi({});

    renderizar();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByText('Informe seu nome completo.')).toBeInTheDocument();
    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Informe seu CRN.')).toBeInTheDocument();
    expect(screen.getByText('Informe o celular com WhatsApp.')).toBeInTheDocument();
    expect(screen.getByText('Crie uma senha.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome completo')).toHaveFocus();
    expect(api).not.toHaveBeenCalled();
  });

  it('acusa o e-mail sem @ ao sair do campo', async () => {
    renderizar();
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana.clinica.com');
    await userEvent.tab();

    expect(screen.getByText('O e-mail precisa ter @, ex.: nome@clinica.com')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
  });

  it('tira o erro assim que o valor fica certo', async () => {
    renderizar();
    const email = screen.getByLabelText('E-mail');
    await userEvent.type(email, 'ana');
    await userEvent.tab();
    expect(screen.getByText('O e-mail precisa ter @, ex.: nome@clinica.com')).toBeInTheDocument();

    await userEvent.type(email, '@clinica.com');

    expect(screen.queryByText(/O e-mail precisa ter @/)).not.toBeInTheDocument();
    expect(email).not.toHaveAttribute('aria-invalid');
  });

  it('recusa região de CRN que não existe e normaliza o CRN válido', async () => {
    renderizar();
    const crn = screen.getByLabelText('CRN');
    await userEvent.type(crn, 'CRN-20 10458');
    await userEvent.tab();
    expect(screen.getByText('Região do CRN inválida: os conselhos vão do CRN-1 ao CRN-11.')).toBeInTheDocument();

    await userEvent.clear(crn);
    await userEvent.type(crn, 'crn 3/4567');
    await userEvent.tab();
    expect(crn).toHaveValue('CRN-3 4567');
    expect(screen.queryByText(/Região do CRN/)).not.toBeInTheDocument();
  });

  it('formata o celular enquanto digita e acusa número incompleto ou fixo', async () => {
    renderizar();
    const celular = screen.getByLabelText('Celular com WhatsApp');
    await userEvent.type(celular, '4799999');
    expect(celular).toHaveValue('(47) 99999');
    await userEvent.tab();
    expect(screen.getByText(/Celular incompleto/)).toBeInTheDocument();

    await userEvent.clear(celular);
    await userEvent.type(celular, '4733334444');
    await userEvent.type(celular, '5');
    await userEvent.tab();
    expect(celular).toHaveValue('(47) 33334-4445');
    expect(screen.getByText('Informe um celular: depois do DDD, o número começa com 9.')).toBeInTheDocument();
  });

  it('pede letras e números na senha e nome com sobrenome', async () => {
    const api = mockarApi({});

    renderizar();
    await preencher({ nome: 'Ana', senha: '12345678' });
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(screen.getByText('Informe nome e sobrenome.')).toBeInTheDocument();
    expect(screen.getByText('Use letras e números na senha.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it('aponta o campo recusado pelo backend', async () => {
    mockarApi({
      'POST /api/auth/register': () =>
        respostaJson(409, {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          issues: [{ path: 'email', message: 'E-mail já cadastrado' }],
        }),
    });

    renderizar();
    await preencher();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('E-mail já cadastrado')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
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
