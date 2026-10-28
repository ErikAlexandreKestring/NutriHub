import { Knex } from 'knex';
import { db } from '../../db/connection';

// RNF-10: eventos registrados no log de auditoria — as ações críticas da RFC
// seção 6.5, mais o E-06.
export type AuditEvent =
  | 'TOKEN_TENANT_INVALIDO'
  | 'LOGIN_SUCESSO'
  | 'LOGIN_FALHOU'
  | 'PRIMEIRO_ACESSO'
  | 'PLANO_CRIADO'
  | 'PLANO_ALTERADO'
  | 'PLANO_PUBLICADO'
  | 'CONSULTA_AGENDADA'
  | 'CONSULTA_CANCELADA'
  | 'CONSULTA_REMARCADA'
  | 'FEEDBACK_REGISTRADO'
  | 'FEEDBACK_RESOLVIDO'
  | 'DISPONIBILIDADE_CRIADA'
  | 'DISPONIBILIDADE_REMOVIDA'
  | 'PACIENTE_INATIVADO';

export interface AuditEntry {
  evento: AuditEvent;
  userId?: string;
  tenantId?: string;
  ip?: string;
  detalhes?: Record<string, unknown>;
}

/**
 * Grava direto em `audit_logs`, fora de withTenant(): a tabela não tem RLS
 * porque precisa aceitar eventos de tenants inexistentes (ver migration).
 */
export class AuditRepository {
  constructor(private readonly connection: Knex = db) {}

  async register(entry: AuditEntry): Promise<void> {
    await this.connection('audit_logs').insert({
      evento: entry.evento,
      user_id: entry.userId ?? null,
      tenant_id: entry.tenantId ?? null,
      ip: entry.ip ?? null,
      detalhes: entry.detalhes ?? null,
    });
  }
}
