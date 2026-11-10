/**
 * Teste de limite: até quantas requisições por segundo o servidor responde
 * bem. Complementa o cenario.js (RNF-06): lá a pergunta é "50 consultórios
 * usando o app ficam rápidos?"; aqui é "quanto o servidor aguenta?".
 *
 * A carga sobe em degraus de requisições por segundo, independente de quantos
 * usuários: cada degrau tem 10 s de subida e 50 s parado no alvo. Cada
 * requisição é uma tela do app (as mesmas do cenario.js), sorteada entre todos
 * os nutricionistas e pacientes criados pelo preparar.ts.
 *
 * Se o p95 de um degrau passar de 5 s, o teste para ali: o servidor já passou
 * do limite, e continuar só deixaria o site lento por mais tempo. Nesse caso o
 * k6 sai com código 99, o que aqui é esperado.
 *
 * A capacidade é o maior degrau em que o servidor entregou pelo menos 95% das
 * requisições pedidas, com p95 abaixo de 1 s e menos de 1% de erro.
 *
 * Uso: ver carga/README.md.
 */
import exec from 'k6/execution';
import {
  BASE_URL,
  chamada,
  corpo,
  logarUsuarios,
  metrica,
  ms,
  pct,
  sorteio,
  telasDoNutricionista,
  telasDoPaciente,
} from './comum.js';

const DEGRAUS = [2, 4, 6, 8, 10, 15, 20, 25, 30, 40];
const SUBIDA_S = 10;
const PARADO_S = 50;
const P95_DE_PARADA_MS = 5000;
const P95_ACEITAVEL_MS = 1000;

const stages = DEGRAUS.flatMap((alvo) => [
  { duration: `${SUBIDA_S}s`, target: alvo },
  { duration: `${PARADO_S}s`, target: alvo },
]);

const thresholds = {};
for (const alvo of DEGRAUS) {
  thresholds[`http_req_duration{degrau:${alvo}}`] = [
    { threshold: `p(95)<${P95_DE_PARADA_MS}`, abortOnFail: true, delayAbortEval: '20s' },
  ];
  thresholds[`http_reqs{degrau:${alvo}}`] = ['count>=0'];
  thresholds[`http_req_failed{degrau:${alvo}}`] = ['rate<=1'];
}

export const options = {
  setupTimeout: '10m',
  scenarios: {
    limite: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 300,
      stages,
    },
  },
  thresholds,
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

/** Já deixa cada conta com o que as telas precisam (pacientes, plano, refeições). */
export function setup() {
  const { nutricionistas, pacientes } = logarUsuarios();

  const ctxNutri = nutricionistas.map((token) => {
    const api = chamada(token, { degrau: 'preparo' });
    const ctx = {};
    telasDoNutricionista[0](api, ctx);
    telasDoNutricionista[2](api, ctx);
    return { token, ctx };
  });

  const ctxPaciente = pacientes.map((p) => {
    const ctx = { id: p.id };
    telasDoPaciente[0](chamada(p.token, { degrau: 'preparo' }), ctx);
    return { token: p.token, ctx };
  });

  return { nutricionistas: ctxNutri, pacientes: ctxPaciente };
}

/** Em qual degrau o teste está; na subida entre dois degraus, 'subida'. */
function degrauAtual() {
  const decorrido = (Date.now() - exec.scenario.startTime) / 1000;
  const indice = Math.floor(decorrido / (SUBIDA_S + PARADO_S));
  if (indice >= DEGRAUS.length) return 'fim';
  return decorrido % (SUBIDA_S + PARADO_S) < SUBIDA_S ? 'subida' : String(DEGRAUS[indice]);
}

export default function (dados) {
  const tags = { degrau: degrauAtual() };
  if (Math.random() < 0.5) {
    const conta = sorteio(dados.nutricionistas);
    sorteio(telasDoNutricionista)(chamada(conta.token, tags), { ...conta.ctx });
  } else {
    const conta = sorteio(dados.pacientes);
    sorteio(telasDoPaciente)(chamada(conta.token, tags), { ...conta.ctx });
  }
}

export function handleSummary(data) {
  const linhasDosDegraus = [];
  let capacidade;
  let parouEm;

  for (const alvo of DEGRAUS) {
    const req = metrica(data, `http_reqs{degrau:${alvo}}`);
    if (!req.count) {
      parouEm = parouEm ?? alvo;
      continue;
    }
    const dur = metrica(data, `http_req_duration{degrau:${alvo}}`);
    const erro = metrica(data, `http_req_failed{degrau:${alvo}}`).rate;
    const atingido = req.count / PARADO_S;
    const bom = atingido >= alvo * 0.95 && dur['p(95)'] < P95_ACEITAVEL_MS && erro < 0.01;
    if (bom && (capacidade === undefined || alvo > capacidade)) capacidade = alvo;

    linhasDosDegraus.push(
      `${String(alvo).padStart(6)}       ${atingido.toFixed(1).padStart(7)}     ${ms(dur.med).padStart(8)}  ` +
        `${ms(dur['p(95)']).padStart(8)}  ${ms(dur['p(99)']).padStart(8)}  ${pct(erro).padStart(7)}   ${bom ? 'ok' : 'NÃO'}`,
    );
  }

  const descartadas = metrica(data, 'dropped_iterations').count ?? 0;

  const linhas = [
    '',
    `Teste de limite do Nutri-Hub — ${new Date().toISOString()}`,
    `Alvo: ${BASE_URL}`,
    '',
    'Pedido/s   Atendido/s    Mediana       p95       p99     Erro   Bom?',
    ...linhasDosDegraus,
    '',
    capacidade === undefined
      ? 'Capacidade: nenhum degrau ficou dentro do aceitável.'
      : `Capacidade: ${capacidade} requisições por segundo com p95 abaixo de ${P95_ACEITAVEL_MS} ms e menos de 1% de erro.`,
    parouEm === undefined
      ? 'O teste passou por todos os degraus.'
      : `O teste parou antes do degrau de ${parouEm}/s: o p95 passou de ${P95_DE_PARADA_MS} ms.`,
    descartadas > 0 ? `Requisições que o k6 nem chegou a mandar porque o servidor não dava vazão: ${descartadas}.` : '',
    '',
  ];
  const texto = linhas.join('\n');

  return {
    stdout: texto,
    'carga/resultados/limite.txt': texto,
    'carga/resultados/limite.json': JSON.stringify(data, null, 2),
  };
}
