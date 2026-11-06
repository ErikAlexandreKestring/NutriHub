import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db } from '../../src/db/connection';
import { AppointmentsRepository } from '../../src/modules/appointments/appointments.repository';

/**
 * #42 contra o banco de verdade: o limite de consultas futuras por paciente
 * conta só as confirmadas que ainda não aconteceram, e o lock por paciente
 * segura dois agendamentos simultâneos.
 */

const owner: Knex = knexLib(knexConfig.test);
const repository = new AppointmentsRepository();
const sufixo = randomUUID().slice(0, 8);
const DIA_MS = 24 * 60 * 60 * 1000;
let tenantId: string;
let contador = 0;

function daquiA(dias: number): Date {
  return new Date(Date.now() + dias * DIA_MS);
}

async function criarPaciente(): Promise<string> {
  contador += 1;
  const [patient] = await owner('patients')
    .insert({
      tenant_id: tenantId,
      nome: `Paciente ${contador}`,
      email: `paciente-${contador}-${sufixo}@agenda.test`,
      data_nascimento: '1962-07-15',
    })
    .returning('id');
  return patient.id;
}

async function inserirConsulta(patientId: string, dataHora: Date, status = 'confirmado'): Promise<void> {
  await owner('appointments').insert({ tenant_id: tenantId, patient_id: patientId, data_hora: dataHora, status });
}

beforeAll(async () => {
  const [tenant] = await owner('tenants')
    .insert({ nome: 'Nutri Agenda', email: `agenda-${sufixo}@agenda.test`, crn: 'CRN-3 1', senha_hash: 'x' })
    .returning('id');
  tenantId = tenant.id;
});

afterAll(async () => {
  await owner('tenants').where({ id: tenantId }).delete();
  await owner.destroy();
  await db.destroy();
});

describe('Limite de consultas futuras do paciente no banco (#42)', () => {
  it('agenda a primeira e recusa a segunda, devolvendo a que já existe', async () => {
    const patientId = await criarPaciente();

    const primeira = await repository.createWithinPatientLimit(tenantId, patientId, daquiA(3), 1);
    const segunda = await repository.createWithinPatientLimit(tenantId, patientId, daquiA(5), 1);

    expect('criada' in primeira).toBe(true);
    expect(segunda).toEqual({ proxima: expect.objectContaining({ patient_id: patientId }) });
    expect(await owner('appointments').where({ patient_id: patientId })).toHaveLength(1);
  });

  it('não conta consultas que já passaram nem as canceladas', async () => {
    const patientId = await criarPaciente();
    await inserirConsulta(patientId, daquiA(-10));
    await inserirConsulta(patientId, daquiA(4), 'cancelado');

    const resultado = await repository.createWithinPatientLimit(tenantId, patientId, daquiA(6), 1);

    expect('criada' in resultado).toBe(true);
  });

  it('a consulta de outro paciente não conta', async () => {
    const patientId = await criarPaciente();
    await inserirConsulta(await criarPaciente(), daquiA(2));

    const resultado = await repository.createWithinPatientLimit(tenantId, patientId, daquiA(2), 1);

    expect('criada' in resultado).toBe(true);
  });

  // Dois pedidos simultâneos do mesmo paciente: o segundo espera o lock do
  // primeiro e só então conta, enxergando a consulta que o primeiro gravou.
  it('conta as consultas só depois de obter o lock do paciente', async () => {
    const patientId = await criarPaciente();
    const concorrente = await owner.transaction();
    await concorrente.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`consultas:${patientId}`]);

    const tentativa = repository.createWithinPatientLimit(tenantId, patientId, daquiA(8), 1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await concorrente('appointments').insert({
      tenant_id: tenantId,
      patient_id: patientId,
      data_hora: daquiA(7),
      status: 'confirmado',
    });
    await concorrente.commit();

    await expect(tentativa).resolves.toEqual({ proxima: expect.objectContaining({ patient_id: patientId }) });
    expect(await owner('appointments').where({ patient_id: patientId })).toHaveLength(1);
  });
});
