import type { Knex } from 'knex';
import { normalizarCrn } from '../../shared/utils/crn';

// RF-01: um CRN, uma conta. O CFN não oferece API pública para conferir se o
// registro existe, então o mínimo que o sistema garante é que o mesmo CRN não
// abra dois consultórios. O cadastro confere antes de gravar
// (AuthService.register) e este índice segura dois cadastros simultâneos.
//
// O índice compara o texto gravado, e só o cadastro novo passa por
// `normalizarCrn`: uma conta antiga gravada como "crn10 12345" não barraria um
// "CRN-10 12345". Por isso a migration normaliza o que já existe; o CRN fora de
// qualquer formato reconhecível fica como está.
//
// Se dois consultórios caem no mesmo CRN, a migration para em vez de escolher
// um: decidir qual conta fica é de quem administra o banco, como em
// email_sem_diferenciar_maiusculas. `tenants` não tem RLS.
const INDICE = 'tenants_crn_unico';

export async function up(knex: Knex): Promise<void> {
  const tenants: Array<{ id: string; crn: string }> = await knex('tenants').select('id', 'crn');

  const normalizados = tenants.map(({ id, crn }) => {
    const resultado = normalizarCrn(crn);
    return { id, antes: crn, depois: 'crn' in resultado ? resultado.crn : crn };
  });

  const contagem = new Map<string, number>();
  for (const { depois } of normalizados) contagem.set(depois, (contagem.get(depois) ?? 0) + 1);
  const repetidos = [...contagem].filter(([, total]) => total > 1).map(([crn]) => crn);
  if (repetidos.length > 0) {
    throw new Error(
      `Há ${repetidos.length} CRN(s) com mais de uma conta de nutricionista: ${repetidos.join(', ')}. ` +
        'Resolva as contas duplicadas antes de rodar esta migration.',
    );
  }

  for (const { id, antes, depois } of normalizados) {
    if (depois !== antes) await knex('tenants').where({ id }).update({ crn: depois });
  }

  await knex.raw(`CREATE UNIQUE INDEX ${INDICE} ON tenants (crn)`);
}

// Volta só a regra: os CRNs continuam normalizados, que é uma grafia válida.
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS ${INDICE}`);
}
