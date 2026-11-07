import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db } from '../../src/db/connection';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PatientsService } from '../../src/modules/patients/patients.service';
import { InvalidCredentialsError, PatientNotFoundError } from '../../src/shared/errors/AppError';
import { hashPassword } from '../../src/shared/utils/password';

/**
 * Inativar e reativar contra o banco de verdade: inativo, o paciente não
 * entra no app; reativado, entra com a mesma senha e encontra o plano que já
 * tinha.
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
    .insert({ nome: `Nutri ${contador}`, email: `reativar-${contador}-${sufixo}@paciente.test`, crn: 'CRN-3 1', senha_hash: 'x' })
    .returning('id');
  tenants.push(tenant.id);
  return tenant.id;
}

async function criarPacienteComAcesso(tenantId: string): Promise<{ id: string; email: string }> {
  contador += 1;
  const email = `paciente-${contador}-${sufixo}@paciente.test`;
  const [patient] = await owner('patients')
    .insert({
      tenant_id: tenantId,
      nome: `Paciente ${contador}`,
      email,
      data_nascimento: '1962-07-15',
      senha_hash: await hashPassword(SENHA),
    })
    .returning('id');
  return { id: patient.id, email };
}

afterAll(async () => {
  await owner('tenants').whereIn('id', tenants).delete();
  await owner.destroy();
  await db.destroy();
});

describe('Reativar paciente inativo', () => {
  it('o paciente volta a entrar no app com a mesma senha e o plano continua lá', async () => {
    const tenantId = await criarConsultorio();
    const paciente = await criarPacienteComAcesso(tenantId);
    const [plano] = await owner('meal_plans')
      .insert({ tenant_id: tenantId, patient_id: paciente.id, status: 'ativo', published_at: new Date() })
      .returning('id');

    await patients.inactivate(tenantId, paciente.id);
    await expect(auth.login({ email: paciente.email, senha: SENHA })).rejects.toThrow(InvalidCredentialsError);

    const reativado = await patients.reactivate(tenantId, paciente.id);

    expect(reativado).toMatchObject({ id: paciente.id, status: 'ativo', acesso_liberado: true });
    expect(await auth.login({ email: paciente.email, senha: SENHA })).toMatchObject({ role: 'paciente' });
    expect(await owner('meal_plans').where({ id: plano.id }).first()).toMatchObject({ status: 'ativo' });
  });

  it('não reativa paciente de outro consultório', async () => {
    const tenantA = await criarConsultorio();
    const tenantB = await criarConsultorio();
    const pacienteDeB = await criarPacienteComAcesso(tenantB);
    await patients.inactivate(tenantB, pacienteDeB.id);

    await expect(patients.reactivate(tenantA, pacienteDeB.id)).rejects.toThrow(PatientNotFoundError);
    expect(await owner('patients').where({ id: pacienteDeB.id }).first()).toMatchObject({ status: 'inativo' });
  });
});
