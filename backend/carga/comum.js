/**
 * O que os dois testes de carga (cenario.js e limite.js) compartilham: as
 * contas criadas pelo preparar.ts, o login de todo mundo antes do teste e as
 * telas do app que cada usuário virtual visita.
 */
import http from 'k6/http';
import { check } from 'k6';

// Sem as barras do final, e sem regex (a `/\/+$/` é quadrática com muitas barras).
let base = __ENV.BASE_URL || 'http://localhost:3000';
while (base.endsWith('/')) base = base.slice(0, -1);
export const BASE_URL = base;
export const contas = JSON.parse(open('./contas.json'));
export const CONSULTORIOS = contas.consultorios.length;
export const PACIENTES_POR_CONSULTORIO = contas.consultorios[0].pacientes.length;

const BUSCAS_NA_TACO = ['arroz', 'feijao', 'frango', 'banana', 'leite', 'pao', 'ovo', 'batata', 'maca', 'queijo'];

export function sorteio(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function login(email) {
  return {
    method: 'POST',
    url: `${BASE_URL}/api/auth/login`,
    body: JSON.stringify({ email, senha: contas.senha }),
    params: { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } },
  };
}

/**
 * Loga todo mundo antes do teste, de 5 em 5. O login usa bcrypt de custo 12
 * (RNF-02), que é caro de propósito; ele acontece uma vez por sessão e não
 * entra na medição.
 */
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

/** Todos os nutricionistas e todos os pacientes criados pelo preparar.ts. */
export function logarUsuarios() {
  const saude = http.get(`${BASE_URL}/health`);
  if (saude.status !== 200) throw new Error(`${BASE_URL}/health respondeu ${saude.status}`);

  const nutricionistas = logarTodos(contas.consultorios.map((c) => c.email)).map((r) => r.token);
  const pacientes = logarTodos(contas.consultorios.flatMap((c) => c.pacientes)).map((r) => ({
    token: r.token,
    id: r.patient.id,
  }));
  return { nutricionistas, pacientes };
}

export function corpo(resposta) {
  try {
    return resposta.json();
  } catch (_) {
    return null;
  }
}

/** Chamada autenticada com o nome da tela como tag, para o relatório agrupar. */
export function chamada(token, tags = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  return (metodo, caminho, nome) => {
    const resposta = http.request(metodo, `${BASE_URL}/api${caminho}`, null, {
      headers,
      tags: { ...tags, name: nome },
    });
    check(resposta, { [`${nome} respondeu 2xx`]: (r) => r.status >= 200 && r.status < 300 });
    return resposta;
  };
}

/** Data de Brasília (UTC-3, sem horário de verão desde 2019), AAAA-MM-DD. */
export function hoje(diasAFrente = 0) {
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000 + diasAFrente * 24 * 60 * 60 * 1000);
  return agora.toISOString().slice(0, 10);
}

/**
 * As telas, uma requisição cada. O `ctx` guarda o que a tela anterior trouxe
 * (pacientes, plano, refeições), como o app faz.
 */
export const telasDoNutricionista = [
  (api, ctx) => {
    const pacientes = corpo(api('GET', '/patients', 'nutri_lista_pacientes'));
    if (Array.isArray(pacientes) && pacientes.length > 0) ctx.pacientes = pacientes;
  },
  (api, ctx) => ctx.pacientes && api('GET', `/patients/${sorteio(ctx.pacientes).id}`, 'nutri_ficha_paciente'),
  (api, ctx) => {
    if (!ctx.pacientes) return;
    const planos = corpo(api('GET', `/patients/${sorteio(ctx.pacientes).id}/meal-plans`, 'nutri_planos_do_paciente'));
    if (Array.isArray(planos) && planos.length > 0) ctx.plano = planos[0].id;
  },
  (api, ctx) => ctx.plano && api('GET', `/meal-plans/${ctx.plano}`, 'nutri_plano'),
  (api) => api('GET', '/feedbacks?status=pendente', 'nutri_feedbacks'),
  (api) => api('GET', '/appointments', 'nutri_agenda'),
  (api) => api('GET', `/foods?search=${sorteio(BUSCAS_NA_TACO)}`, 'nutri_busca_taco'),
  (api) => api('GET', '/nps', 'nutri_nps'),
  (api) => api('GET', '/availability', 'nutri_grade'),
];

export const telasDoPaciente = [
  (api, ctx) => {
    const plano = corpo(api('GET', `/patients/${ctx.id}/meal-plans/ativo`, 'paciente_plano_ativo'));
    if (plano && Array.isArray(plano.meals) && plano.meals.length > 0) ctx.refeicoes = plano.meals.map((m) => m.id);
  },
  (api, ctx) =>
    ctx.refeicoes &&
    api(
      'PUT',
      `/patients/${ctx.id}/meal-plans/ativo/meals/${sorteio(ctx.refeicoes)}/conclusao`,
      'paciente_marca_refeicao',
    ),
  (api, ctx) =>
    ctx.refeicoes &&
    api(
      'DELETE',
      `/patients/${ctx.id}/meal-plans/ativo/meals/${sorteio(ctx.refeicoes)}/conclusao`,
      'paciente_desmarca_refeicao',
    ),
  (api, ctx) => api('GET', `/patients/${ctx.id}/nutricionista`, 'paciente_contato_nutri'),
  (api, ctx) => api('GET', `/patients/${ctx.id}/appointments`, 'paciente_consultas'),
  (api) => api('GET', `/appointments/horarios-livres?de=${hoje(1)}&ate=${hoje(7)}`, 'paciente_horarios_livres'),
  (api, ctx) => api('GET', `/patients/${ctx.id}/nps/pendente`, 'paciente_nps'),
  (api, ctx) => api('GET', `/patients/${ctx.id}/lembrete`, 'paciente_lembrete'),
];

export function metrica(data, nome) {
  const m = data.metrics[nome];
  return m ? m.values : {};
}

export function ms(valor) {
  return valor === undefined || Number.isNaN(valor) ? '-' : `${Math.round(valor)} ms`;
}

export function pct(valor) {
  return valor === undefined ? '-' : `${(valor * 100).toFixed(2)}%`;
}
