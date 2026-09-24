import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { SessaoProvider } from '@/auth/SessaoProvider';
import type { Papel } from '@/auth/sessao';

export function tokenCom(papel: Papel) {
  const payload = btoa(JSON.stringify({ role: papel, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `cabecalho.${payload}.assinatura`;
}

export function respostaJson(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
}

export function salvarSessaoDe(papel: Papel, usuarioId = papel === 'nutricionista' ? 'tenant-1' : 'patient-1') {
  localStorage.setItem(
    'nutrihub.sessao',
    JSON.stringify({
      token: tokenCom(papel),
      papel,
      usuarioId,
      nome: papel === 'nutricionista' ? 'Ana Nutri' : 'João Silva',
      email: `${papel}@nutrihub.com`,
      expiraEm: Date.now() + 3_600_000,
    }),
  );
}

type Manipulador = (corpo: unknown) => Response | Promise<Response>;

/**
 * Mock de `fetch` por rota: chaves no formato "MÉTODO /api/caminho". Rota não
 * mapeada falha alto, para que o teste não passe com uma chamada inesperada.
 * O corpo JSON já chega decodificado ao manipulador.
 */
export function mockarApi(rotas: Record<string, Manipulador>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada, init) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    const chave = `${init?.method ?? 'GET'} ${url}`;
    const manipulador = rotas[chave];
    if (!manipulador) throw new Error(`Rota não mockada: ${chave}`);
    const corpo = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    return manipulador(corpo);
  });
}

/**
 * Renderiza `elemento` em `caminho` (padrão de rota do react-router) a partir
 * de `rota`. `outras` registra destinos de navegação como texto simples, para
 * o teste verificar para onde a tela mandou o usuário.
 */
export function renderizarEm(
  caminho: string,
  elemento: ReactElement,
  rota: string,
  outras: Record<string, string> = {},
) {
  return render(
    <MemoryRouter initialEntries={[rota]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SessaoProvider>
        <Routes>
          <Route path={caminho} element={elemento} />
          {Object.entries(outras).map(([destino, texto]) => (
            <Route key={destino} path={destino} element={<p>{texto}</p>} />
          ))}
        </Routes>
      </SessaoProvider>
    </MemoryRouter>,
  );
}
