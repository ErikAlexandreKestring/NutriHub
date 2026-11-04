import { NutricionistaService } from '../../src/modules/nutricionista/nutricionista.service';
import { TenantRecord } from '../../src/modules/auth/auth.repository';
import { NutricionistaNotFoundError } from '../../src/shared/errors/AppError';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';

function buildTenant(overrides: Partial<TenantRecord> = {}): TenantRecord {
  return {
    id: TENANT_ID,
    nome: 'Eridiane Kestring',
    email: 'eridiane@nutrihub.com',
    crn: 'CRN-10 12345',
    telefone: '(47) 99999-0000',
    senha_hash: 'hash',
    cancelamento_antecedencia_horas: 24,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function buildService(tenant: TenantRecord | undefined) {
  const repository = { findById: jest.fn().mockResolvedValue(tenant) };
  return { service: new NutricionistaService(repository), repository };
}

describe('NutricionistaService.getContato (RF-07)', () => {
  it('devolve o nome e o celular já no formato do link wa.me', async () => {
    const { service, repository } = buildService(buildTenant());

    await expect(service.getContato(TENANT_ID)).resolves.toEqual({
      nome: 'Eridiane Kestring',
      whatsapp: '5547999990000',
    });
    expect(repository.findById).toHaveBeenCalledWith(TENANT_ID);
  });

  it('devolve whatsapp null para conta anterior ao celular obrigatório', async () => {
    const { service } = buildService(buildTenant({ telefone: null }));

    await expect(service.getContato(TENANT_ID)).resolves.toEqual({ nome: 'Eridiane Kestring', whatsapp: null });
  });

  it('responde 404 quando o tenant não existe mais', async () => {
    const { service } = buildService(undefined);

    await expect(service.getContato(TENANT_ID)).rejects.toThrow(NutricionistaNotFoundError);
  });
});
