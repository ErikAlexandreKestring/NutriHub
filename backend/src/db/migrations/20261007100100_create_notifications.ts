import type { Knex } from 'knex';

// RF-06 / RF-07: fila de notificações (e-mail e WhatsApp).
//
// Quem dispara um aviso só grava uma linha aqui; o envio fica com o worker
// (RFC seção 5.2, "Worker de notificações"). Assim a falha de um provedor
// nunca bloqueia o fluxo principal (E-13, E-21) e as novas tentativas
// (E-09, E-17) sobrevivem a um restart do processo.
//
// A mensagem é gravada já montada (`conteudo`): o worker não precisa ler
// paciente, plano ou consulta de cada tenant na hora de enviar.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('evento', 40).notNullable();
    table.enu('canal', ['email', 'whatsapp']).notNullable();
    // E-mail ou número no formato da WhatsApp Cloud API (só dígitos, com DDI).
    table.string('destino', 255).notNullable();
    table.jsonb('conteudo').notNullable();
    // E-09: e-mail enviado como canal alternativo na primeira falha do WhatsApp.
    table.jsonb('fallback');
    // Feedback, plano ou consulta que originou o aviso.
    table.uuid('referencia_id');
    table.enu('status', ['pendente', 'enviando', 'enviado', 'falha']).notNullable().defaultTo('pendente');
    table.integer('tentativas').notNullable().defaultTo(0);
    table.integer('max_tentativas').notNullable();
    table.integer('intervalo_segundos').notNullable();
    table.timestamp('proxima_tentativa_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.text('ultimo_erro');
    table.timestamp('enviado_em', { useTz: true });
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // A busca do worker: o que está vencido para (re)envio.
    table.index(['status', 'proxima_tentativa_em']);
    table.index(['tenant_id', 'referencia_id']);
  });

  await knex.raw('ALTER TABLE notifications ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE notifications FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON notifications
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
  `);

  // O worker atende todos os tenants e não tem um app.current_tenant para o
  // RLS. Mesma saída do login (patient_auth_by_email): uma função SECURITY
  // DEFINER estreita, que só reserva o lote vencido. Atualizar o resultado de
  // cada envio volta a passar pelo withTenant() com o tenant_id da própria linha.
  //
  // FOR UPDATE SKIP LOCKED deixa duas instâncias do worker rodarem juntas sem
  // pegar a mesma linha. Uma linha presa em 'enviando' por mais que o lease
  // (worker que caiu no meio do envio) volta para a fila.
  await knex.raw(`
    CREATE FUNCTION claim_notifications(p_limit integer, p_lease_seconds integer)
    RETURNS SETOF notifications
    LANGUAGE sql
    VOLATILE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
      UPDATE notifications n
      SET status = 'enviando',
          tentativas = n.tentativas + 1,
          updated_at = now()
      WHERE n.id IN (
        SELECT q.id
        FROM notifications q
        WHERE (q.status = 'pendente' AND q.proxima_tentativa_em <= now())
           OR (q.status = 'enviando' AND q.updated_at < now() - make_interval(secs => p_lease_seconds))
        ORDER BY q.proxima_tentativa_em
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
      )
      RETURNING n.*
    $$;
  `);

  await knex.raw('REVOKE ALL ON FUNCTION claim_notifications(integer, integer) FROM PUBLIC');
  await knex.raw('GRANT EXECUTE ON FUNCTION claim_notifications(integer, integer) TO nutrihub_app');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP FUNCTION IF EXISTS claim_notifications(integer, integer)');
  await knex.schema.dropTableIfExists('notifications');
}
