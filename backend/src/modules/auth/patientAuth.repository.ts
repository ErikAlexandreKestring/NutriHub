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
}

/**
 * Credenciais do paciente (RF-02).
 *
 * As operações de autenticação passam por funções SECURITY DEFINER: no momento
 * do login (e do primeiro acesso) ainda não se sabe o tenant_id, então não há
 * como usar withTenant() — e sem app.current_tenant o RLS de `patients` bloqueia
 * a query. As funções tocam só as colunas de autenticação; qualquer outro acesso
 * continua sob RLS.
 *
 * Já `saveAccessToken` roda depois que o tenant é conhecido (quem chama é o
 * nutricionista autenticado), e por isso usa withTenant() normalmente,
 * respeitando a RN-01.
 */
export class PatientAuthRepository {
  constructor(private readonly connection: Knex = db) {}

  async findAuthCandidatesByEmail(email: string): Promise<PatientAuthRecord[]> {
    const result = await this.connection.raw('SELECT * FROM patient_auth_by_email(?)', [email]);
    return result.rows;
  }

  /**
   * Primeiro acesso: valida o token E grava a senha numa ÚNICA instrução, que
   * já apaga o token. Sem isso a validação e a escrita eram duas operações
   * separadas, e duas requisições concorrentes com o mesmo token passavam as
   * duas pela validação — cada uma gravava uma senha, e a última vencia.
   *
   * Devolve undefined quando o UPDATE não alcança nenhuma linha (token
   * inexistente, expirado, já consumido ou de paciente inativo), que é
   * exatamente o caso de erro E-21.
   *
   * Roda por função SECURITY DEFINER pelo mesmo motivo das leituras: neste
   * ponto ainda não se sabe o tenant_id, então não há como usar withTenant().
   */
  async consumeAccessToken(
    tokenHash: string,
    senhaHash: string,
  ): Promise<PatientAccessTokenRecord | undefined> {
    const result = await this.connection.raw('SELECT * FROM consume_patient_access_token(?, ?)', [
      tokenHash,
      senhaHash,
    ]);
    return result.rows[0];
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
