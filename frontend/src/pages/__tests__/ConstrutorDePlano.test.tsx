import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockarApi, renderizarEm, respostaJson, salvarSessaoDe } from '@/test/utils';
import type { PlanoAlimentar, Refeicao } from '@/plano/tipos';
import { ConstrutorDePlano } from '../ConstrutorDePlano';

const PACIENTE = {
  id: 'p1',
  nome: 'João Silva',
  email: 'joao@nutrihub.com',
  data_nascimento: '1990-05-20',
  contato: null,
  historico: null,
  status: 'ativo',
  acesso_liberado: true,
  created_at: '2026-09-01T12:00:00.000Z',
  updated_at: '2026-09-01T12:00:00.000Z',
};

const ARROZ = {
  id: 'food-1',
  nome: 'Arroz, tipo 1, cozido',
  kcal_100g: '128.00',
  proteina_100g: '2.50',
  carb_100g: '28.10',
  gordura_100g: '0.20',
};

function refeicao(sobrescritas: Partial<Refeicao> = {}): Refeicao {
  return { id: 'meal-1', nome: 'Almoço', horario: '12:00:00', items: [], ...sobrescritas };
}

function plano(sobrescritas: Partial<PlanoAlimentar> = {}): PlanoAlimentar {
  return {
    id: 'plan-1',
    patient_id: 'p1',
    status: 'rascunho',
    meta_kcal: null,
    orientacoes: null,
    published_at: null,
    meals: [],
    totais: { kcal: 0, proteina_g: 0, carb_g: 0, gordura_g: 0 },
    ...sobrescritas,
  };
}

function renderizar() {
  return renderizarEm('/planos/:id', <ConstrutorDePlano />, '/planos/plan-1');
}

beforeEach(() => {
  localStorage.clear();
  salvarSessaoDe('nutricionista');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ConstrutorDePlano — rascunho (RF-04)', () => {
  it('adiciona uma refeição e recarrega o plano', async () => {
    let atual = plano();
    const api = mockarApi({
      'GET /api/meal-plans/plan-1': () => respostaJson(200, atual),
      'GET /api/patients/p1': () => respostaJson(200, PACIENTE),
      'POST /api/meal-plans/plan-1/meals': (corpo) => {
        atual = plano({ meals: [refeicao({ nome: (corpo as { nome: string }).nome })] });
        return respostaJson(201, {});
      },
      'GET /api/foods?search=': () => respostaJson(200, []),
    });

    renderizar();
    await userEvent.type(await screen.findByLabelText('Nome'), 'Almoço');
    await userEvent.type(screen.getByLabelText('Horário'), '12:00');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByRole('heading', { name: /Almoço/ })).toBeInTheDocument();
    const post = api.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ nome: 'Almoço', horario: '12:00' });
  });

  it('busca na TACO, mostra a prévia dos macros e adiciona o alimento', async () => {
    let atual = plano({ meals: [refeicao()] });
    const api = mockarApi({
      'GET /api/meal-plans/plan-1': () => respostaJson(200, atual),
      'GET /api/patients/p1': () => respostaJson(200, PACIENTE),
      'GET /api/foods?search=arroz': () => respostaJson(200, [ARROZ]),
      'POST /api/meal-plans/plan-1/meals/meal-1/items': () => {
        atual = plano({
          meals: [
            refeicao({
              items: [
                {
                  id: 'item-1',
                  food_id: 'food-1',
                  food_nome: ARROZ.nome,
                  quantidade_g: '150.00',
                  kcal: '192.00',
                  proteina_g: '3.75',
                  carb_g: '42.15',
                  gordura_g: '0.30',
                },
              ],
            }),
          ],
          totais: { kcal: 192, proteina_g: 3.75, carb_g: 42.15, gordura_g: 0.3 },
        });
        return respostaJson(201, {});
      },
    });

    renderizar();
    // Refeição sem alimento já abre a busca.
    await userEvent.type(await screen.findByLabelText('Buscar alimento da TACO para Almoço'), 'arroz');
    await userEvent.click(await screen.findByRole('button', { name: /Arroz, tipo 1, cozido/ }));

    const quantidade = screen.getByLabelText('Quantidade (g)');
    await userEvent.clear(quantidade);
    await userEvent.type(quantidade, '150');
    // Mesma conta do backend: 128 kcal/100 g × 150 g = 192 kcal.
    expect(screen.getByText('192 kcal')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar à refeição' }));

    const resumo = within(await screen.findByRole('region', { name: 'Resumo do dia' }));
    expect(await resumo.findByText('192 kcal')).toBeInTheDocument();
    const post = api.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ food_id: 'food-1', quantidade_g: 150 });
  });

  it('remove um alimento do rascunho', async () => {
    let atual = plano({
      meals: [
        refeicao({
          items: [
            {
              id: 'item-1',
              food_id: 'food-1',
              food_nome: ARROZ.nome,
              quantidade_g: '100.00',
              kcal: '128.00',
              proteina_g: '2.50',
              carb_g: '28.10',
              gordura_g: '0.20',
            },
          ],
        }),
      ],
    });
    mockarApi({
      'GET /api/meal-plans/plan-1': () => respostaJson(200, atual),
      'GET /api/patients/p1': () => respostaJson(200, PACIENTE),
      'DELETE /api/meal-plans/plan-1/meals/meal-1/items/item-1': () => {
        atual = plano({ meals: [refeicao()] });
        return new Response(null, { status: 204 });
      },
    });

    renderizar();
    await userEvent.click(await screen.findByRole('button', { name: `Remover ${ARROZ.nome} de Almoço` }));

    expect(await screen.findByRole('button', { name: '+ Adicionar alimento' })).toBeInTheDocument();
    expect(screen.queryByText(ARROZ.nome)).not.toBeInTheDocument();
  });

  it('publica com meta e orientações depois de confirmar', async () => {
    let atual = plano({ meals: [refeicao()] });
    const api = mockarApi({
      'GET /api/meal-plans/plan-1': () => respostaJson(200, atual),
      'GET /api/patients/p1': () => respostaJson(200, PACIENTE),
      'POST /api/meal-plans/plan-1/publish': () => {
        atual = plano({
          status: 'ativo',
          meals: [refeicao()],
          meta_kcal: '1800.00',
          published_at: '2026-09-24T12:00:00Z',
        });
        return respostaJson(200, atual);
      },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderizar();
    await userEvent.type(await screen.findByLabelText('Meta calórica diária (kcal, opcional)'), '1800');
    // A meta digitada já aparece no resumo antes de publicar.
    expect(screen.getByText('Meta diária')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Orientações ao paciente (opcional)'), 'Beba água.');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar plano' }));

    expect(await screen.findByText('Plano publicado. O paciente já pode vê-lo no app.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar correção' })).toBeInTheDocument();
    const post = api.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ meta_kcal: '1800', orientacoes: 'Beba água.' });
  });

  it('mostra o E-08 quando o plano ainda não tem alimentos', async () => {
    mockarApi({
      'GET /api/meal-plans/plan-1': () => respostaJson(200, plano({ meals: [refeicao()] })),
      'GET /api/patients/p1': () => respostaJson(200, PACIENTE),
      'POST /api/meal-plans/plan-1/publish': () =>
        respostaJson(400, { code: 'E-08', message: 'Adicione ao menos uma refeição antes de publicar' }),
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderizar();
    await userEvent.click(await screen.findByRole('button', { name: 'Publicar plano' }));

    expect(await screen.findByText('Adicione ao menos uma refeição antes de publicar')).toBeInTheDocument();
  });
});

describe('ConstrutorDePlano — plano ativo (issue #10)', () => {
  it('não oferece edição de refeições e corrige meta/orientações via PATCH', async () => {
    const api = mockarApi({
      'GET /api/meal-plans/plan-1': () =>
        respostaJson(
          200,
          plano({ status: 'ativo', meta_kcal: '1800.00', orientacoes: 'Evite frituras.', meals: [refeicao()] }),
        ),
      'GET /api/patients/p1': () => respostaJson(200, PACIENTE),
      'PATCH /api/meal-plans/plan-1': () =>
        respostaJson(200, plano({ status: 'ativo', meta_kcal: '1900.00', orientacoes: 'Evite frituras.' })),
    });

    renderizar();
    const meta = await screen.findByLabelText('Meta calórica diária (kcal, opcional)');
    expect(meta).toHaveValue(1800);
    expect(screen.queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Buscar alimento da TACO para Almoço')).not.toBeInTheDocument();

    await userEvent.clear(meta);
    await userEvent.type(meta, '1900');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar correção' }));

    expect(await screen.findByText('Correção salva. O paciente já vê a versão corrigida.')).toBeInTheDocument();
    const patch = api.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ meta_kcal: '1900', orientacoes: 'Evite frituras.' });
  });

  it('plano encerrado é só consulta', async () => {
    mockarApi({
      'GET /api/meal-plans/plan-1': () => respostaJson(200, plano({ status: 'encerrado', meals: [refeicao()] })),
      'GET /api/patients/p1': () => respostaJson(200, PACIENTE),
    });

    renderizar();

    expect(await screen.findByText(/fica guardado apenas para consulta/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar correção' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar plano' })).not.toBeInTheDocument();
  });
});
