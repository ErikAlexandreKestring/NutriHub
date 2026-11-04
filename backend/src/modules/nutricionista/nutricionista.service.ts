import { AuthRepository } from '../auth/auth.repository';
import { NutricionistaNotFoundError } from '../../shared/errors/AppError';
import { toWhatsAppNumber } from '../../shared/utils/phone';

export interface ContatoDoNutricionista {
  nome: string;
  /**
   * Número só com dígitos e DDI (ex.: 5547999990000), pronto para o link
   * https://wa.me/<numero>. null quando a conta é anterior ao celular
   * obrigatório no cadastro: a PWA esconde o botão em vez de abrir um link
   * quebrado.
   */
  whatsapp: string | null;
}

/**
 * RF-07: o paciente fala com o nutricionista por um link direto do WhatsApp,
 * aberto na própria conta de cada um — sem WhatsApp Business API, sem
 * aprovação da Meta e sem templates.
 */
export class NutricionistaService {
  constructor(private readonly repository: Pick<AuthRepository, 'findById'> = new AuthRepository()) {}

  /** O tenant vem do JWT do paciente, já validado pelo `authenticate`. */
  async getContato(tenantId: string): Promise<ContatoDoNutricionista> {
    const tenant = await this.repository.findById(tenantId);
    if (!tenant) {
      throw new NutricionistaNotFoundError();
    }

    return { nome: tenant.nome, whatsapp: toWhatsAppNumber(tenant.telefone) };
  }
}
