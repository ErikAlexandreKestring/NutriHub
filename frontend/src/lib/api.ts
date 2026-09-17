/**
 * Cliente HTTP único da aplicação. Concentra três coisas que não podem variar
 * de tela para tela: o prefixo `/api` (o Vite faz o proxy em dev e o Azure SWA
 * em produção, então nunca há URL absoluta no código), o cabeçalho `Bearer` e a
 * tradução da resposta de erro do backend.
 */

/** Formato de erro do errorHandler do backend: `{ code, message, issues? }`. */
export interface ProblemaDeCampo {
  campo: string;
  mensagem: string;
}

export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly problemas?: ProblemaDeCampo[],
  ) {
    super(mensagem);
    this.name = 'ErroDaApi';
  }
}

/** Falha de rede ou servidor fora do ar — distinta de uma resposta de erro. */
export class ErroDeRede extends Error {
  constructor() {
    super('Não foi possível falar com o servidor. Verifique sua conexão.');
    this.name = 'ErroDeRede';
  }
}

type Ouvinte = () => void;
const ouvintesDeSessaoExpirada = new Set<Ouvinte>();

/**
 * Um 401 pode chegar em qualquer requisição, inclusive fora de um componente
 * React. Quem cuida da sessão se inscreve aqui e limpa o estado, em vez de cada
 * chamada ter de tratar a expiração do token por conta própria.
 */
export function aoExpirarSessao(ouvinte: Ouvinte): () => void {
  ouvintesDeSessaoExpirada.add(ouvinte);
  return () => ouvintesDeSessaoExpirada.delete(ouvinte);
}

let tokenAtual: string | null = null;

export function definirTokenDaApi(token: string | null): void {
  tokenAtual = token;
}

interface Opcoes {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  corpo?: unknown;
  /** Rotas públicas (login, primeiro acesso) não devem mandar token. */
  publica?: boolean;
  sinal?: AbortSignal;
}

function extrairProblemas(corpo: Record<string, unknown>): ProblemaDeCampo[] | undefined {
  if (!Array.isArray(corpo.issues)) return undefined;

  return corpo.issues.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    // O Validator do backend emite `{ path, message }` (shared/validation/validator).
    const { path, message } = item as { path?: unknown; message?: unknown };
    if (typeof path !== 'string' || typeof message !== 'string') return [];
    return [{ campo: path, mensagem: message }];
  });
}

export async function chamarApi<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { metodo = 'GET', corpo, publica = false, sinal } = opcoes;

  const cabecalhos: Record<string, string> = {};
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (!publica && tokenAtual) cabecalhos.Authorization = `Bearer ${tokenAtual}`;

  let resposta: Response;
  try {
    resposta = await fetch(`/api${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: sinal,
    });
  } catch (erro) {
    // AbortError é cancelamento nosso (componente desmontou), não falha de rede.
    if (erro instanceof DOMException && erro.name === 'AbortError') throw erro;
    throw new ErroDeRede();
  }

  if (resposta.status === 204) {
    return undefined as T;
  }

  // Um proxy mal configurado ou uma rota inexistente devolvem HTML; sem esta
  // guarda o `json()` estoura com um erro de sintaxe que não diz nada.
  const conteudo = resposta.headers.get('content-type') ?? '';
  const temJson = conteudo.includes('application/json');
  const dados: unknown = temJson ? await resposta.json() : null;

  if (!resposta.ok) {
    const corpoErro = (typeof dados === 'object' && dados !== null ? dados : {}) as Record<string, unknown>;
    const mensagem =
      typeof corpoErro.message === 'string' ? corpoErro.message : 'Não foi possível concluir a operação.';
    const codigo = typeof corpoErro.code === 'string' ? corpoErro.code : 'ERRO';

    // 401 em rota pública é credencial errada (E-04), não sessão expirada —
    // avisar os ouvintes aqui derrubaria a tela de login a cada senha errada.
    if (resposta.status === 401 && !publica) {
      ouvintesDeSessaoExpirada.forEach((ouvinte) => ouvinte());
    }

    throw new ErroDaApi(resposta.status, codigo, mensagem, extrairProblemas(corpoErro));
  }

  return dados as T;
}
