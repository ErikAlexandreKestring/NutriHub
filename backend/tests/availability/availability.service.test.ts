import { AvailabilityService } from '../../src/modules/availability/availability.service';
import { AvailabilityRepository, AvailabilityRecord } from '../../src/modules/availability/availability.repository';
import { AvailabilityNotFoundError } from '../../src/shared/errors/AppError';

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
    repository.create.mockResolvedValue(buildSlot());
    const result = await service.create('tenant-1', { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' });
    expect(result.day_of_week).toBe(1);
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
