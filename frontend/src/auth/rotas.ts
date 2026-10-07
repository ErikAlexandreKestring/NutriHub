import type { Papel } from './sessao';

/** Para onde cada papel vai depois de entrar — e quando erra a área. */
export const INICIO_POR_PAPEL: Record<Papel, string> = {
  // RF-10: o painel é a tela de entrada do nutricionista.
  nutricionista: '/painel',
  paciente: '/meu-plano',
};
