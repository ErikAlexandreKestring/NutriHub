import { createContext } from 'react';
import type { Sessao } from './sessao';

export interface DadosDeCadastro {
  nome: string;
  email: string;
  crn: string;
  /** RF-07: celular com WhatsApp; os pacientes falam com o nutricionista por ele. */
  telefone: string;
  senha: string;
}

export interface ContextoDeSessao {
  sessao: Sessao | null;
  entrar: (email: string, senha: string) => Promise<Sessao>;
  /**
   * RF-01: cria a conta do nutricionista (e o tenant). Não entra: a conta só
   * vale depois de o nutricionista abrir o link enviado para o e-mail.
   */
  cadastrar: (dados: DadosDeCadastro) => Promise<{ email: string }>;
  /** Abre o link de confirmação do cadastro e já entra. */
  confirmarEmail: (token: string) => Promise<Sessao>;
  /** Grava a senha nova a partir do link de "esqueci minha senha" e já entra. */
  redefinirSenha: (token: string, senha: string) => Promise<Sessao>;
  /** RF-02: primeiro acesso do paciente — troca o token do link pela senha. */
  definirSenhaInicial: (token: string, senha: string) => Promise<Sessao>;
  sair: () => void;
  /** True quando a sessão caiu sozinha (token expirado ou revogado). */
  expirou: boolean;
}

// Em arquivo próprio (e não junto do provider) por causa do react-refresh:
// um módulo que exporta componente e não-componente perde o hot reload.
export const SessaoContext = createContext<ContextoDeSessao | null>(null);
