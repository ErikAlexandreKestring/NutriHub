import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SessaoProvider } from '@/auth/SessaoProvider';
import { RotaProtegida } from '@/auth/RotaProtegida';
import { Login } from '../Login';

function tokenCom(papel: 'nutricionista' | 'paciente') {
  const payload = btoa(JSON.stringify({ role: papel, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `cabecalho.${payload}.assinatura`;
}

function respostaJson(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
}

function renderizar(rotaInicial = '/entrar') {
  return render(
    <MemoryRouter
      initialEntries={[rotaInicial]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <SessaoProvider>
        <Routes>
          <Route path="/entrar" element={<Login />} />
          <Route path="/painel" element={<p>Painel do nutricionista</p>} />
          <Route path="/meu-plano" element={<p>Plano do paciente</p>} />
          <Route element={<RotaProtegida papel="paciente" />}>
            <Route path="/meu-plano/refeicoes" element={<p>Refeições</p>} />
          </Route>
        </Routes>
      </SessaoProvider>
    </MemoryRouter>,
  );
}

describe('Login (RF-02)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('associa cada rótulo ao seu campo', () => {
    renderizar();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  });

  it('leva o nutricionista ao painel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respostaJson(200, {
          token: tokenCom('nutricionista'),
          role: 'nutricionista',
          tenant: { id: 't1', nome: 'Ana', email: 'ana@clinica.com', crn: 'CRN-1234' },
        }),
      ),
    );

    renderizar();
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@clinica.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-secreta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Painel do nutricionista')).toBeInTheDocument();
  });

  it('leva o paciente ao plano, e não ao painel', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respostaJson(200, {
          token: tokenCom('paciente'),
          role: 'paciente',
          patient: { id: 'p1', nome: 'João', email: 'joao@email.com' },
        }),
      ),
    );

    renderizar();
    await userEvent.type(screen.getByLabelText('E-mail'), 'joao@email.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-secreta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Plano do paciente')).toBeInTheDocument();
  });

  it('mostra a mensagem de E-04 e mantém o usuário na tela', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respostaJson(401, { code: 'E-04', message: 'E-mail ou senha inválidos' })),
    );

    renderizar();
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@clinica.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'errada');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos');
    // O botão precisa voltar a funcionar: travado em "Entrando…" o usuário
    // não teria como corrigir a senha.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled());
  });

  it('avisa quando o servidor está fora do ar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    renderizar();
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@clinica.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-secreta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique sua conexão');
  });

  // Revisão do PR #6: o api.ts já extraía `problemas` e o Campo já tinha a prop
  // `erro`, mas nada ligava os dois — um 400 de validação virava faixa genérica.
  describe('erros de validação por campo (RNF-08)', () => {
    function respostaDeValidacao(issues: Array<{ path: string; message: string }>) {
      return respostaJson(400, { code: 'VALIDATION_ERROR', message: 'Dados inválidos', issues });
    }

    it('mostra a mensagem no campo que a causou', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(respostaDeValidacao([{ path: 'email', message: 'E-mail inválido' }])),
      );

      renderizar();
      await userEvent.type(screen.getByLabelText('E-mail'), 'invalido');
      await userEvent.type(screen.getByLabelText('Senha'), 'senha-secreta');
      await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

      const campo = await screen.findByLabelText('E-mail');
      await waitFor(() => expect(campo).toHaveAttribute('aria-invalid', 'true'));
      expect(campo).toHaveAccessibleDescription('E-mail inválido');
    });

    it('foca o primeiro campo inválido na ordem do formulário', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          respostaDeValidacao([
            { path: 'senha', message: 'Senha é obrigatória' },
            { path: 'email', message: 'E-mail inválido' },
          ]),
        ),
      );

      renderizar();
      await userEvent.type(screen.getByLabelText('E-mail'), 'invalido');
      await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

      // O e-mail vem antes na tela, mesmo tendo vindo depois na resposta.
      await waitFor(() => expect(screen.getByLabelText('E-mail')).toHaveFocus());
    });

    it('não engole problema de campo que não existe no formulário', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(respostaDeValidacao([{ path: 'crn', message: 'CRN inválido' }])),
      );

      renderizar();
      await userEvent.type(screen.getByLabelText('E-mail'), 'ana@clinica.com');
      await userEvent.type(screen.getByLabelText('Senha'), 'senha-secreta');
      await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('CRN inválido');
    });

    it('limpa os erros de campo a cada novo envio', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(respostaDeValidacao([{ path: 'email', message: 'E-mail inválido' }]))
        .mockResolvedValueOnce(respostaJson(401, { code: 'E-04', message: 'E-mail ou senha inválidos' }));
      vi.stubGlobal('fetch', fetchMock);

      renderizar();
      await userEvent.type(screen.getByLabelText('E-mail'), 'invalido');
      await userEvent.type(screen.getByLabelText('Senha'), 'senha-secreta');
      await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
      await waitFor(() => expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true'));

      await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

      await waitFor(() => expect(screen.getByLabelText('E-mail')).not.toHaveAttribute('aria-invalid', 'true'));
    });
  });

  it('manda quem não está autenticado de volta para o login', async () => {
    renderizar('/meu-plano/refeicoes');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });
});
