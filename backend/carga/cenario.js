/**
 * Teste de carga do RNF-06: "no mínimo 50 tenants (nutricionistas) ativos
 * simultaneamente sem degradação perceptível de performance".
 *
 * Duas fases, uma depois da outra:
 *   1. referencia (1 min): 1 nutricionista e 2 pacientes. É o tempo de resposta
 *      com o sistema praticamente vazio.
 *   2. carga (6 min e 30 s): 50 nutricionistas e 100 pacientes, cada
 *      nutricionista no seu consultório e 2 pacientes por consultório. Sobe em
 *      1 min, fica 5 min em 50 e desce em 30 s.
 *
 * Cada usuário virtual repete o que a pessoa faz no app, com uma pausa de 1 a
 * 3 s entre as telas:
 *   - nutricionista: lista de pacientes, ficha, planos, plano, feedbacks,
 *     agenda, busca na TACO, NPS e grade de atendimento;
 *   - paciente: plano do dia, marca e desmarca uma refeição, contato do
 *     nutricionista, consultas, horários livres, NPS e lembrete.
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
import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const contas = JSON.parse(open('./contas.json'));
const CONSULTORIOS = contas.consultorios.length;
const PACIENTES_POR_CONSULTORIO = 2;
const DEGRADACAO_MAXIMA = 2;
const AUMENTO_PERCEPTIVEL_MS = 200;

const BUSCAS_NA_TACO = ['arroz', 'feijao', 'frango', 'banana', 'leite', 'pao', 'ovo', 'batata', 'maca', 'queijo'];

export const options = {
  setupTimeout: '10m',
  scenarios: {
    nutri_referencia: {
      executor: 'constant-vus',
      exec: 'nutricionista',
      vus: 1,
      duration: '1m',
      tags: { fase: 'referencia' },
    },
    paciente_referencia: {
      executor: 'constant-vus',
      exec: 'paciente',
      vus: 2,
      duration: '1m',
      tags: { fase: 'referencia' },
    },
    nutri_carga: {
      executor: 'ramping-vus',
      exec: 'nutricionista',
      startTime: '1m10s',
      startVUs: 0,
      stages: [
        { duration: '1m', target: CONSULTORIOS },
        { duration: '5m', target: CONSULTORIOS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
      tags: { fase: 'carga' },
    },
    paciente_carga: {
      executor: 'ramping-vus',
      exec: 'paciente',
      startTime: '1m10s',
      startVUs: 0,
      stages: [
        { duration: '1m', target: CONSULTORIOS * PACIENTES_POR_CONSULTORIO },
        { duration: '5m', target: CONSULTORIOS * PACIENTES_POR_CONSULTORIO },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
      tags: { fase: 'carga' },
    },
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

function login(email) {
  return {
    method: 'POST',
    url: `${BASE_URL}/api/auth/login`,
    body: JSON.stringify({ email, senha: contas.senha }),
    params: { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } },
  };
}

/** Loga todo mundo antes do teste, de 5 em 5: o bcrypt do login não entra na medição. */
function logarTodos(emails) {
  const respostas = [];
  for (let i = 0; i < emails.length; i += 5) {
    respostas.push(...http.batch(emails.slice(i, i + 5).map(login)));
  }
  return respostas.map((r, i) => {
    if (r.status !== 200) {
      throw new Error(`Login de ${emails[i]} falhou com ${r.status}: ${r.body}`);
    }
    return r.json();
  });
}

export function setup() {
  const saude = http.get(`${BASE_URL}/health`);
  if (saude.status !== 200) throw new Error(`${BASE_URL}/health respondeu ${saude.status}`);

  const nutricionistas = logarTodos(contas.consultorios.map((c) => c.email)).map((r) => r.token);
  const pacientes = logarTodos(contas.consultorios.flatMap((c) => c.pacientes.slice(0, PACIENTES_POR_CONSULTORIO))).map(
    (r) => ({ token: r.token, id: r.patient.id }),
  );

  return { nutricionistas, pacientes };
}

function pausa() {
  sleep(1 + Math.random() * 2);
}

function sorteio(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function hoje(diasAFrente = 0) {
  // Data de Brasília (UTC-3, sem horário de verão desde 2019).
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000 + diasAFrente * 24 * 60 * 60 * 1000);
  return agora.toISOString().slice(0, 10);
}

function chamada(token) {
  const headers = { Authorization: `Bearer ${token}` };
  return (metodo, caminho, nome) => {
    const resposta = http.request(metodo, `${BASE_URL}/api${caminho}`, null, { headers, tags: { name: nome } });
    check(resposta, { [`${nome} respondeu 2xx`]: (r) => r.status >= 200 && r.status < 300 });
    return resposta;
  };
}

function corpo(resposta) {
  try {
    return resposta.json();
  } catch (_) {
    return null;
  }
}

/** Cada usuário virtual fica sempre no mesmo consultório. */
function indiceDoUsuario(total) {
  return (exec.vu.idInTest - 1) % total;
}

export function nutricionista(dados) {
  const api = chamada(dados.nutricionistas[indiceDoUsuario(dados.nutricionistas.length)]);

  const pacientes = corpo(api('GET', '/patients', 'nutri_lista_pacientes'));
  pausa();
  if (!Array.isArray(pacientes) || pacientes.length === 0) return;

  const paciente = sorteio(pacientes);
  api('GET', `/patients/${paciente.id}`, 'nutri_ficha_paciente');
  const planos = corpo(api('GET', `/patients/${paciente.id}/meal-plans`, 'nutri_planos_do_paciente'));
  pausa();

  if (Array.isArray(planos) && planos.length > 0) {
    api('GET', `/meal-plans/${planos[0].id}`, 'nutri_plano');
    pausa();
  }

  api('GET', '/feedbacks?status=pendente', 'nutri_feedbacks');
  pausa();
  api('GET', '/appointments', 'nutri_agenda');
  pausa();
  api('GET', `/foods?search=${sorteio(BUSCAS_NA_TACO)}`, 'nutri_busca_taco');
  pausa();
  api('GET', '/nps', 'nutri_nps');
  api('GET', '/availability', 'nutri_grade');
  pausa();
}

export function paciente(dados) {
  const eu = dados.pacientes[indiceDoUsuario(dados.pacientes.length)];
  const api = chamada(eu.token);
  const base = `/patients/${eu.id}`;

  const plano = corpo(api('GET', `${base}/meal-plans/ativo`, 'paciente_plano_ativo'));
  pausa();

  if (plano && Array.isArray(plano.meals) && plano.meals.length > 0) {
    const refeicao = sorteio(plano.meals);
    api('PUT', `${base}/meal-plans/ativo/meals/${refeicao.id}/conclusao`, 'paciente_marca_refeicao');
    pausa();
    api('DELETE', `${base}/meal-plans/ativo/meals/${refeicao.id}/conclusao`, 'paciente_desmarca_refeicao');
    pausa();
  }

  api('GET', `${base}/nutricionista`, 'paciente_contato_nutri');
  api('GET', `${base}/appointments`, 'paciente_consultas');
  pausa();
  api('GET', `/appointments/horarios-livres?de=${hoje(1)}&ate=${hoje(7)}`, 'paciente_horarios_livres');
  pausa();
  api('GET', `${base}/nps/pendente`, 'paciente_nps');
  api('GET', `${base}/lembrete`, 'paciente_lembrete');
  pausa();
}

function metrica(data, nome) {
  const m = data.metrics[nome];
  return m ? m.values : {};
}

function ms(valor) {
  return valor === undefined ? '-' : `${Math.round(valor)} ms`;
}

function pct(valor) {
  return valor === undefined ? '-' : `${(valor * 100).toFixed(2)}%`;
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
    `Teste de carga do Nutri-Hub (RNF-06) — ${new Date().toISOString()}`,
    `Alvo: ${BASE_URL}`,
    `Carga: ${CONSULTORIOS} nutricionistas e ${CONSULTORIOS * PACIENTES_POR_CONSULTORIO} pacientes ao mesmo tempo`,
    '',
    '                          Referência (1+2)   Carga',
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
    'carga/resultados/resumo.txt': texto,
    'carga/resultados/resumo.json': JSON.stringify(data, null, 2),
  };
}
