import { Knex } from 'knex';
import { db } from '../../db/connection';

export interface TenantRecord {
  id: string;
  nome: string;
  email: string;
  crn: string;
  senha_hash: string;
  cancelamento_antecedencia_horas: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTenantInput {
  nome: string;
  email: string;
  crn: string;
  senhaHash: string;
}

/**
 * Repositório isolado da camada de negócio para facilitar testes unitários
 * (mock de `AuthRepository` no lugar de subir um Postgres real).
 */
export class AuthRepository {
  constructor(private readonly connection: Knex = db) {}

  async findByEmail(email: string): Promise<TenantRecord | undefined> {
    return this.connection('tenants').where({ email }).first();
  }

  async findById(id: string): Promise<TenantRecord | undefined> {
    return this.connection('tenants').where({ id }).first();
  }

  async create(input: CreateTenantInput): Promise<TenantRecord> {
    const [tenant] = await this.connection('tenants')
      .insert({
        nome: input.nome,
        email: input.email,
        crn: input.crn,
        senha_hash: input.senhaHash,
      })
      .returning('*');

    return tenant;
  }
}
