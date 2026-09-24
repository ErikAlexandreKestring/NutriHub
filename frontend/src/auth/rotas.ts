import type { Papel } from './sessao';

/** Para onde cada papel vai depois de entrar — e quando erra a área. */
export const INICIO_POR_PAPEL: Record<Papel, string> = {
  // Até o painel do RF-10 existir, a carteira de pacientes é a tela de entrada.
  nutricionista: '/pacientes',
  paciente: '/meu-plano',
};
