import crypto from 'crypto';
import {
  decryptOptional,
  decryptSensitive,
  encryptOptional,
  encryptSensitive,
  isEncrypted,
  parseEncryptionKey,
} from '../../src/shared/utils/sensitiveData';

const HISTORICO = 'Diabetes tipo 2, hipertensão. Alergia a camarão — evitar frutos do mar.';

describe('sensitiveData (RNF-03)', () => {
  it('cifra e decifra de volta o mesmo texto, acentos incluídos', () => {
    const cifrado = encryptSensitive(HISTORICO);

    expect(decryptSensitive(cifrado)).toBe(HISTORICO);
  });

  it('não deixa o texto em claro no valor gravado', () => {
    const cifrado = encryptSensitive(HISTORICO);

    expect(isEncrypted(cifrado)).toBe(true);
    expect(cifrado).not.toContain('Diabetes');
  });

  it('gera um valor diferente a cada gravação do mesmo texto (IV aleatório)', () => {
    expect(encryptSensitive(HISTORICO)).not.toBe(encryptSensitive(HISTORICO));
  });

  it('recusa um valor adulterado no banco em vez de devolver texto corrompido', () => {
    const cifrado = encryptSensitive(HISTORICO);
    const partes = cifrado.split(':');
    const corpo = Buffer.from(partes[4], 'base64');
    corpo[0] ^= 0xff;
    partes[4] = corpo.toString('base64');

    expect(() => decryptSensitive(partes.join(':'))).toThrow();
  });

  it('não decifra com outra chave', () => {
    const outraChave = crypto.randomBytes(32);

    expect(() => decryptSensitive(encryptSensitive(HISTORICO), outraChave)).toThrow();
  });

  it('recusa ler um valor que foi gravado sem criptografia', () => {
    expect(() => decryptSensitive(HISTORICO)).toThrow('Valor sensível gravado sem criptografia');
  });

  it('mantém null como null nas colunas opcionais', () => {
    expect(encryptOptional(null)).toBeNull();
    expect(decryptOptional(null)).toBeNull();
    expect(decryptOptional(encryptOptional(HISTORICO))).toBe(HISTORICO);
  });

  it('exige uma chave de exatamente 32 bytes', () => {
    expect(parseEncryptionKey(crypto.randomBytes(32).toString('base64'))).toHaveLength(32);
    expect(() => parseEncryptionKey(crypto.randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
    expect(() => parseEncryptionKey('')).toThrow(/32 bytes/);
  });
});
