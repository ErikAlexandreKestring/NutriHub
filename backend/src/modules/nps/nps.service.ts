import { NpsContagem, NpsPesquisaRecord, NpsRepository, NpsRespostaComPaciente } from './nps.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { ResponderNpsInput } from './nps.validation';
import { NpsJaRespondidaError, NpsPesquisaNotFoundError } from '../../shared/errors/AppError';

/** Quantas respostas recentes o painel mostra junto do índice. */
export const RESPOSTAS_NO_PAINEL = 20;

export interface NpsResumo extends NpsContagem {
  /** De -100 a 100; nulo enquanto não houver resposta. */
  nps: number | null;
  /** De 0 a 1; nulo enquanto nenhuma pesquisa tiver sido enviada. */
  taxaResposta: number | null;
  recentes: NpsRespostaComPaciente[];
}

/**
 * NPS = % de promotores (9–10) − % de detratores (0–6). Neutros (7–8) entram
 * só no total. Arredondado para inteiro, como o índice costuma ser lido.
 */
export function calcularNps(contagem: Pick<NpsContagem, 'respostas' | 'promotores' | 'detratores'>): number | null {
  if (contagem.respostas === 0) return null;
  return Math.round(((contagem.promotores - contagem.detratores) / contagem.respostas) * 100);
}

export class NpsService {
  constructor(
    private readonly repository: NpsRepository = new NpsRepository(),
    private readonly notifications: NotificationsService = new NotificationsService(),
  ) {}

  /**
   * RF-09 / RN-05: chamado quando a publicação de um plano encerra o anterior
   * — é o "final de um ciclo de plano". O primeiro plano do paciente não
   * dispara nada (não havia plano para encerrar), e a regra do trimestre fica
   * no repositório.
   *
   * Não lança: a publicação do plano já foi gravada quando chega aqui, e uma
   * pesquisa que não saiu não pode desfazê-la.
   */
  async aoEncerrarPlano(tenantId: string, patientId: string, mealPlanId: string): Promise<void> {
    try {
      const pesquisa = await this.repository.criarSeForaDoTrimestre(tenantId, patientId, mealPlanId);
      if (pesquisa) {
        await this.notifications.npsSolicitado(tenantId, pesquisa);
      }
    } catch (erro) {
      console.error(`Falha ao criar a pesquisa NPS do paciente ${patientId} (tenant ${tenantId})`, erro);
    }
  }

  // UC-07: o que a tela do paciente mostra ao abrir o link do e-mail.
  async pendente(tenantId: string, patientId: string): Promise<NpsPesquisaRecord | null> {
    return (await this.repository.findPendenteByPatient(tenantId, patientId)) ?? null;
  }

  async responder(
    tenantId: string,
    patientId: string,
    pesquisaId: string,
    input: ResponderNpsInput,
  ): Promise<NpsPesquisaRecord> {
    const respondida = await this.repository.responder(
      tenantId,
      pesquisaId,
      patientId,
      input.nota,
      input.comentario ?? null,
    );
    if (respondida) return respondida;

    // O UPDATE não alcançou a linha: ou ela não existe para este paciente
    // (outro paciente ou outro tenant parecem iguais), ou já foi respondida.
    const existente = await this.repository.findById(tenantId, pesquisaId);
    if (!existente || existente.patient_id !== patientId) {
      throw new NpsPesquisaNotFoundError();
    }
    throw new NpsJaRespondidaError();
  }

  // RF-09: "consolidar os resultados no painel do nutricionista".
  async resumo(tenantId: string): Promise<NpsResumo> {
    const [contagem, recentes] = await Promise.all([
      this.repository.contar(tenantId),
      this.repository.listarRespostas(tenantId, RESPOSTAS_NO_PAINEL),
    ]);

    return {
      ...contagem,
      nps: calcularNps(contagem),
      taxaResposta: contagem.enviadas === 0 ? null : contagem.respostas / contagem.enviadas,
      recentes,
    };
  }
}
