import type { Knex } from 'knex';

// RF-09 / UC-07 / RN-05: pesquisa NPS enviada ao paciente quando um plano
// alimentar é encerrado, no máximo uma vez por trimestre.
//
// Tabela própria, e não colunas nps_* em `feedbacks` como previa o modelo da
// RFC (5.3): o feedback de refeição tem descrição obrigatória e um ciclo
// pendente → resolvido que não existe no NPS. Juntar os dois obrigaria cada
// consulta da caixa de feedbacks a filtrar as avaliações para fora.
//
// A linha nasce no envio (nota nula) e recebe a nota na resposta: a data de
// envio é o que a regra do trimestre consulta, e a contagem de enviadas x
// respondidas dá a taxa de resposta do painel.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('nps_pesquisas', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('patient_id').notNullable().references('id').inTable('patients').onDelete('CASCADE');
    // O plano cujo ciclo terminou. SET NULL: a avaliação continua contando
    // para o consultório mesmo que o plano deixe de existir.
    table.uuid('meal_plan_id').references('id').inTable('meal_plans').onDelete('SET NULL');
    table.smallint('nota');
    table.text('comentario');
    table.timestamp('enviada_em', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('respondida_em', { useTz: true });

    // Regra do trimestre (RN-05) e pesquisa pendente do paciente.
    table.index(['tenant_id', 'patient_id', 'enviada_em']);
    // Painel do nutricionista: respostas mais recentes do consultório.
    table.index(['tenant_id', 'respondida_em']);
  });

  await knex.raw('ALTER TABLE nps_pesquisas ADD CONSTRAINT nps_pesquisas_nota_check CHECK (nota BETWEEN 0 AND 10)');
  // Respondida = tem nota e data; uma sem a outra seria um estado inválido.
  await knex.raw(
    'ALTER TABLE nps_pesquisas ADD CONSTRAINT nps_pesquisas_resposta_check CHECK ((nota IS NULL) = (respondida_em IS NULL))',
  );

  await knex.raw('ALTER TABLE nps_pesquisas ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE nps_pesquisas FORCE ROW LEVEL SECURITY');
  await knex.raw(`
    CREATE POLICY tenant_isolation ON nps_pesquisas
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('nps_pesquisas');
}
