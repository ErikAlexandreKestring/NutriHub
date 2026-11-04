import { env } from '../../config/env';
import { AuthRepository, TenantRecord } from '../auth/auth.repository';
import { PatientRecord, PatientsRepository } from '../patients/patients.repository';
import { MealPlansRepository } from '../meal-plans/mealPlans.repository';
import type { MealPlanRecord } from '../meal-plans/mealPlans.repository';
import type { FeedbackRecord } from '../feedbacks/feedbacks.repository';
import type { AppointmentRecord } from '../appointments/appointments.repository';
import type { Ator } from '../appointments/appointments.validation';
import { NotificationJob, NotificationsRepository } from './notifications.repository';
import * as mensagens from './notifications.messages';
import { EmailContent, NotificationEvent } from './notifications.messages';

interface Partes {
  tenant: TenantRecord;
  patient: PatientRecord;
}

/**
 * RF-06 / RF-07: ponto único por onde os módulos de negócio pedem um aviso.
 *
 * Cada método só ENFILEIRA as mensagens; quem envia é o NotificationsWorker.
 * E nenhum deles lança erro: a falha ao notificar é registrada no log e o fluxo
 * principal segue (E-13, E-18, E-21) — o feedback, o plano ou a consulta já
 * foram gravados quando chegam aqui.
 *
 * Todos os avisos saem por e-mail, obrigatório no cadastro do paciente e do
 * nutricionista. O WhatsApp não é mais canal de envio automático (RF-07
 * revisado): a conversa acontece por link direto, aberto pelo próprio paciente
 * na PWA.
 */
export class NotificationsService {
  constructor(
    private readonly repository: NotificationsRepository = new NotificationsRepository(),
    private readonly authRepository: AuthRepository = new AuthRepository(),
    private readonly patientsRepository: PatientsRepository = new PatientsRepository(),
    private readonly mealPlansRepository: MealPlansRepository = new MealPlansRepository(),
    private readonly options: { appUrl: string } = { appUrl: env.notifications.appUrl },
  ) {}

  // RF-06, fluxo 3.5 passo 4: alerta ao nutricionista por e-mail.
  async feedbackRegistrado(tenantId: string, feedback: FeedbackRecord): Promise<void> {
    await this.safely('FEEDBACK_REGISTRADO', tenantId, async () => {
      const { tenant, patient } = await this.partes(tenantId, feedback.patient_id);
      const meal = feedback.meal_id
        ? await this.mealPlansRepository.findMealById(tenantId, feedback.meal_id)
        : undefined;

      const dados: mensagens.FeedbackRegistradoDados = {
        appUrl: this.options.appUrl,
        pacienteId: patient.id,
        pacienteNome: patient.nome,
        refeicao: meal?.nome ?? null,
        descricao: feedback.descricao,
      };

      return this.paraNutricionista(tenant, 'FEEDBACK_REGISTRADO', feedback.id, {
        email: mensagens.feedbackRegistradoEmail(dados),
      });
    });
  }

  // Fluxo 3.5 passo 6: "o sistema persiste a resolução e notifica o paciente".
  async feedbackResolvido(tenantId: string, feedback: FeedbackRecord): Promise<void> {
    await this.safely('FEEDBACK_RESOLVIDO', tenantId, async () => {
      const { tenant, patient } = await this.partes(tenantId, feedback.patient_id);
      const dados: mensagens.FeedbackResolvidoDados = {
        appUrl: this.options.appUrl,
        pacienteNome: patient.nome,
        nutricionistaNome: tenant.nome,
        resposta: feedback.resposta,
      };

      return this.paraPaciente(patient, 'FEEDBACK_RESOLVIDO', feedback.id, {
        email: mensagens.feedbackResolvidoEmail(dados),
      });
    });
  }

  // Fluxo 3.3 passo 8 (UC-06): novo plano disponível.
  async planoPublicado(tenantId: string, plan: MealPlanRecord): Promise<void> {
    await this.safely('PLANO_PUBLICADO', tenantId, async () => {
      const { tenant, patient } = await this.partes(tenantId, plan.patient_id);
      const dados: mensagens.PlanoPublicadoDados = {
        appUrl: this.options.appUrl,
        pacienteNome: patient.nome,
        nutricionistaNome: tenant.nome,
      };

      return this.paraPaciente(patient, 'PLANO_PUBLICADO', plan.id, {
        email: mensagens.planoPublicadoEmail(dados),
      });
    });
  }

  // RF-08, fluxo 3.4 passo 8 / UC-10: "notifica ambas as partes".
  async consultaAgendada(tenantId: string, appointment: AppointmentRecord): Promise<void> {
    await this.safely('CONSULTA_AGENDADA', tenantId, async () => {
      const { tenant, patient } = await this.partes(tenantId, appointment.patient_id);
      const dados = this.dadosDaConsulta(tenant, patient, appointment);

      return [
        ...this.paraNutricionista(tenant, 'CONSULTA_AGENDADA', appointment.id, {
          email: mensagens.consultaAgendadaEmail(dados, 'nutricionista'),
        }),
        ...this.paraPaciente(patient, 'CONSULTA_AGENDADA', appointment.id, {
          email: mensagens.consultaAgendadaEmail(dados, 'paciente'),
        }),
      ];
    });
  }

  // RF-11 / UC-05: o cancelamento avisa "a outra parte".
  async consultaCancelada(tenantId: string, appointment: AppointmentRecord, canceladaPor: Ator): Promise<void> {
    await this.safely('CONSULTA_CANCELADA', tenantId, async () => {
      const { tenant, patient } = await this.partes(tenantId, appointment.patient_id);
      const dados = this.dadosDaConsulta(tenant, patient, appointment);

      if (canceladaPor === 'paciente') {
        return this.paraNutricionista(tenant, 'CONSULTA_CANCELADA', appointment.id, {
          email: mensagens.consultaCanceladaEmail(dados, 'nutricionista'),
        });
      }
      return this.paraPaciente(patient, 'CONSULTA_CANCELADA', appointment.id, {
        email: mensagens.consultaCanceladaEmail(dados, 'paciente'),
      });
    });
  }

  // RF-12, fluxo 3.6 passo 7B: "ambas as partes".
  async consultaRemarcada(tenantId: string, appointment: AppointmentRecord, dataHoraAnterior: Date): Promise<void> {
    await this.safely('CONSULTA_REMARCADA', tenantId, async () => {
      const { tenant, patient } = await this.partes(tenantId, appointment.patient_id);
      const dados = { ...this.dadosDaConsulta(tenant, patient, appointment), dataHoraAnterior };

      return [
        ...this.paraNutricionista(tenant, 'CONSULTA_REMARCADA', appointment.id, {
          email: mensagens.consultaRemarcadaEmail(dados, 'nutricionista'),
        }),
        ...this.paraPaciente(patient, 'CONSULTA_REMARCADA', appointment.id, {
          email: mensagens.consultaRemarcadaEmail(dados, 'paciente'),
        }),
      ];
    });
  }

  private async safely(
    evento: NotificationEvent,
    tenantId: string,
    montar: () => Promise<NotificationJob[]>,
  ): Promise<void> {
    try {
      await this.repository.enqueue(tenantId, await montar());
    } catch (erro) {
      console.error(`Falha ao enfileirar a notificação ${evento} do tenant ${tenantId}`, erro);
    }
  }

  private async partes(tenantId: string, patientId: string): Promise<Partes> {
    const [tenant, patient] = await Promise.all([
      this.authRepository.findById(tenantId),
      this.patientsRepository.findById(tenantId, patientId),
    ]);
    if (!tenant || !patient) {
      throw new Error(`Destinatário não encontrado (paciente ${patientId})`);
    }
    return { tenant, patient };
  }

  private dadosDaConsulta(
    tenant: TenantRecord,
    patient: PatientRecord,
    appointment: AppointmentRecord,
  ): mensagens.ConsultaDados {
    return {
      appUrl: this.options.appUrl,
      pacienteNome: patient.nome,
      nutricionistaNome: tenant.nome,
      dataHora: new Date(appointment.data_hora),
    };
  }

  private paraNutricionista(
    tenant: TenantRecord,
    evento: NotificationEvent,
    referenciaId: string,
    conteudo: { email: EmailContent },
  ): NotificationJob[] {
    return [{ evento, canal: 'email', destino: tenant.email, conteudo: conteudo.email, referenciaId }];
  }

  private paraPaciente(
    patient: PatientRecord,
    evento: NotificationEvent,
    referenciaId: string,
    conteudo: { email: EmailContent },
  ): NotificationJob[] {
    return [{ evento, canal: 'email', destino: patient.email, conteudo: conteudo.email, referenciaId }];
  }
}
