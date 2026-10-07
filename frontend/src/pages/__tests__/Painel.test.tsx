import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { mockarApi, renderizarEm, respostaJson, salvarSessaoDe } from '@/test/utils';
import { congelarRelogio, consulta } from '@/agenda/__tests__/fixtures';
import { doConsultorio } from '@/feedback/__tests__/fixtures';
import type { Paciente } from '@/pacientes/tipos';
import { Painel } from '../Painel';

function paciente(sobrescritas: Partial<Paciente> = {}): Paciente {
  return {
    id: 'patient-1',
    nome: 'João Silva',
    email: 'joao@email.com',
    data_nascimento: '1960-01-01',
    contato: null,
    historico: null,
    status: 'ativo',
    acesso_liberado: true,
    created_at: '2026-09-01T12:00:00.000Z',
    updated_at: '2026-09-01T12:00:00.000Z',
    ...sobrescritas,
  };
}

const ROTAS = {
  pacientes: 'GET /api/patients',
  feedbacks: 'GET /api/feedbacks?status=pendente',
  consultas: 'GET /api/appointments',
};

beforeEach(() => {
  // Quinta, 1º/10/2026, 09:00 em Brasília.
  congelarRelogio();
  localStorage.clear();
  salvarSessaoDe('nutricionista');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderizar() {
  return renderizarEm('/painel', <Painel />, '/painel');
}

function indicador(rotulo: string) {
  const resumo = within(screen.getByRole('region', { name: 'Resumo' }));
  return resumo.getByText(rotulo).closest('a')!;
}

describe('Painel do nutricionista (RF-10)', () => {
  it('resume pacientes ativos, feedbacks pendentes e consultas de hoje', async () => {
    mockarApi({
      [ROTAS.pacientes]: () =>
        respostaJson(200, [paciente(), paciente({ id: 'p2' }), paciente({ id: 'p3', status: 'inativo' })]),
      [ROTAS.feedbacks]: () => respostaJson(200, [doConsultorio()]),
      [ROTAS.consultas]: () =>
        respostaJson(200, [
          // 08:00 de hoje (já passou), 14:00 de hoje e sábado.
          { ...consulta({ id: 'c1', data_hora: '2026-10-01T11:00:00.000Z' }), patient_nome: 'Ana' },
          { ...consulta({ id: 'c2', data_hora: '2026-10-01T17:00:00.000Z' }), patient_nome: 'Bruno' },
          { ...consulta({ id: 'c3', data_hora: '2026-10-03T13:00:00.000Z' }), patient_nome: 'Carla' },
        ]),
    });

    renderizar();

    expect(await screen.findByRole('heading', { level: 1, name: 'Olá, Ana' })).toBeInTheDocument();
    await screen.findByText('Bruno');

    expect(within(indicador('Pacientes ativos')).getByText('2')).toBeInTheDocument();
    expect(within(indicador('Feedbacks pendentes')).getByText('1')).toBeInTheDocument();
    expect(within(indicador('Consultas hoje')).getByText('2')).toBeInTheDocument();
    expect(indicador('Feedbacks pendentes')).toHaveAttribute('href', '/feedbacks');

    // A consulta das 08:00 já passou: sai das próximas, mas conta no dia.
    const proximas = within(screen.getByRole('region', { name: 'Próximas consultas' }));
    expect(proximas.queryByText('Ana')).not.toBeInTheDocument();
    expect(proximas.getByText('Bruno').closest('a')).toHaveTextContent('Hoje14:00');
    expect(proximas.getByText('Carla')).toBeInTheDocument();

    const feedbacks = within(screen.getByRole('region', { name: 'Feedbacks pendentes' }));
    expect(feedbacks.getByText('João Silva')).toBeInTheDocument();
    expect(feedbacks.getByText('Alergia: sou alérgico a aveia.')).toBeInTheDocument();
  });

  it('mostra os estados vazios sem pendências nem consultas', async () => {
    mockarApi({
      [ROTAS.pacientes]: () => respostaJson(200, []),
      [ROTAS.feedbacks]: () => respostaJson(200, []),
      [ROTAS.consultas]: () => respostaJson(200, []),
    });

    renderizar();

    expect(await screen.findByText('Nenhum feedback pendente')).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma consulta agendada')).toBeInTheDocument();
    expect(within(indicador('Feedbacks pendentes')).getByText('0')).toBeInTheDocument();
  });

  it('uma falha na agenda não esconde o resto do painel', async () => {
    mockarApi({
      [ROTAS.pacientes]: () => respostaJson(200, [paciente()]),
      [ROTAS.feedbacks]: () => respostaJson(200, [doConsultorio()]),
      [ROTAS.consultas]: () => respostaJson(500, { code: 'ERRO', message: 'Falha ao carregar a agenda.' }),
    });

    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao carregar a agenda.');
    expect(within(indicador('Consultas hoje')).getByText('—')).toBeInTheDocument();
    expect(within(indicador('Pacientes ativos')).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Alergia: sou alérgico a aveia.')).toBeInTheDocument();
  });
});
