import type { Knex } from 'knex';

// Correção de review na RF-02: o primeiro acesso do paciente validava o token
// (patient_by_access_token) e gravava a senha (UPDATE em patients) em duas
// operações separadas. Duas requisições concorrentes com o mesmo token passavam
// as duas pela validação, cada uma gravava uma senha e a última vencia — janela
// real de sequestro de conta para quem tivesse o link de primeiro acesso.
//
// Aqui as duas viram uma só: um único UPDATE ... RETURNING, em que o próprio
// WHERE faz a validação (token confere, não expirou, paciente ativo) e a mesma
// instrução apaga o token. O segundo request concorrente não encontra mais
// linha alguma e recebe E-21.
//
// Continua SECURITY DEFINER pelo mesmo motivo das leituras de login: neste
// ponto o tenant_id ainda é desconhecido, então não há app.current_tenant para
// o RLS de `patients`. A função expõe apenas as colunas de identificação já
// devolvidas pelo login e só escreve nas colunas de credencial.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE FUNCTION consume_patient_access_token(p_token_hash text, p_senha_hash text)
    RETURNS TABLE (id uuid, tenant_id uuid, nome text, email text)
    LANGUAGE sql
    VOLATILE
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
      UPDATE patients p
      SET senha_hash = p_senha_hash,
          acesso_token_hash = NULL,
          acesso_token_expira_em = NULL,
          updated_at = now()
      WHERE p.acesso_token_hash = p_token_hash
        AND p.acesso_token_expira_em > now()
        AND p.status = 'ativo'
      RETURNING p.id, p.tenant_id, p.nome::text, p.email::text
    $$;
  `);

  await knex.raw('REVOKE ALL ON FUNCTION consume_patient_access_token(text, text) FROM PUBLIC');
  await knex.raw('GRANT EXECUTE ON FUNCTION consume_patient_access_token(text, text) TO nutrihub_app');

  // Só lia o token para validá-lo; quem faz isso agora é a função acima.
  await knex.raw('DROP FUNCTION IF EXISTS patient_by_access_token(text)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP FUNCTION IF EXISTS consume_patient_access_token(text, text)');

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

  await knex.raw('REVOKE ALL ON FUNCTION patient_by_access_token(text) FROM PUBLIC');
  await knex.raw('GRANT EXECUTE ON FUNCTION patient_by_access_token(text) TO nutrihub_app');
}
