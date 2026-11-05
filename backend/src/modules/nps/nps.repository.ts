import { withTenant } from '../../db/connection';

export interface NpsPesquisaRecord {
  id: string;
  tenant_id: string;
  patient_id: string;
  meal_plan_id: string | null;
  nota: number | null;
  comentario: string | null;
  enviada_em: Date;
  respondida_em: Date | null;
}

/** Uma resposta no painel do nutricionista, com o nome de quem avaliou. */
export interface NpsRespostaComPaciente {
  id: string;
  patient_id: string;
  patient_nome: string;
  nota: number;
  comentario: string | null;
  respondida_em: Date;
}

export interface NpsContagem {
  enviadas: number;
  respostas: number;
  promotores: number;
  neutros: number;
  detratores: number;
}

/** RN-05: "no máximo uma vez por trimestre por paciente". */
export const INTERVALO_ENTRE_PESQUISAS = '3 months';

export class NpsRepository {
  /**
   * Cria a pesquisa só se o paciente não recebeu nenhuma nos últimos três
   * meses (RN-05). A verificação e a inserção correm sob um lock por paciente
   * para que duas publicações simultâneas não gerem duas pesquisas.
   *
   * Devolve undefined quando a regra do trimestre barrou o envio.
   */
  async criarSeForaDoTrimestre(
    tenantId: string,
    patientId: string,
    mealPlanId: string,
  ): Promise<NpsPesquisaRecord | undefined> {
    return withTenant(tenantId, async (trx) => {
      // Lock de transação: some sozinho no COMMIT/ROLLBACK.
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`nps:${patientId}`]);

      const recente = await trx('nps_pesquisas')
        .where({ patient_id: patientId })
        .where('enviada_em', '>', trx.raw(`now() - interval '${INTERVALO_ENTRE_PESQUISAS}'`))
        .first('id');
      if (recente) return undefined;

      const [pesquisa] = await trx('nps_pesquisas')
        .insert({ tenant_id: tenantId, patient_id: patientId, meal_plan_id: mealPlanId })
        .returning('*');
      return pesquisa;
    });
  }

  /** A pesquisa em aberto mais recente do paciente, se houver. */
  async findPendenteByPatient(tenantId: string, patientId: string): Promise<NpsPesquisaRecord | undefined> {
    return withTenant(tenantId, (trx) =>
      trx('nps_pesquisas')
        .where({ patient_id: patientId })
        .whereNull('respondida_em')
        .orderBy('enviada_em', 'desc')
        .first(),
    );
  }

  async findById(tenantId: string, id: string): Promise<NpsPesquisaRecord | undefined> {
    return withTenant(tenantId, (trx) => trx('nps_pesquisas').where({ id }).first());
  }

  /**
   * A condição `respondida_em IS NULL` vai no próprio UPDATE: uma segunda
   * resposta (outra aba, clique duplo) não sobrescreve a primeira — não alcança
   * linha nenhuma e devolve undefined.
   */
  async responder(
    tenantId: string,
    id: string,
    patientId: string,
    nota: number,
    comentario: string | null,
  ): Promise<NpsPesquisaRecord | undefined> {
    return withTenant(tenantId, async (trx) => {
      const [pesquisa] = await trx('nps_pesquisas')
        .where({ id, patient_id: patientId })
        .whereNull('respondida_em')
        .update({ nota, comentario, respondida_em: trx.fn.now() })
        .returning('*');
      return pesquisa;
    });
  }

  // RF-09: consolidação do consultório. O RLS já restringe ao tenant da sessão.
  async contar(tenantId: string): Promise<NpsContagem> {
    return withTenant(tenantId, async (trx) => {
      const linha = await trx('nps_pesquisas')
        .select(
          trx.raw('count(*)::int AS enviadas'),
          trx.raw('count(nota)::int AS respostas'),
          trx.raw('count(*) FILTER (WHERE nota >= 9)::int AS promotores'),
          trx.raw('count(*) FILTER (WHERE nota BETWEEN 7 AND 8)::int AS neutros'),
          trx.raw('count(*) FILTER (WHERE nota <= 6)::int AS detratores'),
        )
        .first();
      return linha as NpsContagem;
    });
  }

  async listarRespostas(tenantId: string, limite: number): Promise<NpsRespostaComPaciente[]> {
    return withTenant(tenantId, (trx) =>
      trx('nps_pesquisas')
        .join('patients', 'patients.id', 'nps_pesquisas.patient_id')
        .whereNotNull('nps_pesquisas.respondida_em')
        .select(
          'nps_pesquisas.id',
          'nps_pesquisas.patient_id',
          'patients.nome as patient_nome',
          'nps_pesquisas.nota',
          'nps_pesquisas.comentario',
          'nps_pesquisas.respondida_em',
        )
        .orderBy('nps_pesquisas.respondida_em', 'desc')
        .limit(limite),
    );
  }
}
