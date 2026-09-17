import { definirTokenDaApi } from '@/lib/api';

export type Papel = 'nutricionista' | 'paciente';

/** O que o POST /api/auth/login devolve, nas duas formas possíveis. */
export type RespostaDeLogin =
  | { token: string; role: 'nutricionista'; tenant: { id: string; nome: string; email: string; crn: string } }
  | { token: string; role: 'paciente'; patient: { id: string; nome: string; email: string } };

export interface Sessao {
  token: string;
  papel: Papel;
  usuarioId: string;
  nome: string;
  email: string;
  /** `exp` do JWT em milissegundos. */
  expiraEm: number;
}

const CHAVE = 'nutrihub.sessao';

/**
 * Lê o `exp` do JWT sem verificar a assinatura — quem valida o token é o
 * backend. Aqui isso serve só para não abrir a aplicação com uma sessão que já
 * morreu e cair num 401 na primeira tela.
 */
function lerExpiracao(token: string): number | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  try {
    // base64url → base64 antes do atob, que não aceita `-` nem `_`.
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(base64));
    const exp = (payload as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function sessaoDaResposta(resposta: RespostaDeLogin): Sessao | null {
  const expiraEm = lerExpiracao(resposta.token);
  if (expiraEm === null) return null;

  const usuario = resposta.role === 'nutricionista' ? resposta.tenant : resposta.patient;

  return {
    token: resposta.token,
    papel: resposta.role,
    usuarioId: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    expiraEm,
  };
}

/**
 * O backend emite um Bearer JWT sem refresh e sem cookie httpOnly, então o
 * token precisa ficar em algum armazenamento do browser e fica exposto a XSS.
 * `localStorage` (e não `sessionStorage`) porque a RNF-07 pede PWA instalável:
 * o paciente fecha e reabre o app, e o token dele vale 24h. Trocar isso por
 * cookie httpOnly é mudança no backend, não aqui.
 */
export function lerSessaoSalva(): Sessao | null {
  let bruto: string | null;
  try {
    bruto = localStorage.getItem(CHAVE);
  } catch {
    // Modo privado ou storage bloqueado: a aplicação segue sem sessão salva.
    return null;
  }
  if (!bruto) return null;

  try {
    const dados = JSON.parse(bruto) as Sessao;
    if (typeof dados?.token !== 'string' || typeof dados?.expiraEm !== 'number') {
      return null;
    }
    // Token já vencido não vale a pena restaurar — renderizaria a aplicação
    // logada só para tomar 401 na primeira requisição.
    if (dados.expiraEm <= Date.now()) {
      salvarSessao(null);
      return null;
    }
    return dados;
  } catch {
    return null;
  }
}

export function salvarSessao(sessao: Sessao | null): void {
  definirTokenDaApi(sessao?.token ?? null);
  try {
    if (sessao) {
      localStorage.setItem(CHAVE, JSON.stringify(sessao));
    } else {
      localStorage.removeItem(CHAVE);
    }
  } catch {
    // Sem persistência a sessão vale só para esta aba; não é motivo para falhar.
  }
}
