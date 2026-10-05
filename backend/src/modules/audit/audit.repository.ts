import { Knex } from 'knex';
import { db } from '../../db/connection';

// RNF-10: eventos registrados no log de auditoria. Novos eventos entram aqui
// conforme as ações críticas da RFC (login, plano, agenda) forem cobertas.
export type AuditEvent = 'TOKEN_TENANT_INVALIDO';

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
