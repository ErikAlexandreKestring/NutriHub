import type { Papel } from './sessao';

/** Para onde cada papel vai depois de entrar — e quando erra a área. */
export const INICIO_POR_PAPEL: Record<Papel, string> = {
  nutricionista: '/painel',
  paciente: '/meu-plano',
};
