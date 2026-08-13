import { hashPassword, comparePassword } from '../../src/shared/utils/password';

describe('password utils (RNF-02)', () => {
  it('gera um hash diferente da senha em texto plano', async () => {
    const hash = await hashPassword('minhaSenha123');
    expect(hash).not.toBe('minhaSenha123');
    expect(hash.startsWith('$2b$')).toBe(true); // prefixo do bcrypt
  });

  it('confirma que a senha correta corresponde ao hash', async () => {
    const hash = await hashPassword('minhaSenha123');
    await expect(comparePassword('minhaSenha123', hash)).resolves.toBe(true);
  });

  it('rejeita uma senha incorreta', async () => {
    const hash = await hashPassword('minhaSenha123');
    await expect(comparePassword('outraSenha', hash)).resolves.toBe(false);
  });
});
