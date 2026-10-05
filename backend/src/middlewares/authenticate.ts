import { Request, Response, NextFunction, RequestHandler } from 'express';
import { JwtPayload, verifyToken } from '../shared/utils/jwt';
import { InvalidTokenTenantError, UnauthorizedError } from '../shared/errors/AppError';
import { AuditRepository } from '../modules/audit/audit.repository';
import { TokenScopeRepository } from './tokenScope.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AuthenticateDeps {
  scope: Pick<TokenScopeRepository, 'tenantExists' | 'patientBelongsToTenant'>;
  audit: Pick<AuditRepository, 'register'>;
}

// O nutricionista É o tenant (user_id === tenant_id); o paciente precisa
// existir dentro dele.
async function hasValidTenant(payload: JwtPayload, scope: AuthenticateDeps['scope']): Promise<boolean> {
  if (!UUID.test(payload.tenant_id) || !UUID.test(payload.user_id)) return false;

  if (payload.role === 'nutricionista') {
    return payload.user_id === payload.tenant_id && (await scope.tenantExists(payload.tenant_id));
  }
  return scope.patientBelongsToTenant(payload.tenant_id, payload.user_id);
}

/**
 * RF-02, fluxo 3.2 passo 5: valida assinatura e expiração do JWT (E-05 → 401)
 * e o tenant_id que ele carrega (E-06 → 403 + log de auditoria). Só então
 * expõe o tenant_id em req.auth para o withTenant() (RFC seção 5.4).
 */
export function createAuthenticate(deps: AuthenticateDeps): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    if (!token) {
      next(new UnauthorizedError());
      return;
    }

    let payload: JwtPayload;
    try {
      payload = verifyToken(token);
    } catch {
      next(new UnauthorizedError());
      return;
    }

    try {
      if (!(await hasValidTenant(payload, deps.scope))) {
        // Falhar a gravação do log não pode transformar o 403 num 500 nem,
        // pior, deixar a requisição passar.
        await deps.audit
          .register({
            evento: 'TOKEN_TENANT_INVALIDO',
            userId: UUID.test(payload.user_id) ? payload.user_id : undefined,
            tenantId: UUID.test(payload.tenant_id) ? payload.tenant_id : undefined,
            ip: req.ip,
            detalhes: { role: payload.role, metodo: req.method, rota: req.originalUrl },
          })
          .catch((erro: unknown) => {
            // eslint-disable-next-line no-console
            console.error('Falha ao registrar auditoria E-06', erro);
          });

        next(new InvalidTokenTenantError());
        return;
      }
    } catch (erro) {
      next(erro);
      return;
    }

    req.auth = { userId: payload.user_id, tenantId: payload.tenant_id, role: payload.role };
    next();
  };
}

export const authenticate = createAuthenticate({
  scope: new TokenScopeRepository(),
  audit: new AuditRepository(),
});
