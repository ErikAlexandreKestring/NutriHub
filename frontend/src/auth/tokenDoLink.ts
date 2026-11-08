/**
 * Os links enviados ao usuário (primeiro acesso do paciente, confirmação de
 * e-mail e redefinição de senha do nutricionista) trazem o token no fragmento
 * (#): ele não vai para o servidor nem fica nos logs de acesso.
 *
 * Leitura pura: o StrictMode chama o inicializador do useState duas vezes, e
 * apagar o fragmento aqui fazia a segunda chamada não achar mais o token.
 */
export function lerTokenDoLink(): string {
  return window.location.hash.replace(/^#/, '');
}

/** Tira o token da barra de endereço para não ficar no histórico do navegador. */
export function apagarTokenDaBarra(): void {
  if (window.location.hash) {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
}
