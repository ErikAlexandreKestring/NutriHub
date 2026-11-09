/**
 * Teste de carga (RNF-06), último passo: apaga a massa criada pelo preparar.ts.
 *
 * Excluir o consultório leva junto, em cascata, pacientes, planos, refeições,
 * marcações, grade, consultas, feedbacks e notificações. O log de auditoria
 * não tem chave estrangeira (de propósito, ver a migration dele), então os
 * logins do teste saem à parte.
 */
import { existsSync, unlinkSync } from 'fs';
import knexLib from 'knex';
import knexConfig from '../src/db/knexfile';
import { env } from '../src/config/env';
import { ARQUIVO_DE_CONTAS, DOMINIO } from './preparar';

async function main(): Promise<void> {
  const ambiente = env.nodeEnv === 'production' ? 'production' : 'development';
  const owner = knexLib(knexConfig[ambiente]);

  try {
    const ids: string[] = await owner('tenants').whereLike('email', `%@${DOMINIO}`).pluck('id');

    await owner.transaction(async (trx) => {
      if (ids.length > 0) {
        await trx('audit_logs').whereIn('tenant_id', ids).delete();
        await trx('tenants').whereIn('id', ids).delete();
      }
      // Login que falhou fica sem tenant; o e-mail tentado vai nos detalhes.
      await trx('audit_logs')
        .whereNull('tenant_id')
        .whereRaw('detalhes::text like ?', [`%@${DOMINIO}%`])
        .delete();
    });

    if (existsSync(ARQUIVO_DE_CONTAS)) unlinkSync(ARQUIVO_DE_CONTAS);
    console.warn(`Massa de teste apagada do banco ${ambiente}: ${ids.length} consultórios.`);
  } finally {
    await owner.destroy();
  }
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
