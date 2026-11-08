import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db } from '../../src/db/connection';
import { AppointmentsRepository } from '../../src/modules/appointments/appointments.repository';

/**
 * #42 e #47 contra o banco de verdade: o limite de consultas futuras por
 * paciente conta só as confirmadas que ainda não aconteceram; nenhuma consulta
 * se sobrepõe a outra; e o lock da agenda do consultório segura dois pedidos
 * simultâneos.
 */

const owner: Knex = knexLib(knexConfig.test);
const repository = new AppointmentsRepository();
const sufixo = randomUUID().slice(0, 8);
const DIA_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
const DURACAO = 60;
const SEM_LIMITE = undefined;
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

    const primeira = await repository.createIfFree(tenantId, patientId, daquiA(3), DURACAO, 1);
    const segunda = await repository.createIfFree(tenantId, patientId, daquiA(5), DURACAO, 1);

    expect('criada' in primeira).toBe(true);
    expect(segunda).toEqual({ proxima: expect.objectContaining({ patient_id: patientId }) });
    expect(await owner('appointments').where({ patient_id: patientId })).toHaveLength(1);
  });

  it('não conta consultas que já passaram nem as canceladas', async () => {
    const patientId = await criarPaciente();
    await inserirConsulta(patientId, daquiA(-10));
    await inserirConsulta(patientId, daquiA(4), 'cancelado');

    const resultado = await repository.createIfFree(tenantId, patientId, daquiA(6), DURACAO, 1);

    expect('criada' in resultado).toBe(true);
  });

  it('a consulta de outro paciente não conta', async () => {
    const patientId = await criarPaciente();
    await inserirConsulta(await criarPaciente(), daquiA(2));

    const resultado = await repository.createIfFree(tenantId, patientId, daquiA(9), DURACAO, 1);

    expect('criada' in resultado).toBe(true);
  });

  // Dois pedidos simultâneos do mesmo paciente: o segundo espera o lock do
  // primeiro e só então conta, enxergando a consulta que o primeiro gravou.
  it('conta as consultas só depois de obter o lock da agenda', async () => {
    const patientId = await criarPaciente();
    const concorrente = await owner.transaction();
    await concorrente.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`agenda:${tenantId}`]);

    const tentativa = repository.createIfFree(tenantId, patientId, daquiA(8), DURACAO, 1);
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

describe('Consultas sem sobreposição no banco (#47)', () => {
  // Cada teste usa um dia próprio, longe dos testes do #42, porque todos
  // dividem a agenda do mesmo consultório.
  it('recusa a consulta que começa no meio de outra e devolve a que ocupa o horário', async () => {
    const existente = daquiA(20);
    await inserirConsulta(await criarPaciente(), existente);

    const resultado = await repository.createIfFree(
      tenantId,
      await criarPaciente(),
      new Date(existente.getTime() + 30 * MIN_MS),
      DURACAO,
      SEM_LIMITE,
    );

    expect(resultado).toEqual({ conflito: expect.objectContaining({ data_hora: existente }) });
  });

  it('recusa a consulta que terminaria depois do início da próxima', async () => {
    const existente = daquiA(21);
    await inserirConsulta(await criarPaciente(), existente);

    const resultado = await repository.createIfFree(
      tenantId,
      await criarPaciente(),
      new Date(existente.getTime() - 30 * MIN_MS),
      DURACAO,
      SEM_LIMITE,
    );

    expect('conflito' in resultado).toBe(true);
  });

  it('aceita consultas encostadas, uma terminando quando a outra começa', async () => {
    const existente = daquiA(22);
    await inserirConsulta(await criarPaciente(), existente);
    const paciente = await criarPaciente();

    const depois = await repository.createIfFree(
      tenantId,
      paciente,
      new Date(existente.getTime() + 60 * MIN_MS),
      DURACAO,
      SEM_LIMITE,
    );
    const antes = await repository.createIfFree(
      tenantId,
      paciente,
      new Date(existente.getTime() - 60 * MIN_MS),
      DURACAO,
      SEM_LIMITE,
    );

    expect('criada' in depois).toBe(true);
    expect('criada' in antes).toBe(true);
  });

  it('uma consulta cancelada não ocupa o horário', async () => {
    const horario = daquiA(23);
    await inserirConsulta(await criarPaciente(), horario, 'cancelado');

    const resultado = await repository.createIfFree(tenantId, await criarPaciente(), horario, DURACAO, SEM_LIMITE);

    expect('criada' in resultado).toBe(true);
  });

  it('remarca sem esbarrar na própria consulta, mas não por cima de outra', async () => {
    const minha = daquiA(24);
    const outra = new Date(minha.getTime() + 2 * 60 * MIN_MS);
    const pacienteId = await criarPaciente();
    await inserirConsulta(pacienteId, minha);
    await inserirConsulta(await criarPaciente(), outra);
    const { id } = await owner('appointments').where({ patient_id: pacienteId }).first();

    const meiaHoraDepois = await repository.rescheduleIfFree(
      tenantId,
      id,
      new Date(minha.getTime() + 30 * MIN_MS),
      DURACAO,
    );
    const porCimaDaOutra = await repository.rescheduleIfFree(
      tenantId,
      id,
      new Date(outra.getTime() - 30 * MIN_MS),
      DURACAO,
    );

    expect('remarcada' in meiaHoraDepois).toBe(true);
    expect('conflito' in porCimaDaOutra).toBe(true);
    expect(await owner('appointments').where({ id }).first()).toMatchObject({
      data_hora: new Date(minha.getTime() + 30 * MIN_MS),
    });
  });

  // Dois pacientes pedindo 10:00 e 10:30 ao mesmo tempo: o segundo espera o
  // lock da agenda e só então procura sobreposição, enxergando o primeiro.
  it('procura sobreposição só depois de obter o lock da agenda', async () => {
    const primeiro = daquiA(25);
    const concorrente = await owner.transaction();
    await concorrente.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`agenda:${tenantId}`]);

    const tentativa = repository.createIfFree(
      tenantId,
      await criarPaciente(),
      new Date(primeiro.getTime() + 30 * MIN_MS),
      DURACAO,
      SEM_LIMITE,
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    await concorrente('appointments').insert({
      tenant_id: tenantId,
      patient_id: await criarPaciente(),
      data_hora: primeiro,
      status: 'confirmado',
    });
    await concorrente.commit();

    await expect(tentativa).resolves.toEqual({ conflito: expect.objectContaining({ data_hora: primeiro }) });
  });
});
