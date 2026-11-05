import { NpsService, calcularNps, RESPOSTAS_NO_PAINEL } from '../../src/modules/nps/nps.service';
import { NpsPesquisaRecord, NpsRepository } from '../../src/modules/nps/nps.repository';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { NpsJaRespondidaError, NpsPesquisaNotFoundError } from '../../src/shared/errors/AppError';

function buildPesquisa(overrides: Partial<NpsPesquisaRecord> = {}): NpsPesquisaRecord {
  return {
    id: 'nps-1',
    tenant_id: 'tenant-1',
    patient_id: 'patient-1',
    meal_plan_id: 'plan-0',
    nota: null,
    comentario: null,
    enviada_em: new Date(),
    respondida_em: null,
    ...overrides,
  };
}

describe('calcularNps', () => {
  it('é % de promotores menos % de detratores, arredondado', () => {
    // 5 promotores, 2 neutros, 3 detratores em 10 respostas → 50% − 30% = 20.
    expect(calcularNps({ respostas: 10, promotores: 5, detratores: 3 })).toBe(20);
    expect(calcularNps({ respostas: 3, promotores: 2, detratores: 0 })).toBe(67);
  });

  it('vai de -100 (só detratores) a 100 (só promotores)', () => {
    expect(calcularNps({ respostas: 4, promotores: 0, detratores: 4 })).toBe(-100);
    expect(calcularNps({ respostas: 4, promotores: 4, detratores: 0 })).toBe(100);
  });

  it('é nulo sem respostas, em vez de um 0 que pareceria um resultado', () => {
    expect(calcularNps({ respostas: 0, promotores: 0, detratores: 0 })).toBeNull();
  });
});

describe('NpsService (RF-09)', () => {
  let repository: jest.Mocked<NpsRepository>;
  let notifications: jest.Mocked<NotificationsService>;
  let service: NpsService;

  beforeEach(() => {
    repository = {
      criarSeForaDoTrimestre: jest.fn(),
      findPendenteByPatient: jest.fn(),
      findById: jest.fn(),
      responder: jest.fn(),
      contar: jest.fn(),
      listarRespostas: jest.fn(),
    } as unknown as jest.Mocked<NpsRepository>;
    notifications = { npsSolicitado: jest.fn() } as unknown as jest.Mocked<NotificationsService>;
    service = new NpsService(repository, notifications);
  });

  describe('aoEncerrarPlano (RN-05)', () => {
    it('cria a pesquisa e convida o paciente por e-mail', async () => {
      const pesquisa = buildPesquisa();
      repository.criarSeForaDoTrimestre.mockResolvedValue(pesquisa);

      await service.aoEncerrarPlano('tenant-1', 'patient-1', 'plan-0');

      expect(repository.criarSeForaDoTrimestre).toHaveBeenCalledWith('tenant-1', 'patient-1', 'plan-0');
      expect(notifications.npsSolicitado).toHaveBeenCalledWith('tenant-1', pesquisa);
    });

    it('não manda e-mail quando o paciente já recebeu uma pesquisa no trimestre', async () => {
      repository.criarSeForaDoTrimestre.mockResolvedValue(undefined);

      await service.aoEncerrarPlano('tenant-1', 'patient-1', 'plan-0');

      expect(notifications.npsSolicitado).not.toHaveBeenCalled();
    });

    it('não propaga falha: a publicação do plano já foi gravada', async () => {
      const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      repository.criarSeForaDoTrimestre.mockRejectedValue(new Error('banco fora'));

      await expect(service.aoEncerrarPlano('tenant-1', 'patient-1', 'plan-0')).resolves.toBeUndefined();

      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });
  });

  describe('pendente', () => {
    it('devolve null quando não há pesquisa em aberto', async () => {
      repository.findPendenteByPatient.mockResolvedValue(undefined);

      await expect(service.pendente('tenant-1', 'patient-1')).resolves.toBeNull();
    });
  });

  describe('responder (UC-07)', () => {
    it('grava a nota e o comentário do próprio paciente', async () => {
      const respondida = buildPesquisa({ nota: 9, comentario: 'Ótimo', respondida_em: new Date() });
      repository.responder.mockResolvedValue(respondida);

      const result = await service.responder('tenant-1', 'patient-1', 'nps-1', { nota: 9, comentario: 'Ótimo' });

      expect(result).toBe(respondida);
      expect(repository.responder).toHaveBeenCalledWith('tenant-1', 'nps-1', 'patient-1', 9, 'Ótimo');
    });

    it('grava comentário nulo quando o paciente só dá a nota', async () => {
      repository.responder.mockResolvedValue(buildPesquisa({ nota: 7, respondida_em: new Date() }));

      await service.responder('tenant-1', 'patient-1', 'nps-1', { nota: 7 });

      expect(repository.responder).toHaveBeenCalledWith('tenant-1', 'nps-1', 'patient-1', 7, null);
    });

    it('lança NpsJaRespondidaError na segunda resposta', async () => {
      repository.responder.mockResolvedValue(undefined);
      repository.findById.mockResolvedValue(buildPesquisa({ nota: 9, respondida_em: new Date() }));

      await expect(service.responder('tenant-1', 'patient-1', 'nps-1', { nota: 3 })).rejects.toThrow(
        NpsJaRespondidaError,
      );
    });

    it('lança NpsPesquisaNotFoundError para pesquisa inexistente', async () => {
      repository.responder.mockResolvedValue(undefined);
      repository.findById.mockResolvedValue(undefined);

      await expect(service.responder('tenant-1', 'patient-1', 'nps-x', { nota: 3 })).rejects.toThrow(
        NpsPesquisaNotFoundError,
      );
    });

    it('trata a pesquisa de outro paciente como inexistente, sem revelar que foi respondida', async () => {
      repository.responder.mockResolvedValue(undefined);
      repository.findById.mockResolvedValue(buildPesquisa({ patient_id: 'patient-2', nota: 10, respondida_em: new Date() }));

      await expect(service.responder('tenant-1', 'patient-1', 'nps-1', { nota: 3 })).rejects.toThrow(
        NpsPesquisaNotFoundError,
      );
    });
  });

  describe('resumo (painel do nutricionista)', () => {
    it('consolida índice, taxa de resposta e respostas recentes', async () => {
      repository.contar.mockResolvedValue({ enviadas: 8, respostas: 4, promotores: 2, neutros: 1, detratores: 1 });
      repository.listarRespostas.mockResolvedValue([]);

      const resumo = await service.resumo('tenant-1');

      expect(resumo).toMatchObject({ nps: 25, taxaResposta: 0.5, respostas: 4, enviadas: 8 });
      expect(repository.listarRespostas).toHaveBeenCalledWith('tenant-1', RESPOSTAS_NO_PAINEL);
    });

    it('sem nenhuma pesquisa enviada, índice e taxa ficam nulos', async () => {
      repository.contar.mockResolvedValue({ enviadas: 0, respostas: 0, promotores: 0, neutros: 0, detratores: 0 });
      repository.listarRespostas.mockResolvedValue([]);

      await expect(service.resumo('tenant-1')).resolves.toMatchObject({ nps: null, taxaResposta: null });
    });
  });
});
