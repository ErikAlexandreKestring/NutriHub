import { createContext } from 'react';
import type { Sessao } from './sessao';

export interface DadosDeCadastro {
  nome: string;
  email: string;
  crn: string;
  senha: string;
}

export interface ContextoDeSessao {
  sessao: Sessao | null;
  entrar: (email: string, senha: string) => Promise<Sessao>;
  /** RF-01: cria a conta do nutricionista (e o tenant) e já entra. */
  cadastrar: (dados: DadosDeCadastro) => Promise<Sessao>;
  /** RF-02: primeiro acesso do paciente — troca o token do link pela senha. */
  definirSenhaInicial: (token: string, senha: string) => Promise<Sessao>;
  sair: () => void;
  /** True quando a sessão caiu sozinha (token expirado ou revogado). */
  expirou: boolean;
}

// Em arquivo próprio (e não junto do provider) por causa do react-refresh:
// um módulo que exporta componente e não-componente perde o hot reload.
export const SessaoContext = createContext<ContextoDeSessao | null>(null);
