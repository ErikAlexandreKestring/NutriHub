import type { Knex } from 'knex';
import { withTenant } from '../../db/connection';
import { decryptOptional, encryptOptional } from '../../shared/utils/sensitiveData';
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
 * RNF-03: `historico` é dado de saúde e fica cifrado no banco. Cifra na
 * gravação e decifra aqui, na saída do repositório — o resto da aplicação só
 * vê texto em claro.
 */
function decifrar(patient: PatientRecord): PatientRecord;
function decifrar(patient: PatientRecord | undefined): PatientRecord | undefined;
function decifrar(patient: PatientRecord | undefined): PatientRecord | undefined {
  return patient && { ...patient, historico: decryptOptional(patient.historico) };
}

/**
 * Toda query passa por withTenant(), que ativa a política de RLS da tabela
 * `patients` (RN-01): sem o tenant_id setado na sessão, o Postgres não retorna
 * nem aceita gravar nenhuma linha.
 */
export class PatientsRepository {
  async findByEmail(tenantId: string, email: string): Promise<PatientRecord | undefined> {
    const patient = await withTenant(tenantId, (trx) =>
      trx('patients')
        .select(colunasPublicas(trx))
        .where({ email })
        .first(),
    );
    return decifrar(patient);
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
          historico: encryptOptional(input.historico ?? null),
        })
        .returning(colunasPublicas(trx));
      return decifrar(patient);
    });
  }

  async list(tenantId: string): Promise<PatientRecord[]> {
    const patients = await withTenant(tenantId, (trx) => trx('patients').select(colunasPublicas(trx)).orderBy('nome'));
    return patients.map((patient: PatientRecord) => decifrar(patient));
  }

  async findById(tenantId: string, id: string): Promise<PatientRecord | undefined> {
    const patient = await withTenant(tenantId, (trx) =>
      trx('patients')
        .select(colunasPublicas(trx))
        .where({ id })
        .first(),
    );
    return decifrar(patient);
  }

  async update(tenantId: string, id: string, input: UpdatePatientInput): Promise<PatientRecord | undefined> {
    return withTenant(tenantId, async (trx) => {
      const updates: Record<string, unknown> = { updated_at: trx.fn.now() };
      if (input.nome !== undefined) updates.nome = input.nome;
      if (input.email !== undefined) updates.email = input.email;
      if (input.dataNascimento !== undefined) updates.data_nascimento = input.dataNascimento;
      if (input.contato !== undefined) updates.contato = input.contato;
      if (input.historico !== undefined) updates.historico = encryptOptional(input.historico);

      const [patient] = await trx('patients').where({ id }).update(updates).returning(colunasPublicas(trx));
      return decifrar(patient);
    });
  }

  async inactivate(tenantId: string, id: string): Promise<PatientRecord | undefined> {
    return this.setStatus(tenantId, id, 'inativo');
  }

  async reactivate(tenantId: string, id: string): Promise<PatientRecord | undefined> {
    return this.setStatus(tenantId, id, 'ativo');
  }

  private async setStatus(
    tenantId: string,
    id: string,
    status: PatientRecord['status'],
  ): Promise<PatientRecord | undefined> {
    return withTenant(tenantId, async (trx) => {
      const [patient] = await trx('patients')
        .where({ id })
        .update({ status, updated_at: trx.fn.now() })
        .returning(colunasPublicas(trx));
      return decifrar(patient);
    });
  }

  /**
   * RNF-03 / RFC 6.4, direito de exclusão: apaga o paciente de vez. O ON DELETE
   * CASCADE leva planos, refeições, consultas e feedbacks. A fila de
   * notificações não tem chave estrangeira para o paciente — liga cada
   * mensagem ao plano, consulta ou feedback pelo `referencia_id` — e guarda
   * e-mail, telefone e o texto dos relatos, então sai antes, na mesma
   * transação.
   *
   * O log de auditoria fica: guarda só identificadores, e é a prova de que a
   * exclusão foi feita.
   */
  async deleteWithData(tenantId: string, id: string): Promise<boolean> {
    return withTenant(tenantId, async (trx) => {
      await trx('notifications')
        .whereIn('referencia_id', trx('meal_plans').select('id').where({ patient_id: id }))
        .orWhereIn('referencia_id', trx('appointments').select('id').where({ patient_id: id }))
        .orWhereIn('referencia_id', trx('feedbacks').select('id').where({ patient_id: id }))
        .delete();
      const apagados = await trx('patients').where({ id }).delete();
      return apagados > 0;
    });
  }
}
