import crypto from 'crypto';
import { env } from '../../config/env';

/**
 * RNF-03 / RFC 6.3: criptografia em repouso dos dados de saúde (histórico
 * clínico do paciente). A chave vem do ambiente e nunca vai para o banco — quem
 * tiver só um dump do Postgres não lê o conteúdo.
 *
 * AES-256-GCM em vez do CBC citado na RFC: mesmo tamanho de chave, mas com
 * autenticação — um valor adulterado no banco falha ao decifrar em vez de
 * virar texto corrompido em silêncio.
 *
 * Formato gravado: `enc:v1:<iv>:<tag>:<cifrado>`, partes em base64. O prefixo
 * versionado permite trocar de algoritmo ou de chave sem ambiguidade.
 */
const ALGORITMO = 'aes-256-gcm';
const PREFIXO = 'enc:v1:';
const IV_BYTES = 12;
const CHAVE_BYTES = 32;

export function parseEncryptionKey(base64: string): Buffer {
  const chave = Buffer.from(base64, 'base64');
  if (chave.length !== CHAVE_BYTES) {
    throw new Error(`DATA_ENCRYPTION_KEY precisa ter ${CHAVE_BYTES} bytes em base64 (tem ${chave.length})`);
  }
  return chave;
}

// Lida uma vez, na subida: chave inválida derruba o processo em vez de cada
// cadastro de paciente falhar depois.
const CHAVE = parseEncryptionKey(env.dataEncryptionKey);

export function isEncrypted(valor: string): boolean {
  return valor.startsWith(PREFIXO);
}

export function encryptSensitive(texto: string, chave: Buffer = CHAVE): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITMO, chave, iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIXO}${iv.toString('base64')}:${tag.toString('base64')}:${cifrado.toString('base64')}`;
}

export function decryptSensitive(valor: string, chave: Buffer = CHAVE): string {
  if (!isEncrypted(valor)) {
    throw new Error('Valor sensível gravado sem criptografia');
  }
  const [iv, tag, cifrado] = valor.slice(PREFIXO.length).split(':');
  const decipher = crypto.createDecipheriv(ALGORITMO, chave, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(cifrado, 'base64')), decipher.final()]).toString('utf8');
}

/** Atalhos para colunas opcionais: `null` continua `null`. */
export function encryptOptional(texto: string | null): string | null {
  return texto === null ? null : encryptSensitive(texto);
}

export function decryptOptional(valor: string | null): string | null {
  return valor === null ? null : decryptSensitive(valor);
}
