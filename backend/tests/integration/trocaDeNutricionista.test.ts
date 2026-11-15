import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db } from '../../src/db/connection';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PatientsService } from '../../src/modules/patients/patients.service';
import { verifyToken } from '../../src/shared/utils/jwt';
import { hashPassword } from '../../src/shared/utils/password';

/**
 * Paciente que troca de nutricionista: o e-mail existe nos dois consultórios,
 * cada um com o seu cadastro. O login tem de cair no vínculo mais recente, e o
 * consultório antigo não enxerga o cadastro do novo.
 */

const owner: Knex = knexLib(knexConfig.test);
const patients = new PatientsService();
const auth = new AuthService();
const sufixo = randomUUID().slice(0, 8);
const SENHA = 'Senha-forte-123';
const tenants: string[] = [];
let contador = 0;

async function criarConsultorio(): Promise<string> {
  contador += 1;
  const [tenant] = await owner('tenants')
    .insert({ nome: `Nutri ${contador}`, email: `troca-${contador}-${sufixo}@nutri.test`, crn: 'CRN-3 1', senha_hash: 'x' })
    .returning('id');
  tenants.push(tenant.id);
  return tenant.id;
}

async function cadastrar(tenantId: string, email: string, criadoEm: Date): Promise<string> {
  const [patient] = await owner('patients')
    .insert({
      tenant_id: tenantId,
      nome: 'Paciente Que Trocou',
      email,
      data_nascimento: '1990-01-01',
      senha_hash: await hashPassword(SENHA),
      created_at: criadoEm,
    })
    .returning('id');
  return patient.id;
}

afterAll(async () => {
  await owner('tenants').whereIn('id', tenants).delete();
  await owner.destroy();
  await db.destroy();
});

describe('Paciente que troca de nutricionista', () => {
  it('com os dois cadastros ativos e a mesma senha, entra no vínculo mais recente', async () => {
    const email = `trocou-${sufixo}@paciente.test`;
    const antigo = await criarConsultorio();
    const atual = await criarConsultorio();
    // O cadastro antigo é inserido primeiro de propósito: sem ORDER BY ele seria
    // o primeiro a voltar, e a ordem física das linhas não pode decidir quem entra.
    await cadastrar(antigo, email, new Date('2026-03-01T10:00:00Z'));
    const idAtual = await cadastrar(atual, email, new Date('2026-11-01T10:00:00Z'));

    const resultado = await auth.login({ email, senha: SENHA });

    const payload = verifyToken(resultado.token);
    expect(payload.tenant_id).toBe(atual);
    expect(payload.user_id).toBe(idAtual);
  });

  it('o consultório antigo não enxerga o cadastro do novo', async () => {
    const email = `isolado-${sufixo}@paciente.test`;
    const antigo = await criarConsultorio();
    const atual = await criarConsultorio();
    await cadastrar(antigo, email, new Date('2026-03-01T10:00:00Z'));
    await cadastrar(atual, email, new Date('2026-11-01T10:00:00Z'));

    const doAntigo = await patients.list(antigo);

    expect(doAntigo.map((p) => p.tenant_id)).toEqual([antigo]);
  });

  it('inativado no consultório antigo, continua entrando só pelo atual', async () => {
    const email = `inativado-${sufixo}@paciente.test`;
    const antigo = await criarConsultorio();
    const atual = await criarConsultorio();
    const idAntigo = await cadastrar(antigo, email, new Date('2026-03-01T10:00:00Z'));
    await cadastrar(atual, email, new Date('2026-11-01T10:00:00Z'));

    await patients.inactivate(antigo, idAntigo);

    const resultado = await auth.login({ email, senha: SENHA });
    expect(verifyToken(resultado.token).tenant_id).toBe(atual);
  });
});
