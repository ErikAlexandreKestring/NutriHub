import type { Knex } from 'knex';

// RF-07 revisado: o WhatsApp deixou de ser um canal de envio automático (sem
// WhatsApp Business API nem aprovação da Meta). O paciente fala com o
// nutricionista por um link direto (wa.me) a partir da PWA, e a fila de
// notificações fica só com o e-mail.
//
// As linhas de WhatsApp saem da fila: nada as enviaria mais, e a plataforma
// ainda não tinha ido para produção — só existem as geradas em desenvolvimento
// pelo transporte `console`. Com elas some a coluna `fallback` (E-09: e-mail
// alternativo quando o WhatsApp falhava), que só os jobs de WhatsApp usavam.
//
// O DELETE percorre tenant a tenant com app.current_tenant definido, como a
// migration encrypt_patients_historico: `notifications` tem FORCE ROW LEVEL
// SECURITY, e no Azure Database for PostgreSQL o administrador não é
// superusuário. Sem o tenant na sessão, a policy falharia no current_setting e
// a migration pararia no deploy. A CHECK constraint, adicionada depois, valida
// a tabela inteira sem passar pelo RLS.
export async function up(knex: Knex): Promise<void> {
  const tenants: Array<{ id: string }> = await knex('tenants').select('id');
  for (const tenant of tenants) {
    await knex.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.current_tenant', ?, true)", [tenant.id]);
      await trx('notifications').where({ canal: 'whatsapp' }).delete();
    });
  }

  await knex.raw('ALTER TABLE notifications DROP CONSTRAINT notifications_canal_check');
  await knex.raw("ALTER TABLE notifications ADD CONSTRAINT notifications_canal_check CHECK (canal = 'email')");

  await knex.schema.alterTable('notifications', (table) => {
    table.dropColumn('fallback');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('notifications', (table) => {
    table.jsonb('fallback');
  });

  await knex.raw('ALTER TABLE notifications DROP CONSTRAINT notifications_canal_check');
  await knex.raw(
    "ALTER TABLE notifications ADD CONSTRAINT notifications_canal_check CHECK (canal IN ('email', 'whatsapp'))",
  );
}
