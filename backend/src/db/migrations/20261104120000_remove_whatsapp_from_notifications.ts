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
export async function up(knex: Knex): Promise<void> {
  await knex('notifications').where({ canal: 'whatsapp' }).delete();

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
