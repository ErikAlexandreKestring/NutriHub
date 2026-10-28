import { Request } from 'express';
import { AuditEvent, AuditRepository } from './audit.repository';

interface Autor {
  userId: string;
  tenantId: string;
}

/**
 * RNF-10 / RFC 6.5: registra uma ação crítica com o usuário, o tenant e o IP de
 * origem tirados da própria requisição. Fica na camada HTTP porque é ela que
 * conhece o IP — os serviços só recebem o tenantId.
 */
export class AuditService {
  constructor(private readonly repository: Pick<AuditRepository, 'register'> = new AuditRepository()) {}

  /**
   * Chamado depois que a ação já foi concluída. Uma falha ao gravar o log não
   * desfaz a ação nem a transforma em erro para o cliente — fica no log do
   * servidor, como no E-06 (ver authenticate).
   *
   * `autor` substitui o req.auth nas rotas públicas (login, primeiro acesso),
   * em que o usuário só é conhecido depois da autenticação.
   */
  async record(req: Request, evento: AuditEvent, detalhes?: Record<string, unknown>, autor?: Autor): Promise<void> {
    await this.repository
      .register({
        evento,
        userId: autor?.userId ?? req.auth?.userId,
        tenantId: autor?.tenantId ?? req.auth?.tenantId,
        ip: req.ip,
        detalhes: { papel: req.auth?.role, ...detalhes },
      })
      .catch((erro: unknown) => {
        // eslint-disable-next-line no-console
        console.error(`Falha ao registrar auditoria ${evento}`, erro);
      });
  }
}
