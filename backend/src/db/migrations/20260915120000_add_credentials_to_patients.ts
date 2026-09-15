import type { Knex } from 'knex';

// RF-02: pacientes também se autenticam por e-mail e senha (JWT de 24h), mas a
// tabela `patients` nasceu sem credencial alguma — só o nutricionista tinha
// senha (em `tenants`). Esta migration adiciona:
//
//   - senha_hash: bcrypt da senha do paciente (RNF-02). NULL = paciente ainda
//     não fez o primeiro acesso, e portanto não consegue logar.
//   - acesso_token_hash / acesso_token_expira_em: token de primeiro acesso
//     gerado pelo nutricionista, guardado como SHA-256 (nunca em claro).
//
// PROBLEMA DE RLS: o login acontece ANTES de existir um tenant_id — é
// justamente o login que descobre a qual tenant o usuário pertence. Mas
// `patients` tem FORCE ROW LEVEL SECURITY e a política exige
// current_setting('app.current_tenant'), que ainda não está setado. Uma query
// normal da aplicação aqui falharia (parâmetro não reconhecido).
//
// Solução: duas funções SECURITY DEFINER, que rodam com os privilégios do dono
// (postgres, superusuário → BYPASSRLS) e expõem SOMENTE as colunas necessárias
// para autenticar. O RLS continua FORCE para todo o resto da aplicação; este é
// o único caminho que o atravessa, e ele não consegue ler plano alimentar,
// histórico, contato nem qualquer outro dado do paciente.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patients', (table) => {
    table.string('senha_hash', 255).nullable();
    table.string('acesso_token_hash', 64).nullable();
    table.timestamp('acesso_token_expira_em', { useTz: true }).nullable();
  });

  // Busca por token de primeiro acesso precisa ser rápida e o hash é único na prática.
  await knex.raw(
    'CREATE INDEX patients_acesso_token_hash_idx ON patients (acesso_token_hash) WHERE acesso_token_hash IS NOT NULL',
  );

  // Retorna 0..N candidatos: o mesmo e-mail PODE existir em tenants diferentes
  // (a unicidade de `patients` é por (tenant_id, email)). Quem desempata é o
  // bcrypt, na camada de serviço. Só pacientes que já definiram senha entram.
  await knex.raw(`
    CREATE FUNCTION patient_auth_by_email(p_email text)
    RETURNS TABLE (id uuid, tenant_id uuid, nome text, email text, senha_hash text, status text)
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
      SELECT p.id, p.tenant_id, p.nome::text, p.email::text, p.senha_hash::text, p.status::text
      FROM patients p
      WHERE p.email = p_email
        AND p.senha_hash IS NOT NULL
    $$;
  `);

  // Primeiro acesso: o token identifica o paciente sozinho (32 bytes aleatórios),
  // então aqui no máximo uma linha volta.
  await knex.raw(`
    CREATE FUNCTION patient_by_access_token(p_token_hash text)
    RETURNS TABLE (id uuid, tenant_id uuid, nome text, email text, acesso_token_expira_em timestamptz)
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
      SELECT p.id, p.tenant_id, p.nome::text, p.email::text, p.acesso_token_expira_em
      FROM patients p
      WHERE p.acesso_token_hash = p_token_hash
        AND p.status = 'ativo'
    $$;
  `);

  // Funções nascem com EXECUTE para PUBLIC; restringe ao papel da aplicação.
  for (const fn of ['patient_auth_by_email(text)', 'patient_by_access_token(text)']) {
    await knex.raw(`REVOKE ALL ON FUNCTION ${fn} FROM PUBLIC`);
    await knex.raw(`GRANT EXECUTE ON FUNCTION ${fn} TO nutrihub_app`);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP FUNCTION IF EXISTS patient_by_access_token(text)');
  await knex.raw('DROP FUNCTION IF EXISTS patient_auth_by_email(text)');
  await knex.raw('DROP INDEX IF EXISTS patients_acesso_token_hash_idx');

  await knex.schema.alterTable('patients', (table) => {
    table.dropColumn('acesso_token_expira_em');
    table.dropColumn('acesso_token_hash');
    table.dropColumn('senha_hash');
  });
}
