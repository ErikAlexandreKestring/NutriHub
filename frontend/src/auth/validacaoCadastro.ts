/**
 * RF-01: as mesmas regras do registerSchema do backend (auth.validation,
 * shared/utils/crn e phone), aplicadas já no navegador para o erro aparecer
 * ao sair do campo, e não só depois de enviar. O backend continua sendo a
 * autoridade: estas funções só antecipam a resposta dele.
 */

export const REGIOES_DO_CRN = 11;

const NOME = /^\p{L}[\p{L}'. -]*$/u;
// Domínio em partes separadas por ponto, sem ponto dentro das partes: cada
// caractere só tem um jeito de casar, então a checagem é linear mesmo com um
// texto enorme e malicioso (ReDoS, apontado pelo SonarCloud).
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

// DDDs em uso no Brasil (Anatel) — a mesma lista do backend.
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export function validarNome(valor: string): string | undefined {
  const nome = valor.trim().replace(/\s+/g, ' ');
  if (!nome) return 'Informe seu nome completo.';
  if (nome.length < 3 || nome.length > 100) return 'O nome deve ter entre 3 e 100 caracteres.';
  if (!NOME.test(nome)) return 'Use apenas letras no nome.';
  if (nome.split(' ').length < 2) return 'Informe nome e sobrenome.';
  return undefined;
}

export function validarEmail(valor: string): string | undefined {
  const email = valor.trim();
  if (!email) return 'Informe seu e-mail.';
  if (!email.includes('@')) return 'O e-mail precisa ter @, ex.: nome@clinica.com';
  if (!EMAIL.test(email) || email.length > 255) return 'E-mail inválido. Confira o endereço, ex.: nome@clinica.com';
  return undefined;
}

/** "crn10 12345" → "CRN-10 12345"; null quando não está no formato. */
export function normalizarCrn(valor: string): string | null {
  const texto = valor.trim().toUpperCase().replace(/\s+/g, ' ');
  const partes = /^CRN ?-? ?(\d{1,2}) ?[-/ ] ?(\d{1,6})(?: ?\/ ?([PS]))?$/.exec(texto);
  if (!partes) return null;
  const [, regiao, numero, sufixo] = partes;
  return `CRN-${Number(regiao)} ${Number(numero)}${sufixo ? `/${sufixo}` : ''}`;
}

export function validarCrn(valor: string): string | undefined {
  if (!valor.trim()) return 'Informe seu CRN.';
  const crn = normalizarCrn(valor);
  if (!crn || /^CRN-\d+ 0\b/.test(crn)) return 'CRN inválido. Use região e número, ex.: CRN-10 12345';
  const regiao = Number(/^CRN-(\d+)/.exec(crn)![1]);
  if (regiao < 1 || regiao > REGIOES_DO_CRN) {
    return `Região do CRN inválida: os conselhos vão do CRN-1 ao CRN-${REGIOES_DO_CRN}.`;
  }
  return undefined;
}

/** Máscara enquanto digita: "4799999" → "(47) 99999", até "(47) 99999-0000". */
export function mascararCelular(valor: string): string {
  let d = valor.replace(/\D/g, '');
  // Colado com o DDI ("+55 47 99999-0000"): o 55 sai antes de cortar em 11.
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function validarCelular(valor: string): string | undefined {
  const d = valor.replace(/\D/g, '');
  if (!d) return 'Informe o celular com WhatsApp.';
  if (d.length !== 11) return 'Celular incompleto. Informe DDD e os 9 dígitos, ex.: (47) 99999-0000';
  if (!DDDS.has(Number(d.slice(0, 2)))) return 'DDD inválido. Confira os dois primeiros dígitos.';
  if (d[2] !== '9') return 'Informe um celular: depois do DDD, o número começa com 9.';
  return undefined;
}

export function validarSenha(valor: string): string | undefined {
  if (!valor) return 'Crie uma senha.';
  if (valor.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (valor.length > 72) return 'A senha pode ter no máximo 72 caracteres.';
  if (!/\p{L}/u.test(valor) || !/\d/.test(valor)) return 'Use letras e números na senha.';
  return undefined;
}

export type CampoDoCadastro = 'nome' | 'email' | 'crn' | 'telefone' | 'senha';

export const VALIDAR: Record<CampoDoCadastro, (valor: string) => string | undefined> = {
  nome: validarNome,
  email: validarEmail,
  crn: validarCrn,
  telefone: validarCelular,
  senha: validarSenha,
};
