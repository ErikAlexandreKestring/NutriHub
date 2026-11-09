import { env } from '../../config/env';
import { PatientNotFoundError } from '../../shared/errors/AppError';
import { getZonedDate, getZonedDayAndTime } from '../../shared/utils/timezone';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { lembreteRefeicoesEmail } from '../notifications/notifications.messages';
import { MealRemindersRepository } from './mealReminders.repository';

export interface ResultadoDoDia {
  enviados: number;
  /** Consultórios em que a varredura falhou; o job tenta de novo mais tarde. */
  falhas: number;
}

/**
 * RF-07: lembrete diário, por e-mail, das refeições que o paciente ainda não
 * marcou como feitas (UC-03). Um e-mail por paciente por dia, só quando há
 * refeição pendente, e só para quem não desligou o lembrete na PWA.
 */
export class MealRemindersService {
  constructor(
    private readonly repository: MealRemindersRepository = new MealRemindersRepository(),
    private readonly notifications: Pick<NotificationsRepository, 'enqueue'> = new NotificationsRepository(),
    private readonly options: { appUrl: string } = { appUrl: env.notifications.appUrl },
  ) {}

  /**
   * Enfileira os lembretes de hoje. Consultório por consultório, para que o
   * RLS continue valendo e a falha de um não impeça os outros.
   *
   * A reserva do paciente e o enfileiramento são transações separadas: se o
   * enfileiramento falhar depois da reserva, o paciente fica sem o lembrete
   * daquele dia (fica no log). É um aviso, não vale reenviar em dobro.
   */
  async enviarDoDia(agora: Date = new Date()): Promise<ResultadoDoDia> {
    const hoje = getZonedDate(agora);
    const { timeOfDay } = getZonedDayAndTime(agora);
    const resultado: ResultadoDoDia = { enviados: 0, falhas: 0 };

    for (const tenantId of await this.repository.listTenantIds()) {
      try {
        const lembretes = await this.repository.reservarDoDia(tenantId, hoje, timeOfDay);
        await this.notifications.enqueue(
          tenantId,
          lembretes.map((lembrete) => ({
            evento: 'LEMBRETE_REFEICOES',
            canal: 'email',
            destino: lembrete.email,
            conteudo: lembreteRefeicoesEmail({
              appUrl: this.options.appUrl,
              pacienteNome: lembrete.nome,
              refeicoes: lembrete.refeicoes,
            }),
            referenciaId: lembrete.patientId,
          })),
        );
        resultado.enviados += lembretes.length;
      } catch (erro) {
        resultado.falhas += 1;
        console.error(`Falha ao preparar os lembretes de refeição do tenant ${tenantId}`, erro);
      }
    }

    return resultado;
  }

  async preferencia(tenantId: string, patientId: string): Promise<{ ativo: boolean }> {
    const ativo = await this.repository.getPreferencia(tenantId, patientId);
    if (ativo === undefined) {
      throw new PatientNotFoundError();
    }
    return { ativo };
  }

  async definirPreferencia(tenantId: string, patientId: string, ativo: boolean): Promise<{ ativo: boolean }> {
    const salvo = await this.repository.setPreferencia(tenantId, patientId, ativo);
    if (salvo === undefined) {
      throw new PatientNotFoundError();
    }
    return { ativo: salvo };
  }
}
