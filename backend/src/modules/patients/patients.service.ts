import { PatientsRepository } from './patients.repository';
import { EmailAlreadyRegisteredError, PatientNotFoundError } from '../../shared/errors/AppError';
import { CreatePatientInput, UpdatePatientInput } from './patients.validation';

export class PatientsService {
  constructor(private readonly repository: PatientsRepository = new PatientsRepository()) {}

  // RF-03: cadastro de paciente vinculado ao tenant do nutricionista autenticado.
  async create(tenantId: string, input: CreatePatientInput) {
    const existing = await this.repository.findByEmail(tenantId, input.email);
    if (existing) {
      throw new EmailAlreadyRegisteredError();
    }

    return this.repository.create(tenantId, input);
  }

  async list(tenantId: string) {
    return this.repository.list(tenantId);
  }

  async getById(tenantId: string, id: string) {
    const patient = await this.repository.findById(tenantId, id);
    if (!patient) {
      throw new PatientNotFoundError();
    }
    return patient;
  }

  // RF-03: edição de paciente já cadastrado.
  async update(tenantId: string, id: string, input: UpdatePatientInput) {
    await this.getById(tenantId, id);
    const patient = await this.repository.update(tenantId, id, input);
    if (!patient) {
      throw new PatientNotFoundError();
    }
    return patient;
  }

  // RF-03: "inativar" — não é exclusão física, só muda o status.
  async inactivate(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    const patient = await this.repository.inactivate(tenantId, id);
    if (!patient) {
      throw new PatientNotFoundError();
    }
    return patient;
  }
}
