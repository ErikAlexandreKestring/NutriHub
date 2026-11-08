import { randomUUID } from 'crypto';
import knexLib, { Knex } from 'knex';
import knexConfig from '../../src/db/knexfile';
import { db } from '../../src/db/connection';
import { down, up } from '../../src/db/migrations/20261108120000_email_sem_diferenciar_maiusculas';
import { AuthService } from '../../src/modules/auth/auth.service';
import { loginSchema } from '../../src/modules/auth/auth.validation';
import { hashPassword } from '../../src/shared/utils/password';

/**
 * Issue #49 contra o banco de verdade: a migration converte para minúsculas os
 * e-mails já gravados, para em vez de juntar contas que só diferem nas
 * maiúsculas, e a CHECK constraint impede gravar e-mail com maiúscula.
 */

const owner: Knex = knexLib(knexConfig.test);
const sufixo = randomUUID().slice(0, 8);
const tenants: string[] = [];

async function criarConsultorio(email: string): Promise<string> {
  const [tenant] = await owner('tenants')
    .insert({
      nome: 'Nutri Email',
      email,
      crn: 'CRN-3 1',
      senha_hash: await hashPassword('Senha-forte-123'),
      email_confirmado_em: new Date(),
    })
    .returning('id');
  tenants.push(tenant.id);
  return tenant.id;
}

/** `patients` tem FORCE ROW LEVEL SECURITY: o insert precisa do tenant na sessão. */
async function criarPaciente(tenantId: string, email: string): Promise<void> {
  await owner.transaction(async (trx) => {
    await trx.raw("SELECT set_config('app.current_tenant', ?, true)", [tenantId]);
    await trx('patients').insert({ tenant_id: tenantId, nome: 'Paciente', email, data_nascimento: '1962-07-15' });
  });
}

afterAll(async () => {
  await owner('tenants').whereIn('id', tenants).delete();
  await owner.destroy();
  await db.destroy();
});

describe('E-mail sem diferenciar maiúsculas (#49)', () => {
  it('o banco recusa e-mail com maiúscula', async () => {
    await expect(criarConsultorio(`Ana-${sufixo}@Clinica.com`)).rejects.toThrow(/tenants_email_minusculo/);
  });

  it('o nutricionista entra digitando o e-mail com outra grafia', async () => {
    await criarConsultorio(`bia-${sufixo}@clinica.com`);

    const input = loginSchema.parse({ email: `  Bia-${sufixo}@CLINICA.com`, senha: 'Senha-forte-123' });
    const resultado = await new AuthService().login(input);

    expect(resultado.role).toBe('nutricionista');
  });

  describe('migration', () => {
    // Desfaz a regra para conseguir gravar os dados "antigos" e roda a
    // migration de novo; o finally garante que a regra volta para os outros testes.
    afterEach(async () => {
      const temRegra = await owner.raw(
        "SELECT 1 FROM pg_constraint WHERE conname = 'tenants_email_minusculo'",
      );
      if (temRegra.rowCount === 0) {
        await up(owner);
      }
    });

    it('converte para minúsculas os e-mails já gravados', async () => {
      await down(owner);
      const tenantId = await criarConsultorio(`Caio-${sufixo}@Clinica.com`);
      await criarPaciente(tenantId, `Dora-${sufixo}@Email.com`);

      await up(owner);

      expect(await owner('tenants').where({ id: tenantId }).first()).toMatchObject({
        email: `caio-${sufixo}@clinica.com`,
      });
      const pacientes = await owner.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.current_tenant', ?, true)", [tenantId]);
        return trx('patients').where({ tenant_id: tenantId }).select('email');
      });
      expect(pacientes).toEqual([{ email: `dora-${sufixo}@email.com` }]);
    });

    it('para se dois pacientes do mesmo consultório só diferem nas maiúsculas', async () => {
      const tenantId = await criarConsultorio(`edu-${sufixo}@clinica.com`);
      await down(owner);
      await criarPaciente(tenantId, `Fabi-${sufixo}@email.com`);
      await criarPaciente(tenantId, `fabi-${sufixo}@email.com`);

      await expect(up(owner)).rejects.toThrow(/repetido/);

      await owner.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.current_tenant', ?, true)", [tenantId]);
        await trx('patients').where({ email: `Fabi-${sufixo}@email.com` }).delete();
      });
    });

    it('para se duas contas de nutricionista só diferem nas maiúsculas', async () => {
      await down(owner);
      await criarConsultorio(`Gil-${sufixo}@clinica.com`);
      await criarConsultorio(`gil-${sufixo}@clinica.com`);

      await expect(up(owner)).rejects.toThrow(/nutricionista repetido/);

      await owner('tenants').where({ email: `Gil-${sufixo}@clinica.com` }).delete();
    });
  });
});
