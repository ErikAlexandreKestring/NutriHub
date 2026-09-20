import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessaoProvider } from '../SessaoProvider';
import { CHAVE_DA_SESSAO } from '../sessao';
import { useSessao } from '../useSessao';

function tokenValido() {
  const payload = btoa(JSON.stringify({ role: 'paciente', exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `cabecalho.${payload}.assinatura`;
}

function sessaoSalva() {
  return {
    token: tokenValido(),
    papel: 'paciente' as const,
    usuarioId: 'p1',
    nome: 'João Silva',
    email: 'joao@email.com',
    expiraEm: Date.now() + 3_600_000,
  };
}

function Sonda() {
  const { sessao, sair, expirou } = useSessao();
  return (
    <div>
      <p>{sessao ? `Autenticado: ${sessao.nome}` : 'Sem sessão'}</p>
      {expirou && <p>Sessão expirada</p>}
      <button onClick={sair}>Sair</button>
    </div>
  );
}

/**
 * O evento `storage` só dispara nas outras abas, nunca na que escreveu. O jsdom
 * não simula isso, então o teste escreve no storage e emite o evento à mão —
 * que é exatamente o que o navegador entrega à segunda aba.
 */
function simularOutraAba(novoValor: string | null) {
  if (novoValor === null) {
    localStorage.removeItem(CHAVE_DA_SESSAO);
  } else {
    localStorage.setItem(CHAVE_DA_SESSAO, novoValor);
  }

  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: CHAVE_DA_SESSAO, newValue: novoValor }));
  });
}

describe('SessaoProvider — sincronização entre abas', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderizar() {
    return render(
      <SessaoProvider>
        <Sonda />
      </SessaoProvider>,
    );
  }

  // O ponto levantado na revisão do PR #6: num dispositivo compartilhado, sair
  // numa aba precisa encerrar a sessão em todas — o plano alimentar é dado de
  // saúde e não pode seguir na tela da outra aba até o token vencer sozinho.
  it('derruba a sessão quando outra aba faz logout', async () => {
    localStorage.setItem(CHAVE_DA_SESSAO, JSON.stringify(sessaoSalva()));
    renderizar();
    expect(screen.getByText('Autenticado: João Silva')).toBeInTheDocument();

    simularOutraAba(null);

    expect(await screen.findByText('Sem sessão')).toBeInTheDocument();
  });

  it('não anuncia expiração quando a saída veio de outra aba', async () => {
    localStorage.setItem(CHAVE_DA_SESSAO, JSON.stringify(sessaoSalva()));
    renderizar();

    simularOutraAba(null);

    await screen.findByText('Sem sessão');
    // "Sua sessão expirou" seria mentira: o usuário clicou em Sair.
    expect(screen.queryByText('Sessão expirada')).not.toBeInTheDocument();
  });

  it('adota a sessão quando outra aba faz login', async () => {
    renderizar();
    expect(screen.getByText('Sem sessão')).toBeInTheDocument();

    simularOutraAba(JSON.stringify(sessaoSalva()));

    expect(await screen.findByText('Autenticado: João Silva')).toBeInTheDocument();
  });

  it('ignora mudanças em outras chaves do storage', () => {
    localStorage.setItem(CHAVE_DA_SESSAO, JSON.stringify(sessaoSalva()));
    renderizar();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'outra.coisa', newValue: 'x' }));
    });

    expect(screen.getByText('Autenticado: João Silva')).toBeInTheDocument();
  });

  it('encerra a sessão quando o storage inteiro é limpo', async () => {
    localStorage.setItem(CHAVE_DA_SESSAO, JSON.stringify(sessaoSalva()));
    renderizar();

    localStorage.clear();
    // `localStorage.clear()` chega como evento com `key` nulo.
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null }));
    });

    expect(await screen.findByText('Sem sessão')).toBeInTheDocument();
  });

  it('remove o ouvinte ao desmontar', () => {
    const remover = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderizar();

    unmount();

    expect(remover).toHaveBeenCalledWith('storage', expect.any(Function));
  });

  it('sair na própria aba continua encerrando a sessão', async () => {
    localStorage.setItem(CHAVE_DA_SESSAO, JSON.stringify(sessaoSalva()));
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(screen.getByText('Sem sessão')).toBeInTheDocument();
    expect(localStorage.getItem(CHAVE_DA_SESSAO)).toBeNull();
  });
});
