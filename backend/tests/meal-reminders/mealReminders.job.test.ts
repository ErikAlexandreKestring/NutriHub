import { MealRemindersJob } from '../../src/modules/meal-reminders/mealReminders.job';

// 2026-11-10 em Brasília (UTC-3): 18:59 = 21:59Z, 19:00 = 22:00Z.
const ANTES = new Date('2026-11-10T21:59:00Z');
const NA_HORA = new Date('2026-11-10T22:00:00Z');
const MAIS_TARDE = new Date('2026-11-10T23:30:00Z');
const DIA_SEGUINTE = new Date('2026-11-11T22:05:00Z');

function criarJob(resultado = { enviados: 1, falhas: 0 }) {
  let agora = ANTES;
  const enviarDoDia = jest.fn().mockResolvedValue(resultado);
  const job = new MealRemindersJob({
    service: { enviarDoDia },
    horario: '19:00',
    intervalMs: 60_000,
    agora: () => agora,
  });
  return {
    job,
    enviarDoDia,
    em(data: Date) {
      agora = data;
    },
  };
}

describe('MealRemindersJob (RF-07)', () => {
  it('não roda antes do horário configurado', async () => {
    const { job, enviarDoDia } = criarJob();

    await job.runOnce();

    expect(enviarDoDia).not.toHaveBeenCalled();
  });

  it('roda uma vez a partir do horário e não repete no mesmo dia', async () => {
    const { job, enviarDoDia, em } = criarJob();

    em(NA_HORA);
    await job.runOnce();
    em(MAIS_TARDE);
    await job.runOnce();

    expect(enviarDoDia).toHaveBeenCalledTimes(1);
    expect(enviarDoDia).toHaveBeenCalledWith(NA_HORA);
  });

  it('roda de novo no dia seguinte', async () => {
    const { job, enviarDoDia, em } = criarJob();

    em(NA_HORA);
    await job.runOnce();
    em(DIA_SEGUINTE);
    await job.runOnce();

    expect(enviarDoDia).toHaveBeenCalledTimes(2);
  });

  // A API estava desligada às 19:00: o lembrete sai quando ela voltar.
  it('recupera o dia quando a API sobe depois do horário', async () => {
    const { job, enviarDoDia, em } = criarJob();

    em(MAIS_TARDE);
    await job.runOnce();

    expect(enviarDoDia).toHaveBeenCalledWith(MAIS_TARDE);
  });

  it('tenta de novo na próxima volta quando algum consultório falhou', async () => {
    const { job, enviarDoDia, em } = criarJob({ enviados: 0, falhas: 1 });

    em(NA_HORA);
    await job.runOnce();
    await job.runOnce();

    expect(enviarDoDia).toHaveBeenCalledTimes(2);
  });

  it('não derruba o processo quando a varredura inteira falha', async () => {
    const { job, enviarDoDia, em } = criarJob();
    enviarDoDia.mockRejectedValueOnce(new Error('banco fora'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    em(NA_HORA);
    await expect(job.runOnce()).resolves.toBeUndefined();
    await job.runOnce();

    expect(enviarDoDia).toHaveBeenCalledTimes(2);
  });

  it('não começa uma segunda varredura enquanto a primeira não terminou', async () => {
    const { job, enviarDoDia, em } = criarJob();
    let terminar: (valor: { enviados: number; falhas: number }) => void = () => undefined;
    enviarDoDia.mockReturnValueOnce(new Promise((resolve) => (terminar = resolve)));

    em(NA_HORA);
    const primeira = job.runOnce();
    const segunda = job.runOnce();
    terminar({ enviados: 0, falhas: 0 });
    await Promise.all([primeira, segunda]);

    expect(enviarDoDia).toHaveBeenCalledTimes(1);
  });
});
