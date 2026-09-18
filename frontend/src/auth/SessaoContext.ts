import { createContext } from 'react';
import type { Sessao } from './sessao';

export interface ContextoDeSessao {
  sessao: Sessao | null;
  entrar: (email: string, senha: string) => Promise<Sessao>;
  sair: () => void;
  /** True quando a sessão caiu sozinha (token expirado ou revogado). */
  expirou: boolean;
}

// Em arquivo próprio (e não junto do provider) por causa do react-refresh:
// um módulo que exporta componente e não-componente perde o hot reload.
export const SessaoContext = createContext<ContextoDeSessao | null>(null);
