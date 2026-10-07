/**
 * RF-07: converte o telefone digitado no cadastro para o formato que a
 * WhatsApp Cloud API espera no campo `to` — só dígitos, com o DDI.
 *
 * O campo `contato` do paciente é texto livre, então a conversão é tolerante a
 * máscara ("(47) 99999-0000") e devolve null quando não dá para ter certeza
 * do número: melhor não mandar WhatsApp do que mandar para a pessoa errada.
 *
 *   - com "+" na frente: já vem com DDI, de qualquer país;
 *   - 10 ou 11 dígitos: DDD + número brasileiro, recebe o 55;
 *   - 12 ou 13 dígitos começando com 55: brasileiro já com DDI.
 */
export function toWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');

  if (raw.trim().startsWith('+')) {
    return digits.length >= 10 && digits.length <= 15 ? digits : null;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }
  return null;
}
