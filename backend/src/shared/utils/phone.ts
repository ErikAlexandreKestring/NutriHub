/**
 * RF-07: converte o telefone digitado no cadastro para o formato do link
 * direto do WhatsApp (https://wa.me/<numero>) — só dígitos, com o DDI.
 *
 * O número chega como o nutricionista digitou, então a conversão é tolerante a
 * máscara ("(47) 99999-0000") e devolve null quando não dá para ter certeza
 * do número: melhor esconder o botão do WhatsApp do que abrir a conversa com a
 * pessoa errada.
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

/**
 * DDDs em uso no Brasil (Anatel). Fora desta lista o número não existe, e o
 * botão de WhatsApp do paciente abriria uma conversa com ninguém.
 */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export type ProblemaDoCelular = 'incompleto' | 'ddd' | 'nao-celular';

/**
 * RF-01: o celular com WhatsApp do consultório, sempre brasileiro e móvel —
 * DDD + 9 dígitos começando por 9. Aceita máscara e o +55 na frente e devolve
 * no formato de exibição "(47) 99999-0000".
 */
export function normalizarCelular(bruto: string): { celular: string } | { problema: ProblemaDoCelular } {
  let digitos = bruto.replace(/\D/g, '');
  // Com "+" na frente vem um DDI: só o do Brasil serve.
  if (bruto.trim().startsWith('+') && !digitos.startsWith('55')) return { problema: 'incompleto' };
  if (digitos.length === 13 && digitos.startsWith('55')) digitos = digitos.slice(2);
  if (digitos.length !== 11) return { problema: 'incompleto' };
  if (!DDDS.has(Number(digitos.slice(0, 2)))) return { problema: 'ddd' };
  if (digitos[2] !== '9') return { problema: 'nao-celular' };

  return { celular: `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}` };
}
