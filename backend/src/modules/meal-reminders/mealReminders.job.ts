import { getZonedDate, getZonedDayAndTime } from '../../shared/utils/timezone';
import type { MealRemindersService } from './mealReminders.service';

export interface MealRemindersJobDeps {
  service: Pick<MealRemindersService, 'enviarDoDia'>;
  /** HH:MM no fuso de America/Sao_Paulo. */
  horario: string;
  intervalMs: number;
  agora?: () => Date;
}

/**
 * Dispara o lembrete diário de refeições (RF-07) uma vez por dia, a partir de
 * `horario`. Confere o relógio a cada `intervalMs` em vez de agendar para a
 * hora exata: se a API estava desligada às 19:00, o lembrete sai quando ela
 * voltar, ainda no mesmo dia.
 *
 * A memória de "já rodou hoje" só evita varrer o banco à toa a cada minuto; quem
 * impede o e-mail repetido é a reserva no banco (patients.lembrete_refeicoes_em).
 */
export class MealRemindersJob {
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;
  private ultimoDia: string | undefined;

  constructor(private readonly deps: MealRemindersJobDeps) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.deps.intervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.running;
  }

  runOnce(): Promise<void> {
    if (this.running) return this.running;

    const agora = this.deps.agora?.() ?? new Date();
    const hoje = getZonedDate(agora);
    if (this.ultimoDia === hoje || getZonedDayAndTime(agora).timeOfDay < this.deps.horario) {
      return Promise.resolve();
    }

    this.running = this.deps.service
      .enviarDoDia(agora)
      .then(({ falhas }) => {
        // Com falha em algum consultório, tenta de novo na próxima volta; os
        // pacientes já reservados hoje não recebem outra vez.
        if (falhas === 0) this.ultimoDia = hoje;
      })
      .catch((erro: unknown) => {
        console.error('Falha na varredura dos lembretes de refeição', erro);
      })
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
}
