import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { aoExpirarSessao, chamarApi, definirTokenDaApi } from '@/lib/api';
import {
  CHAVE_DA_SESSAO,
  lerSessaoSalva,
  salvarSessao,
  sessaoDaResposta,
  type RespostaDeLogin,
  type Sessao,
} from './sessao';
import { SessaoContext } from './SessaoContext';

export function SessaoProvider({ children }: { children: ReactNode }) {
  // O estado inicial vem do storage de forma síncrona: se fosse num efeito, o
  // primeiro render mostraria a tela de login para quem já está autenticado.
  const [sessao, setSessao] = useState<Sessao | null>(() => {
    const salva = lerSessaoSalva();
    definirTokenDaApi(salva?.token ?? null);
    return salva;
  });
  const [expirou, setExpirou] = useState(false);

  const sair = useCallback(() => {
    salvarSessao(null);
    setSessao(null);
  }, []);

  // Qualquer 401 fora da tela de login significa token vencido ou inválido.
  useEffect(() => aoExpirarSessao(() => {
    setExpirou(true);
    sair();
  }), [sair]);

  /**
   * O `localStorage` é compartilhado entre as abas e o PWA instalado, mas o
   * `tokenAtual` de lib/api vive na memória de cada instância. Sem escutar o
   * evento `storage`, sair numa aba deixava a outra renderizando plano
   * alimentar até o token vencer sozinho — num dispositivo compartilhado,
   * "Sair" precisa valer para todas as instâncias abertas, não só para a atual.
   *
   * O evento só dispara nas OUTRAS abas, nunca na que fez a escrita, então não
   * há laço com o `sair()` local.
   */
  useEffect(() => {
    function aoMudarOStorage(evento: StorageEvent) {
      // `key` nulo é `localStorage.clear()`, que também leva a sessão embora.
      if (evento.key !== null && evento.key !== CHAVE_DA_SESSAO) return;

      // Reler em vez de confiar no `newValue` do evento reaproveita a validação
      // de formato e de expiração que já existe em `lerSessaoSalva`.
      const atual = lerSessaoSalva();
      definirTokenDaApi(atual?.token ?? null);
      setSessao(atual);

      // Sair em outra aba não é token expirado; mostrar "sua sessão expirou"
      // aqui seria falso. Entrar em outra aba também limpa o aviso.
      setExpirou(false);
    }

    window.addEventListener('storage', aoMudarOStorage);
    return () => window.removeEventListener('storage', aoMudarOStorage);
  }, []);

  // O token expira sozinho (8h nutricionista, 24h paciente). Sem este timer o
  // app ficaria com uma sessão morta na tela até a próxima requisição falhar.
  useEffect(() => {
    if (!sessao) return;

    const restante = sessao.expiraEm - Date.now();
    if (restante <= 0) {
      setExpirou(true);
      sair();
      return;
    }

    // setTimeout satura acima de ~24,8 dias; os tokens são bem menores, mas o
    // clamp evita um disparo imediato caso um `exp` absurdo chegue.
    const atraso = Math.min(restante, 2_147_483_647);
    const id = window.setTimeout(() => {
      setExpirou(true);
      sair();
    }, atraso);

    return () => window.clearTimeout(id);
  }, [sessao, sair]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const resposta = await chamarApi<RespostaDeLogin>('/auth/login', {
      metodo: 'POST',
      corpo: { email, senha },
      publica: true,
    });

    const nova = sessaoDaResposta(resposta);
    if (!nova) {
      throw new Error('Resposta de login inesperada do servidor.');
    }

    salvarSessao(nova);
    setExpirou(false);
    setSessao(nova);
    return nova;
  }, []);

  const valor = useMemo(() => ({ sessao, entrar, sair, expirou }), [sessao, entrar, sair, expirou]);

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}
