import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db } from '../../src/db/connection';
import { AvailabilityRepository } from '../../src/modules/availability/availability.repository';

/**
 * RF-08 contra o banco de verdade: a sobreposição é conferida em SQL sobre
 * colunas `time`, e só o Postgres mostra se a comparação com "HH:MM" está
 * certa e se o lock segura dois cadastros simultâneos.
 */

const owner: Knex = knexLib(knexConfig.test);
const repository = new AvailabilityRepository();
const sufixo = randomUUID().slice(0, 8);
let tenantId: string;

beforeAll(async () => {
  const [tenant] = await owner('tenants')
    .insert({ nome: 'Nutri Grade', email: `grade-${sufixo}@grade.test`, crn: 'CRN-3 1', senha_hash: 'x' })
    .returning('id');
  tenantId = tenant.id;
});

afterAll(async () => {
  await owner('tenants').where({ id: tenantId }).delete();
  await owner.destroy();
  await db.destroy();
});

function criar(dayOfWeek: number, startTime: string, endTime: string) {
  return repository.create(tenantId, { dayOfWeek, startTime, endTime });
}

describe('Grade de disponibilidade no banco (RF-08)', () => {
  it('aceita manhã e tarde no mesmo dia, inclusive encostadas', async () => {
    expect((await criar(1, '08:00', '12:00')).criado).toBeDefined();
    expect((await criar(1, '13:00', '18:00')).criado).toBeDefined();
    expect((await criar(1, '12:00', '13:00')).criado).toBeDefined();
  });

  it.each([
    ['dentro de outro', '09:00', '11:00'],
    ['cobrindo outro', '07:00', '19:00'],
    ['começando no meio de outro', '11:00', '14:00'],
    ['igual a outro', '08:00', '12:00'],
  ])('recusa intervalo %s e devolve o que conflita', async (_caso, inicio, fim) => {
    const resultado = await criar(1, inicio, fim);
    expect(resultado.criado).toBeUndefined();
    expect(resultado.conflito).toMatchObject({ day_of_week: 1 });
  });

  it('o mesmo horário em outro dia não conflita', async () => {
    expect((await criar(2, '08:00', '12:00')).criado).toBeDefined();
  });

  it('cadastros simultâneos sobrepostos: só um entra', async () => {
    const concorrente = await owner.transaction();
    await concorrente.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`availability:${tenantId}:5`]);

    const tentativa = criar(5, '10:00', '16:00');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await concorrente('availability').insert({
      tenant_id: tenantId,
      day_of_week: 5,
      start_time: '10:00',
      end_time: '18:00',
    });
    await concorrente.commit();

    expect((await tentativa).conflito).toBeDefined();
    expect(await owner('availability').where({ tenant_id: tenantId, day_of_week: 5 })).toHaveLength(1);
  });
});
