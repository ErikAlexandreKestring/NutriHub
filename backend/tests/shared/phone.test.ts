import { toWhatsAppNumber } from '../../src/shared/utils/phone';

describe('toWhatsAppNumber (RF-07)', () => {
  it.each([
    ['(47) 99999-0000', '5547999990000'],
    ['47 3333-4444', '554733334444'],
    ['5547999990000', '5547999990000'],
    ['+55 (47) 99999-0000', '5547999990000'],
    ['+1 415 555 2671', '14155552671'],
  ])('%s → %s', (entrada, esperado) => {
    expect(toWhatsAppNumber(entrada)).toBe(esperado);
  });

  it.each([null, undefined, '', '99999-0000', 'não tenho', '+123', '123456789012345678'])(
    'devolve null quando não dá para ter certeza do número (%s)',
    (entrada) => {
      expect(toWhatsAppNumber(entrada)).toBeNull();
    },
  );
});
