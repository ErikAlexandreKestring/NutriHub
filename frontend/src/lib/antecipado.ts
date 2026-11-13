/**
 * RNF-04: o `index.html` dispara o pedido do plano do paciente antes de o JS do
 * app chegar (veja o script no <head>). Aqui o app pega essa resposta, uma vez
 * só, no lugar de fazer o mesmo pedido de novo.
 */
interface PedidoAntecipado {
  rota: string;
  resposta: Promise<Response>;
}

declare global {
  interface Window {
    __nutrihubAntecipado?: PedidoAntecipado;
  }
}

/**
 * Devolve a resposta antecipada se ela for desta rota, e a descarta: o corpo de
 * uma Response só pode ser lido uma vez, e um segundo pedido (outra visita à
 * tela, por exemplo) precisa de dados novos.
 */
export function pegarRespostaAntecipada(rota: string): Promise<Response> | null {
  const pedido = window.__nutrihubAntecipado;
  if (!pedido || pedido.rota !== rota) return null;
  delete window.__nutrihubAntecipado;
  return pedido.resposta;
}
