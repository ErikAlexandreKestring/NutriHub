import { useCallback, useRef, useState } from 'react';
import { ErroDaApi, ErroDeRede, type ProblemaDeCampo } from './api';

/** Mensagem legível para qualquer falha de chamada à API. */
export function mensagemDeFalha(falha: unknown, padrao: string): string {
  if (falha instanceof ErroDaApi || falha instanceof ErroDeRede) return falha.message;
  return padrao;
}

/**
 * O backend responde `issues: [{ path, message }]` e o `api.ts` já traduz isso
 * para `problemas`. Um `path` que não corresponde a nenhum input (ou um campo
 * que o backend venha a acrescentar) não pode sumir da tela, então o que sobra
 * continua indo para a faixa de erro geral.
 */
export function separarProblemas<C extends string>(
  campos: readonly C[],
  problemas: ProblemaDeCampo[],
): { porCampo: Partial<Record<C, string>>; restantes: string[] } {
  const porCampo: Partial<Record<C, string>> = {};
  const restantes: string[] = [];

  for (const problema of problemas) {
    const campo = problema.campo as C;
    if (campos.includes(campo) && !porCampo[campo]) {
      porCampo[campo] = problema.mensagem;
    } else {
      restantes.push(problema.mensagem);
    }
  }

  return { porCampo, restantes };
}

/**
 * Estado de erro de um formulário que envia para a API. `campos` vem na ordem
 * em que os inputs aparecem na tela — é ela que decide quem recebe o foco
 * quando há mais de um campo inválido (RNF-08: o erro pertence ao campo que o
 * causou, e quem navega por teclado precisa ser levado até ele).
 *
 * Os nomes dos campos são os mesmos do corpo enviado ao backend (snake_case),
 * para que o `path` de cada problema case direto com o input.
 */
export function useErrosDeFormulario<C extends string>(campos: readonly C[]) {
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosPorCampo, setErrosPorCampo] = useState<Partial<Record<C, string>>>({});
  const elementos = useRef<Partial<Record<C, HTMLElement | null>>>({});

  /** Callback ref para o input de cada campo. */
  const registrar = useCallback(
    (campo: C) => (elemento: HTMLElement | null) => {
      elementos.current[campo] = elemento;
    },
    [],
  );

  const limpar = useCallback(() => {
    setErroGeral(null);
    setErrosPorCampo({});
  }, []);

  const focarPrimeiro = useCallback(
    (porCampo: Partial<Record<C, string>>) => {
      const primeiro = campos.find((campo) => porCampo[campo]);
      if (primeiro) elementos.current[primeiro]?.focus();
    },
    [campos],
  );

  /** Para validações feitas no próprio cliente (ex.: confirmação de senha). */
  const definirErrosDeCampo = useCallback(
    (porCampo: Partial<Record<C, string>>) => {
      setErrosPorCampo(porCampo);
      focarPrimeiro(porCampo);
    },
    [focarPrimeiro],
  );

  const tratarFalha = useCallback(
    (falha: unknown, padrao: string) => {
      if (falha instanceof ErroDaApi && falha.problemas?.length) {
        const { porCampo, restantes } = separarProblemas(campos, falha.problemas);
        setErrosPorCampo(porCampo);
        // Sai aqui mesmo quando nenhum problema casou com um campo da tela:
        // cair no `falha.message` trocaria "CRN inválido" pelo "Dados
        // inválidos" genérico do backend.
        setErroGeral(restantes.length > 0 ? restantes.join(' ') : null);
        focarPrimeiro(porCampo);
        return;
      }

      setErroGeral(mensagemDeFalha(falha, padrao));
    },
    [campos, focarPrimeiro],
  );

  return { erroGeral, errosPorCampo, registrar, limpar, tratarFalha, definirErrosDeCampo };
}
