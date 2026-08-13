/**
 * Validação manual de payloads de entrada — sem biblioteca externa, já que a
 * RFC (seção 5.5) não cita nenhuma lib de validação no stack. Cada módulo
 * escreve seu próprio `parse*Input()` usando estas poucas funções auxiliares.
 */
import { ValidationError, ValidationIssue } from '../errors/AppError';

export function asRecord(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
}

export function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

export function isValidDate(value: string): boolean {
  return value.length > 0 && !Number.isNaN(Date.parse(value));
}

/** Acumula problemas de validação e lança ValidationError se houver algum ao final. */
export class Validator {
  private readonly issues: ValidationIssue[] = [];

  fail(path: string, message: string): void {
    this.issues.push({ path, message });
  }

  throwIfInvalid(): void {
    if (this.issues.length > 0) {
      throw new ValidationError(this.issues);
    }
  }
}
