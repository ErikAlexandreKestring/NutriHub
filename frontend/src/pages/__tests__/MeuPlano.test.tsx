import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessaoProvider } from '@/auth/SessaoProvider';
import { MeuPlano } from '../MeuPlano';
import type { PlanoAtivo } from '@/plano/tipos';

function tokenDePaciente() {
  const payload = btoa(JSON.stringify({ role: 'paciente', exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `cabecalho.${payload}.assinatura`;
}

function respostaJson(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
}

function planoDeExemplo(sobrescritas: Partial<PlanoAtivo> = {}): PlanoAtivo {
  return {
    id: 'plan-1',
    patient_id: 'patient-1',
    status: 'ativo',
    meta_kcal: '1800.00',
    orientacoes: 'Beba 2 litros de água por dia.',
    published_at: '2026-09-10T12:00:00.000Z',
    meals: [
      {
        id: 'meal-1',
        nome: 'Café da manhã',
        horario: '07:30:00',
        items: [
          {
            id: 'item-1',
            food_id: 'food-1',
            food_nome: 'Arroz branco cozido',
            quantidade_g: '150',
            kcal: '192',
            proteina_g: '3.75',
            carb_g: '42.15',
            gordura_g: '0.3',
          },
        ],
      },
    ],
    totais: { kcal: 192, proteina_g: 3.75, carb_g: 42.15, gordura_g: 0.3 },
    ...sobrescritas,
  };
}

function renderizar() {
  localStorage.setItem(
    'nutrihub.sessao',
    JSON.stringify({
      token: tokenDePaciente(),
      papel: 'paciente',
      usuarioId: 'patient-1',
      nome: 'João Silva',
      email: 'joao@nutrihub.com',
      expiraEm: Date.now() + 3_600_000,
    }),
  );

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SessaoProvider>
        <MeuPlano />
      </SessaoProvider>
    </MemoryRouter>,
  );
}

describe('MeuPlano (RF-05)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra refeições, itens, metas e orientações do plano ativo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respostaJson(200, planoDeExemplo()));

    renderizar();

    expect(await screen.findByText('Café da manhã')).toBeInTheDocument();
    expect(screen.getByText('Arroz branco cozido')).toBeInTheDocument();
    expect(screen.getByText('07:30')).toBeInTheDocument();
    expect(screen.getByText('Beba 2 litros de água por dia.')).toBeInTheDocument();
    expect(screen.getByText('Meta diária')).toBeInTheDocument();
  });

  it('pede o plano do paciente autenticado', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(respostaJson(200, planoDeExemplo()));

    renderizar();
    await screen.findByText('Café da manhã');

    expect(fetchMock).toHaveBeenCalledWith('/api/patients/patient-1/meal-plans/ativo', expect.anything());
  });

  // A meta é do nutricionista e o previsto é a soma dos itens; confundir os dois
  // faria o paciente ler o próprio plano como se já cumprisse a meta.
  it('distingue a meta do total previsto no plano', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respostaJson(200, planoDeExemplo()));

    renderizar();
    await screen.findByText('Café da manhã');

    // "192 kcal" também aparece no cabeçalho da refeição e no item, então a
    // asserção precisa olhar o resumo — é lá que meta e previsto se confrontam.
    const resumo = within(screen.getByRole('region', { name: 'Resumo do dia' }));
    expect(resumo.getByText('1.800 kcal')).toBeInTheDocument();
    expect(resumo.getByText('192 kcal')).toBeInTheDocument();
    expect(screen.getByText(/abaixo da meta/)).toBeInTheDocument();
  });

  it('omite o bloco de meta quando o nutricionista não definiu uma', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respostaJson(200, planoDeExemplo({ meta_kcal: null })));

    renderizar();
    await screen.findByText('Café da manhã');

    expect(screen.queryByText('Meta diária')).not.toBeInTheDocument();
    expect(screen.getByText('Previsto no plano')).toBeInTheDocument();
  });

  it('não mostra a seção de orientações quando não há texto', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respostaJson(200, planoDeExemplo({ orientacoes: null })));

    renderizar();
    await screen.findByText('Café da manhã');

    expect(screen.queryByText('Orientações do nutricionista')).not.toBeInTheDocument();
  });

  // 404 aqui não é falha: é o paciente que ainda não teve plano publicado.
  it('mostra estado vazio quando não há plano ativo', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      respostaJson(404, { code: 'NOT_FOUND', message: 'Você ainda não tem um plano alimentar ativo' }),
    );

    renderizar();

    expect(await screen.findByText('Nenhum plano ativo')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // Revisão do PR #9: com valores redondos os dois arredondamentos coincidiam e
  // o problema não aparecia. Aqui o total do backend (1501.2) diverge da soma
  // das linhas, e a tela precisa mostrar o que o paciente encontra somando.
  it('mostra um total que fecha com a soma das refeições exibidas', async () => {
    const comCentavos = planoDeExemplo({
      meta_kcal: '1800.00',
      meals: ['m1', 'm2', 'm3'].map((id, indice) => ({
        id,
        nome: `Refeição ${indice + 1}`,
        horario: `0${7 + indice}:00:00`,
        items: [
          {
            id: `item-${id}`,
            food_id: 'food-1',
            food_nome: 'Arroz branco cozido',
            quantidade_g: '390',
            kcal: '500.4',
            proteina_g: '0',
            carb_g: '0',
            gordura_g: '0',
          },
        ],
      })),
      totais: { kcal: 1501.2, proteina_g: 0, carb_g: 0, gordura_g: 0 },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respostaJson(200, comCentavos));

    renderizar();
    await screen.findByText('Refeição 1');

    // Cada linha mostra 500 kcal; 500 x 3 = 1.500.
    const resumo = within(screen.getByRole('region', { name: 'Resumo do dia' }));
    expect(resumo.getByText('1.500 kcal')).toBeInTheDocument();
    expect(resumo.queryByText('1.501 kcal')).not.toBeInTheDocument();
    // A comparação com a meta segue o mesmo número exibido.
    expect(screen.getByText('O plano está 300 kcal abaixo da meta.')).toBeInTheDocument();
  });

  // O `sessao!` dependia de a RotaProtegida ter rodado antes; montado direto,
  // estourava TypeError em vez de falhar de forma recuperável.
  it('não quebra quando é montada sem sessão', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    expect(() =>
      render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SessaoProvider>
            <MeuPlano />
          </SessaoProvider>
        </MemoryRouter>,
      ),
    ).not.toThrow();

    // E não dispara requisição com id vazio.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mostra alerta de erro quando a API falha', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      respostaJson(500, { code: 'ERRO', message: 'Falha interna' }),
    );

    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha interna');
  });

  // Guarda defensiva: o backend não produz este formato (publish recusa plano
  // vazio, E-08). O teste fixa o comportamento da tela caso a API mude.
  it('avisa quando o plano chega sem refeições', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      respostaJson(200, planoDeExemplo({ meals: [], totais: { kcal: 0, proteina_g: 0, carb_g: 0, gordura_g: 0 } })),
    );

    renderizar();

    expect(await screen.findByText('Nenhuma refeição neste plano')).toBeInTheDocument();
  });
});
