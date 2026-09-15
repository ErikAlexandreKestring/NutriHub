import { Knex } from 'knex';
import { db, withTenant } from '../../db/connection';

// Projeção mínima devolvida por patient_auth_by_email() — nenhum dado clínico.
export interface PatientAuthRecord {
  id: string;
  tenant_id: string;
  nome: string;
  email: string;
  senha_hash: string;
  status: 'ativo' | 'inativo';
}

export interface PatientAccessTokenRecord {
  id: string;
  tenant_id: string;
  nome: string;
  email: string;
  acesso_token_expira_em: Date | null;
}

/**
 * Credenciais do paciente (RF-02).
 *
 * As duas leituras de autenticação passam pelas funções SECURITY DEFINER
 * criadas na migration add_credentials_to_patients: no momento do login ainda
 * não se sabe o tenant_id, então não há como usar withTenant() — e sem
 * app.current_tenant o RLS de `patients` bloqueia a query. As funções expõem
 * só as colunas de autenticação; qualquer outro acesso continua sob RLS.
 *
 * Já as ESCRITAS acontecem depois que o tenant é conhecido, e por isso usam
 * withTenant() normalmente, respeitando a RN-01.
 */
export class PatientAuthRepository {
  constructor(private readonly connection: Knex = db) {}

  async findAuthCandidatesByEmail(email: string): Promise<PatientAuthRecord[]> {
    const result = await this.connection.raw('SELECT * FROM patient_auth_by_email(?)', [email]);
    return result.rows;
  }

  async findByAccessTokenHash(tokenHash: string): Promise<PatientAccessTokenRecord | undefined> {
    const result = await this.connection.raw('SELECT * FROM patient_by_access_token(?)', [tokenHash]);
    return result.rows[0];
  }

  // Consome o token no mesmo UPDATE que grava a senha: um link de primeiro
  // acesso vale por uma única definição de senha.
  async setPassword(tenantId: string, patientId: string, senhaHash: string): Promise<void> {
    await withTenant(tenantId, (trx) =>
      trx('patients').where({ id: patientId }).update({
        senha_hash: senhaHash,
        acesso_token_hash: null,
        acesso_token_expira_em: null,
        updated_at: trx.fn.now(),
      }),
    );
  }

  async saveAccessToken(
    tenantId: string,
    patientId: string,
    tokenHash: string,
    expiraEm: Date,
  ): Promise<void> {
    await withTenant(tenantId, (trx) =>
      trx('patients').where({ id: patientId }).update({
        acesso_token_hash: tokenHash,
        acesso_token_expira_em: expiraEm,
        updated_at: trx.fn.now(),
      }),
    );
  }
}
