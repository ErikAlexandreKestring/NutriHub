import { useCallback, useEffect, useRef, useState } from 'react';
import { ErroDaApi } from './api';
import { mensagemDeFalha } from './useErrosDeFormulario';

export type EstadoDoRecurso<T> =
  | { situacao: 'carregando' }
  | { situacao: 'pronto'; dados: T }
  /** `status` permite à tela tratar 404 como "não existe" em vez de falha. */
  | { situacao: 'erro'; mensagem: string; status?: number };

function ehCancelamento(falha: unknown): boolean {
  return falha instanceof DOMException && falha.name === 'AbortError';
}

/**
 * Carrega um recurso da API quando `chave` muda. A chave (e não a função) é o
 * que dispara a busca: a função costuma ser uma arrow nova a cada render, e
 * colocá-la nas dependências do efeito buscaria de novo a cada render.
 *
 * `chave` nula adia a busca — útil quando o id ainda não está disponível e as
 * regras dos hooks não permitem chamar o hook condicionalmente.
 */
export function useRecurso<T>(chave: string | null, carregar: (sinal: AbortSignal) => Promise<T>) {
  const [estado, setEstado] = useState<EstadoDoRecurso<T>>({ situacao: 'carregando' });
  const carregarAtual = useRef(carregar);
  carregarAtual.current = carregar;

  useEffect(() => {
    if (chave === null) return;

    // Sem o abort, trocar de recurso (ou desmontar durante a requisição)
    // deixaria a resposta antiga chegar depois e sobrescrever a nova.
    const controlador = new AbortController();
    setEstado({ situacao: 'carregando' });

    carregarAtual
      .current(controlador.signal)
      .then((dados) => setEstado({ situacao: 'pronto', dados }))
      .catch((falha: unknown) => {
        if (ehCancelamento(falha)) return;
        setEstado({
          situacao: 'erro',
          mensagem: mensagemDeFalha(falha, 'Não foi possível carregar os dados.'),
          status: falha instanceof ErroDaApi ? falha.status : undefined,
        });
      });

    return () => controlador.abort();
  }, [chave]);

  /**
   * Busca de novo SEM voltar para "carregando": depois de uma ação na tela (ex.:
   * adicionar um alimento), apagar tudo e mostrar um spinner faria a página
   * pular e o foco se perder. Os dados antigos ficam até os novos chegarem.
   * Uma falha aqui é repassada a quem chamou, que decide como mostrá-la.
   */
  const atualizar = useCallback(async () => {
    const dados = await carregarAtual.current(new AbortController().signal);
    setEstado({ situacao: 'pronto', dados });
  }, []);

  /** Para ações cuja resposta já traz o recurso atualizado. */
  const definirDados = useCallback((dados: T) => setEstado({ situacao: 'pronto', dados }), []);

  return { estado, atualizar, definirDados };
}
