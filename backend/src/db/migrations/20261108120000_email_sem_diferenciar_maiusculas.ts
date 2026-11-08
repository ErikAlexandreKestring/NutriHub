import type { Knex } from 'knex';

// Issue #49: o e-mail era gravado como digitado e comparado com igualdade
// exata. Quem se cadastrava como Ana@clinica.com não entrava digitando
// ana@clinica.com, e os índices únicos aceitavam as duas grafias como contas
// diferentes. A aplicação passa a gravar e buscar o e-mail em minúsculas
// (`asEmail`, em shared/validation/validator); esta migration converte o que
// já está gravado e põe a regra no banco com uma CHECK constraint. Assim os
// índices únicos que já existem — tenants(email) e patients(tenant_id, email) —
// passam a valer sem diferenciar maiúsculas, e as buscas por igualdade
// (inclusive a função patient_auth_by_email) seguem iguais.
//
// Se duas contas só diferem nas maiúsculas, a migration para em vez de
// escolher uma: juntar contas é decisão de quem administra o banco.
//
// `patients` tem FORCE ROW LEVEL SECURITY e no Azure o administrador não é
// superusuário, então o UPDATE percorre tenant a tenant com
// app.current_tenant definido, como em remove_whatsapp_from_notifications.
// As CHECK constraints, adicionadas depois, validam a tabela inteira sem
// passar pelo RLS.
export async function up(knex: Knex): Promise<void> {
  const tenantsDuplicados = await knex('tenants')
    .select(knex.raw('lower(email) AS email'))
    .groupByRaw('lower(email)')
    .havingRaw('count(*) > 1');
  if (tenantsDuplicados.length > 0) {
    throw new Error(
      `Há ${tenantsDuplicados.length} e-mail(s) de nutricionista repetido(s) com maiúsculas diferentes. ` +
        'Resolva as contas duplicadas antes de rodar esta migration.',
    );
  }

  const tenants: Array<{ id: string }> = await knex('tenants').select('id');
  for (const tenant of tenants) {
    await knex.transaction(async (trx) => {
      await trx.raw("SELECT set_config('app.current_tenant', ?, true)", [tenant.id]);

      const duplicados = await trx('patients')
        .select(trx.raw('lower(email) AS email'))
        .groupByRaw('lower(email)')
        .havingRaw('count(*) > 1');
      if (duplicados.length > 0) {
        throw new Error(
          `O consultório ${tenant.id} tem ${duplicados.length} e-mail(s) de paciente repetido(s) com maiúsculas ` +
            'diferentes. Resolva os pacientes duplicados antes de rodar esta migration.',
        );
      }

      await trx('patients').whereRaw('email <> lower(email)').update({ email: trx.raw('lower(email)') });
    });
  }

  await knex('tenants').whereRaw('email <> lower(email)').update({ email: knex.raw('lower(email)') });

  await knex.raw('ALTER TABLE tenants ADD CONSTRAINT tenants_email_minusculo CHECK (email = lower(email))');
  await knex.raw('ALTER TABLE patients ADD CONSTRAINT patients_email_minusculo CHECK (email = lower(email))');
}

// Volta só a regra: os e-mails continuam em minúsculas, que é uma grafia
// válida para todos eles.
export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_email_minusculo');
  await knex.raw('ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_email_minusculo');
}
