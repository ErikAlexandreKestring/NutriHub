/**
 * Teste de carga (RNF-06), passo 1: cria a massa de teste.
 *
 * São 4 consultórios fictícios, cada um com:
 *   - 10 pacientes com acesso ao app e plano ativo de 5 refeições com 3 alimentos;
 *   - grade de atendimento de segunda a sexta;
 *   - 2 feedbacks pendentes e 2 consultas marcadas.
 *
 * Tudo fica no domínio @carga.nutrihub.test, que não recebe e-mail, e o
 * lembrete diário (RF-07) já nasce desligado: a massa de teste não dispara
 * envio nenhum. O `limpar.ts` apaga tudo depois.
 *
 * A senha é sorteada a cada preparo e vai, com os e-mails, para
 * carga/contas.json (fora do git), que o k6 lê.
 */
import { randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
import path from 'path';
import knexLib, { Knex } from 'knex';
import knexConfig from '../src/db/knexfile';
import { env } from '../src/config/env';
import { hashPassword } from '../src/shared/utils/password';

export const DOMINIO = 'carga.nutrihub.test';
export const ARQUIVO_DE_CONTAS = path.join(__dirname, 'contas.json');

// 4 consultórios com 10 pacientes: o tamanho combinado com o professor para
// esta etapa. CARGA_CONSULTORIOS e CARGA_PACIENTES mudam os números (o RNF-06
// fala em 50 consultórios), e os testes do k6 se ajustam sozinhos.
const CONSULTORIOS = Number(process.env.CARGA_CONSULTORIOS ?? 4);
const PACIENTES_POR_CONSULTORIO = Number(process.env.CARGA_PACIENTES ?? 10);

const REFEICOES = [
  { nome: 'Café da manhã', horario: '07:00' },
  { nome: 'Lanche da manhã', horario: '10:00' },
  { nome: 'Almoço', horario: '12:30' },
  { nome: 'Lanche da tarde', horario: '16:00' },
  { nome: 'Jantar', horario: '19:30' },
];

interface Alimento {
  id: string;
  kcal_100g: string;
  proteina_100g: string;
  carb_100g: string;
  gordura_100g: string;
}

/** Próximo dia útil a partir de amanhã, às 10:00 ou 14:00 de Brasília. */
function consultaFutura(diasAFrente: number, hora: string): Date {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + diasAFrente);
  while ([0, 6].includes(data.getUTCDay())) data.setUTCDate(data.getUTCDate() + 1);
  const dia = data.toISOString().slice(0, 10);
  return new Date(`${dia}T${hora}:00-03:00`);
}

function numero(n: number): string {
  return String(n).padStart(2, '0');
}

async function criarConsultorio(
  owner: Knex,
  indice: number,
  senhaHash: string,
  alimentos: Alimento[],
): Promise<{ email: string; pacientes: string[] }> {
  const email = `nutri-${numero(indice)}@${DOMINIO}`;
  const pacientes: string[] = [];

  await owner.transaction(async (trx) => {
    const [tenant] = await trx('tenants')
      .insert({
        nome: `Consultório de Carga ${numero(indice)}`,
        email,
        crn: `CRN-0 ${1000 + indice}`,
        senha_hash: senhaHash,
        email_confirmado_em: new Date(),
      })
      .returning('id');
    const tenantId: string = tenant.id;

    // As outras tabelas têm FORCE RLS, que vale até para o dono delas.
    await trx.raw("SELECT set_config('app.current_tenant', ?, true)", [tenantId]);

    await trx('availability').insert(
      [1, 2, 3, 4, 5].flatMap((dia) => [
        { tenant_id: tenantId, day_of_week: dia, start_time: '08:00', end_time: '12:00' },
        { tenant_id: tenantId, day_of_week: dia, start_time: '13:00', end_time: '18:00' },
      ]),
    );

    for (let p = 1; p <= PACIENTES_POR_CONSULTORIO; p += 1) {
      const emailDoPaciente = `paciente-${numero(indice)}-${p}@${DOMINIO}`;
      pacientes.push(emailDoPaciente);

      const [paciente] = await trx('patients')
        .insert({
          tenant_id: tenantId,
          nome: `Paciente ${p} do Consultório ${numero(indice)}`,
          email: emailDoPaciente,
          data_nascimento: '1980-05-20',
          status: 'ativo',
          senha_hash: senhaHash,
          lembrete_refeicoes: false,
        })
        .returning('id');

      const [plano] = await trx('meal_plans')
        .insert({ tenant_id: tenantId, patient_id: paciente.id, status: 'ativo', published_at: new Date() })
        .returning('id');

      const meals = await trx('meals')
        .insert(REFEICOES.map((r) => ({ tenant_id: tenantId, meal_plan_id: plano.id, ...r })))
        .returning('id');

      await trx('meal_items').insert(
        meals.flatMap((meal, m) =>
          [0, 1, 2].map((k) => {
            const alimento = alimentos[(indice + p + m * 3 + k) % alimentos.length];
            const gramas = 100;
            return {
              tenant_id: tenantId,
              meal_id: meal.id,
              food_id: alimento.id,
              quantidade_g: gramas,
              kcal: (Number(alimento.kcal_100g) * gramas) / 100,
              proteina_g: (Number(alimento.proteina_100g) * gramas) / 100,
              carb_g: (Number(alimento.carb_100g) * gramas) / 100,
              gordura_g: (Number(alimento.gordura_100g) * gramas) / 100,
            };
          }),
        ),
      );

      if (p <= 2) {
        await trx('feedbacks').insert({
          tenant_id: tenantId,
          patient_id: paciente.id,
          meal_plan_id: plano.id,
          meal_id: meals[2].id,
          descricao: 'Feedback de teste de carga.',
        });
        await trx('appointments').insert({
          tenant_id: tenantId,
          patient_id: paciente.id,
          data_hora: consultaFutura(p, p === 1 ? '10:00' : '14:00'),
        });
      }
    }
  });

  return { email, pacientes };
}

async function main(): Promise<void> {
  const ambiente = env.nodeEnv === 'production' ? 'production' : 'development';
  const owner = knexLib(knexConfig[ambiente]);

  try {
    const existentes = await owner('tenants').whereLike('email', `%@${DOMINIO}`).count<{ count: string }[]>('id');
    if (Number(existentes[0].count) > 0) {
      throw new Error(
        `Já existe massa de teste no banco ${ambiente}. Apague antes com o carga:limpar, ` +
          'carregando as mesmas variáveis de ambiente deste comando.',
      );
    }

    const alimentos = await owner('foods')
      .select<Alimento[]>('id', 'kcal_100g', 'proteina_100g', 'carb_100g', 'gordura_100g')
      .orderBy('nome')
      .limit(40);
    if (alimentos.length === 0) {
      throw new Error('A tabela foods está vazia. Rode o seed da TACO antes.');
    }

    const senha = `Carga-${randomBytes(9).toString('base64url')}`;
    const senhaHash = await hashPassword(senha);

    const consultorios = [];
    for (let i = 1; i <= CONSULTORIOS; i += 1) {
      consultorios.push(await criarConsultorio(owner, i, senhaHash, alimentos));
      process.stdout.write(`\rConsultórios criados: ${i}/${CONSULTORIOS}`);
    }
    process.stdout.write('\n');

    writeFileSync(ARQUIVO_DE_CONTAS, JSON.stringify({ senha, consultorios }, null, 2), { mode: 0o600 });
    console.warn(
      `Pronto: ${CONSULTORIOS} consultórios e ${CONSULTORIOS * PACIENTES_POR_CONSULTORIO} pacientes ` +
        `no banco ${ambiente}. Contas em ${ARQUIVO_DE_CONTAS}`,
    );
  } finally {
    await owner.destroy();
  }
}

if (require.main === module) {
  main().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
}
