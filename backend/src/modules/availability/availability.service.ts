import { AvailabilityRepository } from './availability.repository';
import { CreateAvailabilityInput } from './availability.validation';
import { AvailabilityNotFoundError } from '../../shared/errors/AppError';

export class AvailabilityService {
  constructor(private readonly repository: AvailabilityRepository = new AvailabilityRepository()) {}

  async create(tenantId: string, input: CreateAvailabilityInput) {
    return this.repository.create(tenantId, input);
  }

  async list(tenantId: string) {
    return this.repository.list(tenantId);
  }

  async delete(tenantId: string, id: string) {
    const existing = await this.repository.findById(tenantId, id);
    if (!existing) {
      throw new AvailabilityNotFoundError();
    }
    await this.repository.delete(tenantId, id);
  }
}
