import type { Knex } from 'knex';

// RNF-01 / RFC 5.4.2 e 6.5: os logs de auditoria também são protegidos por RLS
// e só o tenant que os gerou consegue lê-los.
//
// A política é dividida por comando, e não um único USING/WITH CHECK como nas
// outras tabelas: a gravação continua livre para qualquer tenant_id — inclusive
// nulo ou inexistente — porque o E-06 registra justamente o token cujo tenant
// não confere (ver create_audit_logs). Só a leitura fica presa ao tenant da
// sessão. UPDATE e DELETE seguem revogados do papel da aplicação.
export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY');

  await knex.raw(`
    CREATE POLICY audit_insert ON audit_logs
    FOR INSERT
    WITH CHECK (true)
  `);

  await knex.raw(`
    CREATE POLICY tenant_isolation ON audit_logs
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP POLICY IF EXISTS tenant_isolation ON audit_logs');
  await knex.raw('DROP POLICY IF EXISTS audit_insert ON audit_logs');
  await knex.raw('ALTER TABLE audit_logs NO FORCE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY');
}
