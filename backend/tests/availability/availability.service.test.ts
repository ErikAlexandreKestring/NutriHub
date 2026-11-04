import { AvailabilityService } from '../../src/modules/availability/availability.service';
import { AvailabilityRepository, AvailabilityRecord } from '../../src/modules/availability/availability.repository';
import { AvailabilityNotFoundError, ValidationError } from '../../src/shared/errors/AppError';

function buildSlot(overrides: Partial<AvailabilityRecord> = {}): AvailabilityRecord {
  return {
    id: 'slot-1',
    tenant_id: 'tenant-1',
    day_of_week: 1,
    start_time: '08:00:00',
    end_time: '12:00:00',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('AvailabilityService (RF-08)', () => {
  let repository: jest.Mocked<AvailabilityRepository>;
  let service: AvailabilityService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      listByDay: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<AvailabilityRepository>;
    service = new AvailabilityService(repository);
  });

  it('cria um intervalo de disponibilidade', async () => {
    repository.create.mockResolvedValue({ criado: buildSlot() });
    const result = await service.create('tenant-1', { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' });
    expect(result.day_of_week).toBe(1);
  });

  it('recusa intervalo sobreposto, apontando o que já ocupa o horário', async () => {
    repository.create.mockResolvedValue({ conflito: buildSlot({ start_time: '10:00:00', end_time: '18:00:00' }) });

    const erro = await service
      .create('tenant-1', { dayOfWeek: 1, startTime: '10:00', endTime: '16:00' })
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ValidationError);
    expect((erro as ValidationError).issues).toEqual([
      {
        path: 'start_time',
        message: 'Este horário se sobrepõe ao intervalo 10:00–18:00 de segunda-feira, já cadastrado.',
      },
    ]);
  });

  it('lista os intervalos do tenant', async () => {
    repository.list.mockResolvedValue([buildSlot()]);
    const result = await service.list('tenant-1');
    expect(result).toHaveLength(1);
  });

  it('remove um intervalo existente', async () => {
    repository.findById.mockResolvedValue(buildSlot());
    repository.delete.mockResolvedValue(1);
    await expect(service.delete('tenant-1', 'slot-1')).resolves.toBeUndefined();
    expect(repository.delete).toHaveBeenCalledWith('tenant-1', 'slot-1');
  });

  it('lança AvailabilityNotFoundError ao remover intervalo inexistente', async () => {
    repository.findById.mockResolvedValue(undefined);
    await expect(service.delete('tenant-1', 'inexistente')).rejects.toThrow(AvailabilityNotFoundError);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
