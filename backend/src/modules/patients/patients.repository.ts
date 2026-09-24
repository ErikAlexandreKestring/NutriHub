import type { Knex } from 'knex';
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
  /** O paciente já fez o primeiro acesso (tem senha definida) e consegue logar. */
  acesso_liberado: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Colunas que a API pode devolver. Listadas uma a uma, e não `*`, porque a
 * tabela guarda também `senha_hash` e `acesso_token_hash` (RF-02): com `*`
 * esses hashes iam no JSON de toda listagem de pacientes do nutricionista.
 *
 * `data_nascimento` sai formatada no banco porque o driver converte `date` em
 * `Date` à meia-noite do fuso do servidor — serializado, o dia podia mudar.
 */
function colunasPublicas(conexao: Knex | Knex.Transaction): Array<string | Knex.Raw> {
  return [
    'id',
    'tenant_id',
    'nome',
    'email',
    conexao.raw("to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento"),
    'contato',
    'historico',
    'status',
    conexao.raw('(senha_hash IS NOT NULL) AS acesso_liberado'),
    'created_at',
    'updated_at',
  ];
}

/**
 * Toda query passa por withTenant(), que ativa a política de RLS da tabela
 * `patients` (RN-01): sem o tenant_id setado na sessão, o Postgres não retorna
 * nem aceita gravar nenhuma linha.
 */
export class PatientsRepository {
  async findByEmail(tenantId: string, email: string): Promise<PatientRecord | undefined> {
    return withTenant(tenantId, (trx) =>
      trx('patients')
        .select(colunasPublicas(trx))
        .where({ email })
        .first(),
    );
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
        .returning(colunasPublicas(trx));
      return patient;
    });
  }

  async list(tenantId: string): Promise<PatientRecord[]> {
    return withTenant(tenantId, (trx) => trx('patients').select(colunasPublicas(trx)).orderBy('nome'));
  }

  async findById(tenantId: string, id: string): Promise<PatientRecord | undefined> {
    return withTenant(tenantId, (trx) =>
      trx('patients')
        .select(colunasPublicas(trx))
        .where({ id })
        .first(),
    );
  }

  async update(tenantId: string, id: string, input: UpdatePatientInput): Promise<PatientRecord | undefined> {
    return withTenant(tenantId, async (trx) => {
      const updates: Record<string, unknown> = { updated_at: trx.fn.now() };
      if (input.nome !== undefined) updates.nome = input.nome;
      if (input.email !== undefined) updates.email = input.email;
      if (input.dataNascimento !== undefined) updates.data_nascimento = input.dataNascimento;
      if (input.contato !== undefined) updates.contato = input.contato;
      if (input.historico !== undefined) updates.historico = input.historico;

      const [patient] = await trx('patients').where({ id }).update(updates).returning(colunasPublicas(trx));
      return patient;
    });
  }

  async inactivate(tenantId: string, id: string): Promise<PatientRecord | undefined> {
    return withTenant(tenantId, async (trx) => {
      const [patient] = await trx('patients')
        .where({ id })
        .update({ status: 'inativo', updated_at: trx.fn.now() })
        .returning(colunasPublicas(trx));
      return patient;
    });
  }
}
