/**
 * Teste de carga do RNF-06, com uso realista: vários consultórios usando o app
 * ao mesmo tempo, "sem degradação perceptível de performance".
 *
 * O RNF-06 fala em 50 nutricionistas. Nesta etapa, por orientação do
 * professor, o teste usa 4 consultórios com 10 pacientes cada (o que o
 * preparar.ts cria). Os números saem do carga/contas.json, então o mesmo
 * teste roda com 50 consultórios sem mudar nada aqui
 * (CARGA_CONSULTORIOS=50 no preparar).
 *
 * Duas fases, uma depois da outra:
 *   1. referencia (4 min): 1 nutricionista e 4 pacientes, no mesmo ritmo. É o
 *      tempo de resposta com o sistema praticamente vazio. Dura 4 min para ter
 *      umas 120 requisições: com 30, o p95 é quase a segunda resposta mais
 *      lenta, e um pico isolado decide a comparação.
 *   2. carga (6 min e 30 s): todos os nutricionistas e todos os pacientes
 *      (4 + 40 = 44 usuários) usando o app ao mesmo tempo. Sobe em 1 min, fica
 *      5 min com todos e desce em 30 s.
 *
 * Cada usuário virtual navega pelas telas do app como uma pessoa: abre uma
 * tela, lê e decide o que fazer, de 5 a 15 s, e abre a próxima.
 *   - nutricionista: lista de pacientes, ficha, planos, plano, feedbacks,
 *     agenda, busca na TACO, NPS e grade de atendimento;
 *   - paciente: plano do dia, marca e desmarca uma refeição, contato do
 *     nutricionista, consultas, horários livres, NPS e lembrete.
 * Isso já é mais do que o uso real: todos ficam navegando sem parar durante
 * os 5 min, quando na prática o paciente abre o app algumas vezes por dia.
 *
 * Quanto o servidor aguenta no máximo é o outro teste, limite.js.
 *
 * O teste só lê e marca refeições. Não manda feedback nem agenda consulta,
 * que disparariam e-mail de verdade.
 *
 * Critérios (ficam reprovados no fim, com código de saída diferente de 0):
 *   - menos de 1% de erro na fase de carga;
 *   - p95 de todas as requisições abaixo de 1 s na fase de carga;
 *   - p95 do plano do paciente abaixo de 2 s na carga (KPI da seção 1.6 do RFC);
 *   - sem degradação perceptível: o p95 da carga não pode passar de 2x o da
 *     referência E subir mais de 200 ms ao mesmo tempo. Em milissegundos
 *     baixos, dobrar (5 ms para 10 ms) não é perceptível; por isso as duas
 *     condições juntas (calculado no relatório).
 *
 * Uso: ver carga/README.md.
 */
import exec from 'k6/execution';
import { sleep } from 'k6';
import {
  BASE_URL,
  CONSULTORIOS,
  PACIENTES_POR_CONSULTORIO,
  chamada,
  logarUsuarios,
  metrica,
  ms,
  pct,
  telasDoNutricionista,
  telasDoPaciente,
} from './comum.js';

const PAUSA_MINIMA_S = 5;
const PAUSA_MAXIMA_S = 15;
const DEGRADACAO_MAXIMA = 2;
const AUMENTO_PERCEPTIVEL_MS = 200;
const NUTRIS_NA_REFERENCIA = 1;
const PACIENTES_NA_REFERENCIA = 4;
const PACIENTES = CONSULTORIOS * PACIENTES_POR_CONSULTORIO;

function rampa(alvo) {
  return {
    executor: 'ramping-vus',
    startTime: '4m10s',
    startVUs: 0,
    stages: [
      { duration: '1m', target: alvo },
      { duration: '5m', target: alvo },
      { duration: '30s', target: 0 },
    ],
    gracefulRampDown: '20s',
    tags: { fase: 'carga' },
  };
}

export const options = {
  setupTimeout: '10m',
  scenarios: {
    nutri_referencia: {
      executor: 'constant-vus',
      exec: 'nutricionista',
      vus: NUTRIS_NA_REFERENCIA,
      duration: '4m',
      tags: { fase: 'referencia' },
    },
    paciente_referencia: {
      executor: 'constant-vus',
      exec: 'paciente',
      vus: PACIENTES_NA_REFERENCIA,
      duration: '4m',
      tags: { fase: 'referencia' },
    },
    nutri_carga: { ...rampa(CONSULTORIOS), exec: 'nutricionista' },
    paciente_carga: { ...rampa(PACIENTES), exec: 'paciente' },
  },
  thresholds: {
    'http_req_failed{fase:carga}': ['rate<0.01'],
    'http_req_duration{fase:carga}': ['p(95)<1000'],
    'http_req_duration{fase:carga,name:paciente_plano_ativo}': ['p(95)<2000'],
    'checks{fase:carga}': ['rate>0.99'],
    // Sem critério: estão aqui só para o relatório comparar as duas fases.
    'http_req_failed{fase:referencia}': ['rate<=1'],
    'http_req_duration{fase:referencia}': ['max>=0'],
    'http_req_duration{fase:referencia,name:paciente_plano_ativo}': ['max>=0'],
    'http_reqs{fase:referencia}': ['count>=0'],
    'http_reqs{fase:carga}': ['count>=0'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  return logarUsuarios();
}

function pausa() {
  sleep(PAUSA_MINIMA_S + Math.random() * (PAUSA_MAXIMA_S - PAUSA_MINIMA_S));
}

/** Cada usuário virtual fica sempre na mesma conta. */
function indiceDoUsuario(total) {
  return (exec.vu.idInTest - 1) % total;
}

function navegar(telas, api, ctx) {
  for (const tela of telas) {
    tela(api, ctx);
    pausa();
  }
}

export function nutricionista(dados) {
  const token = dados.nutricionistas[indiceDoUsuario(dados.nutricionistas.length)];
  navegar(telasDoNutricionista, chamada(token), {});
}

export function paciente(dados) {
  const eu = dados.pacientes[indiceDoUsuario(dados.pacientes.length)];
  navegar(telasDoPaciente, chamada(eu.token), { id: eu.id });
}

export function handleSummary(data) {
  const ref = metrica(data, 'http_req_duration{fase:referencia}');
  const carga = metrica(data, 'http_req_duration{fase:carga}');
  const planoRef = metrica(data, 'http_req_duration{fase:referencia,name:paciente_plano_ativo}');
  const planoCarga = metrica(data, 'http_req_duration{fase:carga,name:paciente_plano_ativo}');
  const erroRef = metrica(data, 'http_req_failed{fase:referencia}').rate;
  const erroCarga = metrica(data, 'http_req_failed{fase:carga}').rate;
  const reqRef = metrica(data, 'http_reqs{fase:referencia}');
  const reqCarga = metrica(data, 'http_reqs{fase:carga}');

  const razao = ref['p(95)'] ? carga['p(95)'] / ref['p(95)'] : undefined;
  const aumento = carga['p(95)'] - ref['p(95)'];
  const semDegradacao = razao !== undefined && (razao <= DEGRADACAO_MAXIMA || aumento <= AUMENTO_PERCEPTIVEL_MS);

  const thresholds = Object.entries(data.metrics)
    .filter(([, m]) => m.thresholds)
    .flatMap(([nome, m]) => Object.entries(m.thresholds).map(([regra, r]) => ({ nome, regra, ok: r.ok })))
    .filter((t) => t.nome.includes('fase:carga') && !t.regra.includes('>=0'));
  const aprovado = thresholds.every((t) => t.ok) && semDegradacao;

  const linhas = [
    '',
    `Teste de carga do Nutri-Hub (RNF-06), uso realista — ${new Date().toISOString()}`,
    `Alvo: ${BASE_URL}`,
    `Carga: ${CONSULTORIOS} nutricionistas e ${PACIENTES} pacientes (${PACIENTES_POR_CONSULTORIO} por consultório), ` +
      `${CONSULTORIOS + PACIENTES} usuários ao mesmo tempo, ` +
      `com ${PAUSA_MINIMA_S} a ${PAUSA_MAXIMA_S} s entre as telas`,
    '',
    `                          Referência (${NUTRIS_NA_REFERENCIA}+${PACIENTES_NA_REFERENCIA})   Carga`,
    `Requisições              ${String(reqRef.count ?? '-').padEnd(19)}${reqCarga.count ?? '-'}`,
    `Requisições por segundo  ${String(reqRef.rate?.toFixed(1) ?? '-').padEnd(19)}${reqCarga.rate?.toFixed(1) ?? '-'}`,
    `Taxa de erro             ${pct(erroRef).padEnd(19)}${pct(erroCarga)}`,
    `Tempo médio              ${ms(ref.avg).padEnd(19)}${ms(carga.avg)}`,
    `Mediana                  ${ms(ref.med).padEnd(19)}${ms(carga.med)}`,
    `p95                      ${ms(ref['p(95)']).padEnd(19)}${ms(carga['p(95)'])}`,
    `p99                      ${ms(ref['p(99)']).padEnd(19)}${ms(carga['p(99)'])}`,
    `p95 do plano do paciente ${ms(planoRef['p(95)']).padEnd(19)}${ms(planoCarga['p(95)'])}`,
    '',
    'Critérios:',
    ...thresholds.map((t) => `  [${t.ok ? 'OK' : 'FALHOU'}] ${t.nome}: ${t.regra}`),
    `  [${semDegradacao ? 'OK' : 'FALHOU'}] sem degradação perceptível: p95 subiu ${ms(aumento)} ` +
      `(${razao === undefined ? '-' : razao.toFixed(2)}x); reprova só acima de ${DEGRADACAO_MAXIMA}x ` +
      `e de ${AUMENTO_PERCEPTIVEL_MS} ms`,
    '',
    `Resultado: ${aprovado ? 'APROVADO' : 'REPROVADO'}`,
    '',
  ];
  const texto = linhas.join('\n');

  return {
    stdout: texto,
    'carga/resultados/cenario.txt': texto,
    'carga/resultados/cenario.json': JSON.stringify(data, null, 2),
  };
}
