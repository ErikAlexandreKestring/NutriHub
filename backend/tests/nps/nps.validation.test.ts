import { responderNpsSchema } from '../../src/modules/nps/nps.validation';
import { ValidationError } from '../../src/shared/errors/AppError';

describe('responderNpsSchema (UC-07)', () => {
  it.each([0, 6, 10])('aceita a nota %i', (nota) => {
    expect(responderNpsSchema.parse({ nota })).toEqual({ nota, comentario: undefined });
  });

  it.each([-1, 11, 7.5, '9', null, undefined])('recusa a nota %p', (nota) => {
    expect(() => responderNpsSchema.parse({ nota })).toThrow(ValidationError);
  });

  it('apara o comentário e descarta o vazio', () => {
    expect(responderNpsSchema.parse({ nota: 8, comentario: '  Gostei  ' })).toEqual({ nota: 8, comentario: 'Gostei' });
    expect(responderNpsSchema.parse({ nota: 8, comentario: '   ' })).toEqual({ nota: 8, comentario: undefined });
  });

  it('recusa comentário acima de 1000 caracteres', () => {
    expect(() => responderNpsSchema.parse({ nota: 8, comentario: 'a'.repeat(1001) })).toThrow(ValidationError);
  });
});
