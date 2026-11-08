import { chamarApi } from '@/lib/api';

/** Resposta igual para qualquer e-mail: o backend não revela quem tem conta. */
export interface RespostaDeEnvio {
  mensagem: string;
}

/** Manda de novo o link de confirmação do cadastro do nutricionista. */
export function reenviarConfirmacao(email: string): Promise<RespostaDeEnvio> {
  return chamarApi<RespostaDeEnvio>('/auth/reenviar-confirmacao', { metodo: 'POST', corpo: { email }, publica: true });
}

/** "Esqueci minha senha" do nutricionista: manda o link de redefinição. */
export function pedirRedefinicaoDeSenha(email: string): Promise<RespostaDeEnvio> {
  return chamarApi<RespostaDeEnvio>('/auth/esqueci-senha', { metodo: 'POST', corpo: { email }, publica: true });
}
