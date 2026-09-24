import { chamarApi } from '@/lib/api';
import type { DadosDoPaciente, Paciente, TokenDeAcesso } from './tipos';

/** RF-03. Todas as rotas são exclusivas do nutricionista no backend. */
export function listarPacientes(sinal?: AbortSignal): Promise<Paciente[]> {
  return chamarApi<Paciente[]>('/patients', { sinal });
}

export function buscarPaciente(id: string, sinal?: AbortSignal): Promise<Paciente> {
  return chamarApi<Paciente>(`/patients/${id}`, { sinal });
}

export function criarPaciente(dados: DadosDoPaciente): Promise<Paciente> {
  return chamarApi<Paciente>('/patients', { metodo: 'POST', corpo: dados });
}

/**
 * Na edição, campo opcional apagado vai como `null`: o backend guarda string
 * vazia tal como recebe, e "sem contato" precisa ser ausência, não "".
 */
export function atualizarPaciente(id: string, dados: DadosDoPaciente): Promise<Paciente> {
  return chamarApi<Paciente>(`/patients/${id}`, {
    metodo: 'PUT',
    corpo: {
      ...dados,
      contato: dados.contato.trim() || null,
      historico: dados.historico.trim() || null,
    },
  });
}

/** RF-03: "inativar" — o backend só troca o status, nada é apagado. */
export function inativarPaciente(id: string): Promise<Paciente> {
  return chamarApi<Paciente>(`/patients/${id}`, { metodo: 'DELETE' });
}

/** RF-02: gera (ou regenera, invalidando o anterior) o token de primeiro acesso. */
export function gerarTokenDeAcesso(id: string): Promise<TokenDeAcesso> {
  return chamarApi<TokenDeAcesso>(`/patients/${id}/access-token`, { metodo: 'POST' });
}

/**
 * O token vai no fragmento (#), e não na query string: o fragmento não é
 * enviado ao servidor, então não fica gravado em log de acesso do host
 * estático nem de proxy no caminho. Quem lê é só a tela de primeiro acesso.
 */
export function linkDePrimeiroAcesso(token: string, origem = window.location.origin): string {
  return `${origem}/primeiro-acesso#${token}`;
}
