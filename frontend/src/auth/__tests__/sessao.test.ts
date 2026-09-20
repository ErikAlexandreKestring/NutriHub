import { beforeEach, describe, expect, it } from 'vitest';
import { lerSessaoSalva, salvarSessao, sessaoDaResposta, type Sessao } from '../sessao';

/** Monta um JWT de mentira com o `exp` desejado — só o payload é lido aqui. */
function tokenCom(expSegundos: number): string {
  const payload = btoa(JSON.stringify({ user_id: 'u1', role: 'paciente', exp: expSegundos }));
  return `cabecalho.${payload}.assinatura`;
}

describe('sessao', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('extrai id, nome e e-mail da resposta de nutricionista', () => {
    const sessao = sessaoDaResposta({
      token: tokenCom(Math.floor(Date.now() / 1000) + 3600),
      role: 'nutricionista',
      tenant: { id: 't1', nome: 'Ana', email: 'ana@clinica.com', crn: 'CRN-1234' },
    });

    expect(sessao).toMatchObject({ papel: 'nutricionista', usuarioId: 't1', nome: 'Ana' });
  });

  it('extrai os dados da resposta de paciente, que vem em outra chave', () => {
    const sessao = sessaoDaResposta({
      token: tokenCom(Math.floor(Date.now() / 1000) + 3600),
      role: 'paciente',
      patient: { id: 'p1', nome: 'João', email: 'joao@email.com' },
    });

    expect(sessao).toMatchObject({ papel: 'paciente', usuarioId: 'p1', nome: 'João' });
  });

  it('recusa um token sem exp legível em vez de criar sessão sem validade', () => {
    expect(
      sessaoDaResposta({
        token: 'token-que-nao-e-jwt',
        role: 'paciente',
        patient: { id: 'p1', nome: 'João', email: 'joao@email.com' },
      }),
    ).toBeNull();
  });

  it('descarta a sessão salva cujo token já expirou', () => {
    const vencida: Sessao = {
      token: tokenCom(1),
      papel: 'paciente',
      usuarioId: 'p1',
      nome: 'João',
      email: 'joao@email.com',
      expiraEm: Date.now() - 1000,
    };
    salvarSessao(vencida);

    expect(lerSessaoSalva()).toBeNull();
    // E limpa o storage, para não reavaliar o mesmo token morto a cada boot.
    expect(localStorage.getItem('nutrihub.sessao')).toBeNull();
  });

  it('restaura a sessão ainda válida', () => {
    const valida: Sessao = {
      token: tokenCom(Math.floor(Date.now() / 1000) + 3600),
      papel: 'nutricionista',
      usuarioId: 't1',
      nome: 'Ana',
      email: 'ana@clinica.com',
      expiraEm: Date.now() + 3_600_000,
    };
    salvarSessao(valida);

    expect(lerSessaoSalva()).toEqual(valida);
  });

  it('ignora conteúdo corrompido no storage', () => {
    localStorage.setItem('nutrihub.sessao', '{nao é json');
    expect(lerSessaoSalva()).toBeNull();
  });
});
