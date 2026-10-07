import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { NotificationJob, NotificationsRepository } from '../../src/modules/notifications/notifications.repository';
import { AuthRepository, TenantRecord } from '../../src/modules/auth/auth.repository';
import { PatientRecord, PatientsRepository } from '../../src/modules/patients/patients.repository';
import { MealPlanRecord, MealPlansRepository } from '../../src/modules/meal-plans/mealPlans.repository';
import { FeedbackRecord } from '../../src/modules/feedbacks/feedbacks.repository';
import { AppointmentRecord } from '../../src/modules/appointments/appointments.repository';

function buildTenant(overrides: Partial<TenantRecord> = {}): TenantRecord {
  return {
    id: 'tenant-1',
    nome: 'Eridiane Kestring',
    email: 'eridiane@nutrihub.com',
    crn: 'CRN-12345',
    telefone: null,
    senha_hash: '',
    cancelamento_antecedencia_horas: 24,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildPatient(overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    id: 'patient-1',
    tenant_id: 'tenant-1',
    nome: 'Maria da Silva',
    email: 'maria@email.com',
    data_nascimento: '1960-01-01',
    contato: '(47) 99999-0000',
    historico: null,
    status: 'ativo',
    acesso_liberado: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildFeedback(overrides: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    id: 'feedback-1',
    tenant_id: 'tenant-1',
    patient_id: 'patient-1',
    meal_plan_id: 'plan-1',
    meal_id: null,
    descricao: 'Não encontrei aveia no mercado',
    status: 'pendente',
    resposta: null,
    resolvido_em: null,
    notificacao_falhou: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildPlan(overrides: Partial<MealPlanRecord> = {}): MealPlanRecord {
  return {
    id: 'plan-1',
    tenant_id: 'tenant-1',
    patient_id: 'patient-1',
    status: 'ativo',
    meta_kcal: null,
    orientacoes: null,
    published_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildAppointment(overrides: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    id: 'appt-1',
    tenant_id: 'tenant-1',
    patient_id: 'patient-1',
    // 14/10/2026 09:00 em Brasília.
    data_hora: new Date('2026-10-14T12:00:00Z'),
    status: 'confirmado',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/** Resume cada job enfileirado em "canal → destino" para as asserções. */
function destinos(jobs: NotificationJob[]): string[] {
  return jobs.map((job) => `${job.canal} → ${job.destino}`);
}

describe('NotificationsService (RF-06 / RF-07)', () => {
  let repository: jest.Mocked<NotificationsRepository>;
  let authRepository: jest.Mocked<AuthRepository>;
  let patientsRepository: jest.Mocked<PatientsRepository>;
  let mealPlansRepository: jest.Mocked<MealPlansRepository>;
  let service: NotificationsService;

  function enfileirados(): NotificationJob[] {
    expect(repository.enqueue).toHaveBeenCalledTimes(1);
    expect(repository.enqueue.mock.calls[0][0]).toBe('tenant-1');
    return repository.enqueue.mock.calls[0][1];
  }

  function criarServico(whatsappAtivo = true): NotificationsService {
    return new NotificationsService(repository, authRepository, patientsRepository, mealPlansRepository, {
      appUrl: 'https://app.nutrihub.com',
      whatsappAtivo,
    });
  }

  beforeEach(() => {
    repository = { enqueue: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<NotificationsRepository>;
    authRepository = { findById: jest.fn() } as unknown as jest.Mocked<AuthRepository>;
    patientsRepository = { findById: jest.fn() } as unknown as jest.Mocked<PatientsRepository>;
    mealPlansRepository = { findMealById: jest.fn() } as unknown as jest.Mocked<MealPlansRepository>;

    authRepository.findById.mockResolvedValue(buildTenant());
    patientsRepository.findById.mockResolvedValue(buildPatient());

    service = criarServico();
  });

  describe('feedbackRegistrado (fluxo 3.5, passo 4)', () => {
    it('avisa o nutricionista por e-mail e WhatsApp quando ele tem telefone', async () => {
      authRepository.findById.mockResolvedValue(buildTenant({ telefone: '(47) 98888-7777' }));
      mealPlansRepository.findMealById.mockResolvedValue({
        id: 'meal-1',
        tenant_id: 'tenant-1',
        meal_plan_id: 'plan-1',
        nome: 'Café da manhã',
        horario: '07:00',
        created_at: new Date(),
      });

      await service.feedbackRegistrado('tenant-1', buildFeedback({ meal_id: 'meal-1' }));

      const jobs = enfileirados();
      expect(destinos(jobs)).toEqual(['email → eridiane@nutrihub.com', 'whatsapp → 5547988887777']);
      expect(jobs.every((job) => job.evento === 'FEEDBACK_REGISTRADO' && job.referenciaId === 'feedback-1')).toBe(
        true,
      );
      expect(jobs[0].conteudo).toMatchObject({ assunto: 'Novo feedback de Maria da Silva' });
      expect(jobs[1].conteudo).toEqual({
        template: 'feedback_registrado',
        parametros: ['Maria da Silva', 'Café da manhã', 'Não encontrei aveia no mercado'],
      });
    });

    it('fica só no e-mail quando o nutricionista não cadastrou telefone', async () => {
      await service.feedbackRegistrado('tenant-1', buildFeedback());

      expect(destinos(enfileirados())).toEqual(['email → eridiane@nutrihub.com']);
      expect(mealPlansRepository.findMealById).not.toHaveBeenCalled();
    });
  });

  describe('feedbackResolvido (fluxo 3.5, passo 6)', () => {
    it('avisa o paciente por e-mail e WhatsApp, com a resposta', async () => {
      await service.feedbackResolvido(
        'tenant-1',
        buildFeedback({ status: 'resolvido', resposta: 'Troque por farelo de aveia' }),
      );

      const jobs = enfileirados();
      expect(destinos(jobs)).toEqual(['email → maria@email.com', 'whatsapp → 5547999990000']);
      expect((jobs[0].conteudo as { texto: string }).texto).toContain('Troque por farelo de aveia');
    });
  });

  describe('planoPublicado (fluxo 3.3, passo 8)', () => {
    it('avisa o paciente e deixa o e-mail ao nutricionista como fallback do WhatsApp (E-09)', async () => {
      await service.planoPublicado('tenant-1', buildPlan());

      const jobs = enfileirados();
      expect(destinos(jobs)).toEqual(['email → maria@email.com', 'whatsapp → 5547999990000']);

      const whatsapp = jobs[1];
      expect(whatsapp.canal === 'whatsapp' && whatsapp.fallback?.destino).toBe('eridiane@nutrihub.com');
      expect(whatsapp.conteudo).toEqual({
        template: 'novo_plano_disponivel',
        parametros: ['Maria', 'Eridiane Kestring', 'https://app.nutrihub.com/meu-plano'],
      });
    });

    it('não manda WhatsApp quando o contato do paciente não é um telefone utilizável', async () => {
      patientsRepository.findById.mockResolvedValue(buildPatient({ contato: '9999-0000' }));

      await service.planoPublicado('tenant-1', buildPlan());

      expect(destinos(enfileirados())).toEqual(['email → maria@email.com']);
    });

    it('não manda WhatsApp quando ele está desativado no ambiente', async () => {
      service = criarServico(false);

      await service.planoPublicado('tenant-1', buildPlan());

      expect(destinos(enfileirados())).toEqual(['email → maria@email.com']);
    });
  });

  describe('agenda (RF-08, RF-11, RF-12)', () => {
    it('consulta agendada: e-mail ao nutricionista e e-mail + WhatsApp ao paciente', async () => {
      await service.consultaAgendada('tenant-1', buildAppointment());

      const jobs = enfileirados();
      expect(destinos(jobs)).toEqual([
        'email → eridiane@nutrihub.com',
        'email → maria@email.com',
        'whatsapp → 5547999990000',
      ]);
      expect(jobs[2].conteudo).toEqual({
        template: 'consulta_confirmada',
        parametros: ['Maria', 'Eridiane Kestring', 'quarta-feira, 14/10 às 09:00'],
      });
    });

    it('cancelada pelo paciente: avisa só o nutricionista', async () => {
      await service.consultaCancelada('tenant-1', buildAppointment({ status: 'cancelado' }), 'paciente');

      expect(destinos(enfileirados())).toEqual(['email → eridiane@nutrihub.com']);
    });

    it('cancelada pelo nutricionista: avisa só o paciente', async () => {
      await service.consultaCancelada('tenant-1', buildAppointment({ status: 'cancelado' }), 'nutricionista');

      expect(destinos(enfileirados())).toEqual(['email → maria@email.com', 'whatsapp → 5547999990000']);
    });

    it('remarcada: avisa as duas partes nos dois canais, com o horário antigo e o novo', async () => {
      authRepository.findById.mockResolvedValue(buildTenant({ telefone: '+55 47 98888-7777' }));
      const anterior = new Date('2026-10-13T13:00:00Z'); // 13/10 às 10:00

      await service.consultaRemarcada('tenant-1', buildAppointment(), anterior);

      const jobs = enfileirados();
      expect(destinos(jobs)).toEqual([
        'email → eridiane@nutrihub.com',
        'whatsapp → 5547988887777',
        'email → maria@email.com',
        'whatsapp → 5547999990000',
      ]);
      expect(jobs[3].conteudo).toEqual({
        template: 'consulta_remarcada',
        parametros: [
          'Maria',
          'Sua consulta com Eridiane Kestring',
          'terça-feira, 13/10 às 10:00',
          'quarta-feira, 14/10 às 09:00',
        ],
      });
    });
  });

  describe('falhas (E-13 / E-21)', () => {
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
      consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => consoleError.mockRestore());

    it('não propaga a falha da fila: o fluxo principal segue e o erro vai para o log', async () => {
      repository.enqueue.mockRejectedValue(new Error('banco fora do ar'));

      await expect(service.consultaAgendada('tenant-1', buildAppointment())).resolves.toBeUndefined();
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('CONSULTA_AGENDADA'),
        expect.any(Error),
      );
    });

    it('não enfileira nada quando o paciente não é encontrado', async () => {
      patientsRepository.findById.mockResolvedValue(undefined);

      await expect(service.planoPublicado('tenant-1', buildPlan())).resolves.toBeUndefined();
      expect(repository.enqueue).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();
    });
  });
});
