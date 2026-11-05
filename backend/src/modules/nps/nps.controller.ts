import { Request, Response, NextFunction } from 'express';
import { NpsService } from './nps.service';
import { AuditService } from '../audit/audit.service';
import { responderNpsSchema } from './nps.validation';

export class NpsController {
  constructor(
    private readonly service: NpsService = new NpsService(),
    private readonly audit: AuditService = new AuditService(),
  ) {}

  // Sem pesquisa em aberto a resposta é `{ pesquisa: null }`, e não 404: a
  // tela precisa distinguir "nada para responder" de um erro.
  pendente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pesquisa = await this.service.pendente(req.auth!.tenantId, req.params.patientId);
      res.status(200).json({ pesquisa });
    } catch (error) {
      next(error);
    }
  };

  responder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = responderNpsSchema.parse(req.body);
      const pesquisa = await this.service.responder(
        req.auth!.tenantId,
        req.params.patientId,
        req.params.id,
        input,
      );
      // A nota não vai para o log: a auditoria registra a ação, não a opinião.
      await this.audit.record(req, 'NPS_RESPONDIDO', { pesquisaId: pesquisa.id });
      res.status(200).json(pesquisa);
    } catch (error) {
      next(error);
    }
  };

  resumo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resumo = await this.service.resumo(req.auth!.tenantId);
      res.status(200).json(resumo);
    } catch (error) {
      next(error);
    }
  };
}
