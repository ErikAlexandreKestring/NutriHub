import { withTenant } from '../../db/connection';
import { CreatePatientInput, UpdatePatientInput } from './patients.validation';

export interface PatientRecord {
  id: string;
  tenant_id: string;
  nome: string;
  email: string;
  data_nascimento: string;
  contato: string | null;
  historico: string | null;
  status: 'ativo' | 'inativo';
  created_at: Date;
  updated_at: Date;
}

/**
 * Toda query passa por withTenant(), que ativa a política de RLS da tabela
 * `patients` (RN-01): sem o tenant_id setado na sessão, o Postgres não retorna
 * nem aceita gravar nenhuma linha.
 */
export class PatientsRepository {
  async findByEmail(tenantId: string, email: string): Promise<PatientRecord | undefined> {
    return withTenant(tenantId, (trx) => trx('patients').where({ email }).first());
  }

  async create(tenantId: string, input: CreatePatientInput): Promise<PatientRecord> {
    return withTenant(tenantId, async (trx) => {
      const [patient] = await trx('patients')
        .insert({
          tenant_id: tenantId,
          nome: input.nome,
          email: input.email,
          data_nascimento: input.dataNascimento,
          contato: input.contato ?? null,
          historico: input.historico ?? null,
        })
        .returning('*');
      return patient;
    });
  }

  async list(tenantId: string): Promise<PatientRecord[]> {
    return withTenant(tenantId, (trx) => trx('patients').orderBy('nome'));
  }

  async findById(tenantId: string, id: string): Promise<PatientRecord | undefined> {
    return withTenant(tenantId, (trx) => trx('patients').where({ id }).first());
  }

  async update(tenantId: string, id: string, input: UpdatePatientInput): Promise<PatientRecord | undefined> {
    return withTenant(tenantId, async (trx) => {
      const updates: Record<string, unknown> = { updated_at: trx.fn.now() };
      if (input.nome !== undefined) updates.nome = input.nome;
      if (input.email !== undefined) updates.email = input.email;
      if (input.dataNascimento !== undefined) updates.data_nascimento = input.dataNascimento;
      if (input.contato !== undefined) updates.contato = input.contato;
      if (input.historico !== undefined) updates.historico = input.historico;

      const [patient] = await trx('patients').where({ id }).update(updates).returning('*');
      return patient;
    });
  }

  async inactivate(tenantId: string, id: string): Promise<PatientRecord | undefined> {
    return withTenant(tenantId, async (trx) => {
      const [patient] = await trx('patients')
        .where({ id })
        .update({ status: 'inativo', updated_at: trx.fn.now() })
        .returning('*');
      return patient;
    });
  }
}
