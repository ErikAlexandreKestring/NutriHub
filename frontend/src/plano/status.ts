import type { StatusDoPlano } from './tipos';

/** Rótulo e cor de cada status de plano, iguais em todas as telas. */
export const SELO_DO_STATUS: Record<StatusDoPlano, { rotulo: string; tom: 'neutro' | 'sucesso' | 'aviso' }> = {
  rascunho: { rotulo: 'Rascunho', tom: 'aviso' },
  ativo: { rotulo: 'Ativo', tom: 'sucesso' },
  encerrado: { rotulo: 'Encerrado', tom: 'neutro' },
};
