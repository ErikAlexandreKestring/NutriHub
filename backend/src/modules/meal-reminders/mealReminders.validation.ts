import { asRecord, Validator } from '../../shared/validation/validator';

export interface PreferenciaDeLembreteInput {
  ativo: boolean;
}

export const preferenciaDeLembreteSchema = {
  parse(body: unknown): PreferenciaDeLembreteInput {
    const data = asRecord(body);
    const validator = new Validator();

    if (typeof data.ativo !== 'boolean') {
      validator.fail('ativo', 'Informe se o lembrete fica ligado (true) ou desligado (false)');
    }

    validator.throwIfInvalid();

    return { ativo: data.ativo as boolean };
  },
};
