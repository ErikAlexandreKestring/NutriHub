import { MealRemindersService } from '../../src/modules/meal-reminders/mealReminders.service';
import { MealRemindersRepository } from '../../src/modules/meal-reminders/mealReminders.repository';
import { PatientNotFoundError } from '../../src/shared/errors/AppError';

const AGORA = new Date('2026-11-10T22:00:00Z'); // 19:00 em Brasília

describe('MealRemindersService (RF-07)', () => {
  let repository: jest.Mocked<MealRemindersRepository>;
  let enqueue: jest.Mock;
  let service: MealRemindersService;

  beforeEach(() => {
    repository = {
      listTenantIds: jest.fn().mockResolvedValue(['tenant-1']),
      reservarDoDia: jest.fn().mockResolvedValue([]),
      getPreferencia: jest.fn(),
      setPreferencia: jest.fn(),
    } as unknown as jest.Mocked<MealRemindersRepository>;
    enqueue = jest.fn().mockResolvedValue(undefined);
    service = new MealRemindersService(repository, { enqueue }, { appUrl: 'https://app.test' });
  });

  it('reserva com a data e a hora de Brasília e enfileira um e-mail por paciente', async () => {
    repository.reservarDoDia.mockResolvedValue([
      {
        patientId: 'p1',
        nome: 'Maria Souza',
        email: 'maria@paciente.test',
        refeicoes: [{ nome: 'Almoço', horario: '12:00:00' }],
      },
    ]);

    await expect(service.enviarDoDia(AGORA)).resolves.toEqual({ enviados: 1, falhas: 0 });

    expect(repository.reservarDoDia).toHaveBeenCalledWith('tenant-1', '2026-11-10', '19:00');
    expect(enqueue).toHaveBeenCalledWith('tenant-1', [
      expect.objectContaining({
        evento: 'LEMBRETE_REFEICOES',
        canal: 'email',
        destino: 'maria@paciente.test',
        referenciaId: 'p1',
        conteudo: expect.objectContaining({ texto: expect.stringContaining('12:00 — Almoço') }),
      }),
    ]);
  });

  it('a falha num consultório não impede os outros', async () => {
    repository.listTenantIds.mockResolvedValue(['tenant-1', 'tenant-2']);
    repository.reservarDoDia
      .mockRejectedValueOnce(new Error('falhou'))
      .mockResolvedValueOnce([
        {
          patientId: 'p2',
          nome: 'João',
          email: 'joao@paciente.test',
          refeicoes: [{ nome: 'Jantar', horario: '19:00' }],
        },
      ]);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.enviarDoDia(AGORA)).resolves.toEqual({ enviados: 1, falhas: 1 });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith('tenant-2', [expect.objectContaining({ destino: 'joao@paciente.test' })]);
  });

  it('devolve e grava a preferência do paciente', async () => {
    repository.getPreferencia.mockResolvedValue(true);
    repository.setPreferencia.mockResolvedValue(false);

    await expect(service.preferencia('tenant-1', 'p1')).resolves.toEqual({ ativo: true });
    await expect(service.definirPreferencia('tenant-1', 'p1', false)).resolves.toEqual({ ativo: false });
    expect(repository.setPreferencia).toHaveBeenCalledWith('tenant-1', 'p1', false);
  });

  it('paciente fora do tenant dá 404', async () => {
    repository.getPreferencia.mockResolvedValue(undefined);
    repository.setPreferencia.mockResolvedValue(undefined);

    await expect(service.preferencia('tenant-1', 'p-x')).rejects.toThrow(PatientNotFoundError);
    await expect(service.definirPreferencia('tenant-1', 'p-x', true)).rejects.toThrow(PatientNotFoundError);
  });
});
