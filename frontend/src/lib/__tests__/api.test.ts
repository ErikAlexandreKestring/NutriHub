import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aoExpirarSessao, chamarApi, definirTokenDaApi, ErroDaApi, ErroDeRede } from '../api';

function resposta(status: number, corpo: unknown, tipo = 'application/json') {
  return new Response(corpo === null ? null : JSON.stringify(corpo), {
    status,
    headers: corpo === null ? {} : { 'content-type': tipo },
  });
}

describe('chamarApi', () => {
  beforeEach(() => {
    definirTokenDaApi(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefixa /api e envia o token como Bearer', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta(200, { ok: true }));
    vi.stubGlobal('fetch', fetchFalso);
    definirTokenDaApi('abc.def.ghi');

    await chamarApi('/patients');

    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toBe('/api/patients');
    expect((opcoes.headers as Record<string, string>).Authorization).toBe('Bearer abc.def.ghi');
  });

  it('não manda o token em rota pública', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta(200, { ok: true }));
    vi.stubGlobal('fetch', fetchFalso);
    definirTokenDaApi('abc.def.ghi');

    await chamarApi('/auth/login', { metodo: 'POST', corpo: {}, publica: true });

    expect((fetchFalso.mock.calls[0][1].headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('traduz o corpo de erro do backend em ErroDaApi', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(401, { code: 'E-04', message: 'E-mail ou senha inválidos' })));

    await expect(chamarApi('/auth/login', { publica: true })).rejects.toMatchObject({
      status: 401,
      codigo: 'E-04',
      message: 'E-mail ou senha inválidos',
    });
  });

  it('converte issues do Validator em problemas por campo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        resposta(400, {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          issues: [{ path: 'email', message: 'E-mail inválido' }],
        }),
      ),
    );

    const falha = await chamarApi('/auth/login', { publica: true }).catch((e) => e as ErroDaApi);
    expect(falha).toBeInstanceOf(ErroDaApi);
    expect((falha as ErroDaApi).problemas).toEqual([{ campo: 'email', mensagem: 'E-mail inválido' }]);
  });

  it('avisa os ouvintes quando um 401 chega em rota autenticada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(401, { code: 'UNAUTHORIZED', message: 'Token inválido' })));
    const ouvinte = vi.fn();
    const cancelar = aoExpirarSessao(ouvinte);

    await chamarApi('/patients').catch(() => undefined);

    expect(ouvinte).toHaveBeenCalledTimes(1);
    cancelar();
  });

  it('não trata 401 de rota pública como sessão expirada', async () => {
    // Senha errada no login não pode derrubar a própria tela de login.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(401, { code: 'E-04', message: 'E-mail ou senha inválidos' })));
    const ouvinte = vi.fn();
    const cancelar = aoExpirarSessao(ouvinte);

    await chamarApi('/auth/login', { publica: true }).catch(() => undefined);

    expect(ouvinte).not.toHaveBeenCalled();
    cancelar();
  });

  it('transforma falha de rede em ErroDeRede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(chamarApi('/patients')).rejects.toBeInstanceOf(ErroDeRede);
  });

  it('propaga o AbortError em vez de mascarar como falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError')));

    await expect(chamarApi('/patients')).rejects.toBeInstanceOf(DOMException);
  });

  it('não tenta ler JSON de uma resposta que não é JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(404, '<html>404</html>', 'text/html')));

    await expect(chamarApi('/rota-inexistente')).rejects.toMatchObject({ status: 404, codigo: 'ERRO' });
  });
});
