import { normalizarCrn } from '../../src/shared/utils/crn';

describe('normalizarCrn (RF-01)', () => {
  it('aceita do CRN-1 ao CRN-11', () => {
    expect(normalizarCrn('CRN-1 1')).toEqual({ crn: 'CRN-1 1' });
    expect(normalizarCrn('CRN-11 123456')).toEqual({ crn: 'CRN-11 123456' });
    expect(normalizarCrn('CRN-12 1')).toEqual({ problema: 'regiao' });
  });

  it('recusa número com mais de 6 dígitos', () => {
    expect(normalizarCrn('CRN-3 1234567')).toEqual({ problema: 'formato' });
  });
});
