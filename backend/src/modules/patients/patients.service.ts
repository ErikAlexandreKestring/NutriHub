import { PatientsRepository } from './patients.repository';
import { PatientAuthRepository } from '../auth/patientAuth.repository';
import { EmailAlreadyRegisteredError, PatientNotFoundError } from '../../shared/errors/AppError';
import { CreatePatientInput, UpdatePatientInput } from './patients.validation';
import { accessTokenExpiresAt, generateAccessToken, hashAccessToken } from '../../shared/utils/accessToken';

export class PatientsService {
  constructor(
    private readonly repository: PatientsRepository = new PatientsRepository(),
    private readonly patientAuthRepository: PatientAuthRepository = new PatientAuthRepository(),
  ) {}

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

  /**
   * RF-02: gera o token de primeiro acesso do paciente. O banco guarda apenas o
   * SHA-256; o token em claro é devolvido UMA ÚNICA VEZ, aqui, para o
   * nutricionista repassar ao paciente. Gerar de novo invalida o anterior.
   *
   * O envio automático desse link (e-mail/WhatsApp) é o RF-07, ainda não
   * implementado — por enquanto a entrega é manual pelo nutricionista.
   */
  async generateAccessToken(tenantId: string, id: string) {
    const patient = await this.getById(tenantId, id);

    const token = generateAccessToken();
    const expiraEm = accessTokenExpiresAt();
    await this.patientAuthRepository.saveAccessToken(tenantId, patient.id, hashAccessToken(token), expiraEm);

    return { patient_id: patient.id, token, expira_em: expiraEm.toISOString() };
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
