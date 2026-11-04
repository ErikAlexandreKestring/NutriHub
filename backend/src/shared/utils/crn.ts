/**
 * RF-01: o CRN é o registro do nutricionista no Conselho Regional de
 * Nutricionistas. São 11 conselhos (CRN-1 a CRN-11), e o número é sequencial
 * dentro de cada um, por isso o formato fixo é só "região + número":
 *
 *   CRN-10 12345      inscrição definitiva
 *   CRN-3 4567/P      provisória
 *   CRN-1 890/S       secundária (Resolução CFN 228/99)
 *
 * A entrada é tolerante ("crn10 12345", "CRN-10/12345", "CRN 10-12345") e sai
 * sempre no formato acima, para o mesmo CRN não ser gravado de jeitos
 * diferentes. Sem separador entre região e número ("CRN1012345") não dá para
 * saber onde um termina e o outro começa, então é recusado.
 */
export const REGIOES_DO_CRN = 11;

export type ProblemaDoCrn = 'formato' | 'regiao';

export function normalizarCrn(bruto: string): { crn: string } | { problema: ProblemaDoCrn } {
  const texto = bruto.trim().toUpperCase().replace(/\s+/g, ' ');
  const partes = /^CRN ?-? ?(\d{1,2}) ?[-/ ] ?(\d{1,6})(?: ?\/ ?([PS]))?$/.exec(texto);
  if (!partes) return { problema: 'formato' };

  const [, regiao, numero, sufixo] = partes;
  const numeroDaRegiao = Number(regiao);
  if (numeroDaRegiao < 1 || numeroDaRegiao > REGIOES_DO_CRN) return { problema: 'regiao' };
  if (Number(numero) === 0) return { problema: 'formato' };

  return { crn: `CRN-${numeroDaRegiao} ${Number(numero)}${sufixo ? `/${sufixo}` : ''}` };
}
