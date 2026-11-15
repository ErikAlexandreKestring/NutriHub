import type { Knex } from 'knex';

// O mesmo e-mail pode ser paciente de dois nutricionistas (o paciente trocou de
// consultório). Quando os dois cadastros estão ativos e a senha é a mesma, o
// desempate pelo bcrypt não resolve — e a função não tinha ORDER BY, então quem
// entrava era o primeiro que o Postgres devolvesse, às vezes o consultório antigo.
//
// Agora os candidatos saem do vínculo mais recente para o mais antigo: o
// nutricionista atual é o que o paciente enxerga. O consultório antigo continua
// isolado (RLS) e pode inativar o cadastro, que perde o acesso de qualquer forma.
// A assinatura não muda, por isso CREATE OR REPLACE basta.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION patient_auth_by_email(p_email text)
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
      ORDER BY p.created_at DESC, p.id
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION patient_auth_by_email(p_email text)
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
}
