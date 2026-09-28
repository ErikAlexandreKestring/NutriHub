import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockarApi, renderizarEm, respostaJson, salvarSessaoDe } from '@/test/utils';
import {
  congelarRelogio,
  consulta,
  HORARIOS_LIVRES,
  ROTA_HORARIOS_LIVRES,
} from '@/agenda/__tests__/fixtures';
import { MinhasConsultas } from '../MinhasConsultas';

const ROTA_CONSULTAS = 'GET /api/patients/patient-1/appointments';

beforeEach(() => {
  congelarRelogio();
  localStorage.clear();
  salvarSessaoDe('paciente');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderizar() {
  return renderizarEm('/minhas-consultas', <MinhasConsultas />, '/minhas-consultas');
}

describe('MinhasConsultas (RF-08/11/12)', () => {
  it('separa as próximas consultas das anteriores e canceladas', async () => {
    mockarApi({
      [ROTA_CONSULTAS]: () =>
        respostaJson(200, [
          consulta({ id: 'c3', data_hora: '2026-10-08T13:00:00.000Z', status: 'cancelado' }),
          consulta({ id: 'c2', data_hora: '2026-10-03T13:00:00.000Z' }),
          consulta({ id: 'c1', data_hora: '2026-09-20T13:00:00.000Z' }),
        ]),
    });

    renderizar();

    const proximas = await screen.findByRole('region', { name: 'Próximas consultas' });
    expect(within(proximas).getAllByRole('listitem')).toHaveLength(1);
    expect(within(proximas).getByText(/3 de outubro de 2026/)).toBeInTheDocument();
    expect(screen.getByText('Consultas anteriores e canceladas (2)')).toBeInTheDocument();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
  });

  it('agenda num horário livre escolhendo dia e hora (fluxo 3.4)', async () => {
    let agendada = false;
    const api = mockarApi({
      [ROTA_CONSULTAS]: () =>
        respostaJson(200, agendada ? [consulta({ id: 'nova', data_hora: '2026-10-06T12:00:00.000Z' })] : []),
      [ROTA_HORARIOS_LIVRES]: () => respostaJson(200, HORARIOS_LIVRES),
      'POST /api/patients/patient-1/appointments': () => {
        agendada = true;
        return respostaJson(201, consulta({ id: 'nova', data_hora: '2026-10-06T12:00:00.000Z' }));
      },
    });

    renderizar();
    expect(await screen.findByText('Nenhuma consulta marcada')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Agendar consulta' }));
    // O primeiro dia com horário já vem marcado.
    expect(await screen.findByRole('radio', { name: 'Segunda-feira, 5 de outubro' })).toBeChecked();
    expect(screen.getAllByRole('radio', { name: /^\d\d:\d\d$/ })).toHaveLength(2);

    await userEvent.click(screen.getByRole('radio', { name: 'Terça-feira, 6 de outubro' }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar agendamento' });
    expect(confirmar).toBeDisabled();

    await userEvent.click(screen.getByRole('radio', { name: '09:00' }));
    await userEvent.click(confirmar);

    expect(await screen.findByText(/Consulta agendada para terça-feira, 6 de outubro de 2026/)).toBeInTheDocument();
    const post = api.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ data_hora: '2026-10-06T12:00:00.000Z' });
    expect(screen.queryByRole('button', { name: 'Confirmar agendamento' })).not.toBeInTheDocument();
  });

  it('mostra o conflito (E-12) e recarrega os horários livres', async () => {
    let buscas = 0;
    mockarApi({
      [ROTA_CONSULTAS]: () => respostaJson(200, []),
      [ROTA_HORARIOS_LIVRES]: () => {
        buscas += 1;
        return respostaJson(200, buscas === 1 ? HORARIOS_LIVRES : HORARIOS_LIVRES.slice(1));
      },
      'POST /api/patients/patient-1/appointments': () =>
        respostaJson(409, {
          code: 'E-12',
          message: 'Este horário já está ocupado. Por favor, selecione outro horário disponível.',
        }),
    });

    renderizar();
    await userEvent.click(await screen.findByRole('button', { name: 'Agendar consulta' }));
    await userEvent.click(await screen.findByRole('radio', { name: '09:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este horário já está ocupado');
    // O horário tomado some da lista.
    await vi.waitFor(() => expect(screen.queryByRole('radio', { name: '09:00' })).not.toBeInTheDocument());
    expect(screen.getByRole('radio', { name: '10:00' })).not.toBeChecked();
  });

  it('avisa quando não há horário livre nas próximas duas semanas', async () => {
    mockarApi({
      [ROTA_CONSULTAS]: () => respostaJson(200, []),
      [ROTA_HORARIOS_LIVRES]: () => respostaJson(200, []),
    });

    renderizar();
    await userEvent.click(await screen.findByRole('button', { name: 'Agendar consulta' }));

    expect(await screen.findByText('Nenhum horário livre nas próximas duas semanas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar agendamento' })).not.toBeInTheDocument();
  });

  it('mostra a recusa de cancelamento fora da antecedência mínima (E-19)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockarApi({
      [ROTA_CONSULTAS]: () => respostaJson(200, [consulta()]),
      'POST /api/appointments/appt-1/cancel': () =>
        respostaJson(400, {
          code: 'E-19',
          message:
            'O prazo para cancelamento desta consulta já encerrou. Entre em contato diretamente com o nutricionista.',
        }),
    });

    renderizar();
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('O prazo para cancelamento desta consulta já encerrou');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  });
});
