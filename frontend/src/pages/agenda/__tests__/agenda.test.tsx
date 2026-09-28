import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockarApi, renderizarEm, respostaJson, salvarSessaoDe } from '@/test/utils';
import {
  congelarRelogio,
  consulta,
  HORARIOS_LIVRES,
  intervalo,
  ROTA_HORARIOS_LIVRES,
} from '@/agenda/__tests__/fixtures';
import type { ConsultaDoConsultorio } from '@/agenda/tipos';
import { AgendaDoNutricionista } from '../AgendaDoNutricionista';
import { HorariosDeAtendimento } from '../HorariosDeAtendimento';

function doConsultorio(sobrescritas: Partial<ConsultaDoConsultorio> = {}): ConsultaDoConsultorio {
  return { ...consulta(), patient_nome: 'João Silva', ...sobrescritas };
}

beforeEach(() => {
  congelarRelogio();
  localStorage.clear();
  salvarSessaoDe('nutricionista');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AgendaDoNutricionista (RF-08/11/12)', () => {
  it('agrupa as consultas por dia com o paciente de cada uma', async () => {
    mockarApi({
      'GET /api/appointments': () =>
        respostaJson(200, [
          doConsultorio({ id: 'a1', data_hora: '2026-10-01T11:00:00.000Z' }),
          doConsultorio({ id: 'a2', data_hora: '2026-10-05T12:00:00.000Z', patient_id: 'p2', patient_nome: 'Maria' }),
        ]),
      'GET /api/availability': () => respostaJson(200, [intervalo()]),
    });

    renderizarEm('/agenda', <AgendaDoNutricionista />, '/agenda');

    const hoje = await screen.findByRole('region', { name: 'Quinta-feira, 1 de outubro' });
    expect(within(hoje).getByRole('link', { name: 'João Silva' })).toHaveAttribute('href', '/pacientes/patient-1');
    // A consulta das 08h de hoje já passou: fica visível, mas sem ações.
    expect(within(hoje).getByText('Horário já passou')).toBeInTheDocument();
    expect(within(hoje).queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();

    const segunda = screen.getByRole('region', { name: 'Segunda-feira, 5 de outubro' });
    expect(within(segunda).getByRole('link', { name: 'Maria' })).toHaveAttribute('href', '/pacientes/p2');
    expect(within(segunda).getByText('09:00')).toBeInTheDocument();
  });

  it('avisa que os pacientes não conseguem agendar sem grade cadastrada', async () => {
    mockarApi({
      'GET /api/appointments': () => respostaJson(200, []),
      'GET /api/availability': () => respostaJson(200, []),
    });

    renderizarEm('/agenda', <AgendaDoNutricionista />, '/agenda');

    expect(await screen.findByText(/seus pacientes não conseguem agendar/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastrar horários' })).toHaveAttribute('href', '/agenda/horarios');
    expect(screen.getByText('Nenhuma consulta agendada')).toBeInTheDocument();
  });

  it('remarca uma consulta para outro horário livre (fluxo 3.6, caminho B)', async () => {
    let remarcada = false;
    const api = mockarApi({
      'GET /api/appointments': () =>
        respostaJson(200, [doConsultorio({ data_hora: remarcada ? '2026-10-05T13:00:00.000Z' : consulta().data_hora })]),
      'GET /api/availability': () => respostaJson(200, [intervalo()]),
      [ROTA_HORARIOS_LIVRES]: () => respostaJson(200, HORARIOS_LIVRES),
      'POST /api/appointments/appt-1/reschedule': () => {
        remarcada = true;
        return respostaJson(200, consulta({ data_hora: '2026-10-05T13:00:00.000Z' }));
      },
    });

    renderizarEm('/agenda', <AgendaDoNutricionista />, '/agenda');
    await userEvent.click(await screen.findByRole('button', { name: 'Remarcar' }));
    await userEvent.click(await screen.findByRole('radio', { name: '10:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar novo horário' }));

    expect(await screen.findByText(/Consulta remarcada para segunda-feira, 5 de outubro de 2026/)).toBeInTheDocument();
    const post = api.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ data_hora: '2026-10-05T13:00:00.000Z' });
    await waitFor(() => expect(screen.getByRole('region', { name: 'Segunda-feira, 5 de outubro' })).toBeInTheDocument());
  });

  it('cancela depois de confirmar e tira a consulta da agenda', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let cancelada = false;
    mockarApi({
      'GET /api/appointments': () => respostaJson(200, cancelada ? [] : [doConsultorio()]),
      'GET /api/availability': () => respostaJson(200, [intervalo()]),
      'POST /api/appointments/appt-1/cancel': () => {
        cancelada = true;
        return respostaJson(200, consulta({ status: 'cancelado' }));
      },
    });

    renderizarEm('/agenda', <AgendaDoNutricionista />, '/agenda');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(confirmar).toHaveBeenCalledWith(expect.stringContaining('Cancelar a consulta de João Silva'));
    expect(await screen.findByText('Consulta de João Silva cancelada.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma consulta agendada')).toBeInTheDocument();
  });
});

describe('HorariosDeAtendimento (RF-08)', () => {
  it('mostra a semana a partir de segunda, com os dias sem atendimento', async () => {
    mockarApi({
      'GET /api/availability': () =>
        respostaJson(200, [intervalo(), intervalo({ id: 'av-2', start_time: '14:00:00', end_time: '18:00:00' })]),
    });

    renderizarEm('/agenda/horarios', <HorariosDeAtendimento />, '/agenda/horarios');

    expect(await screen.findByText('08:00–12:00')).toBeInTheDocument();
    expect(screen.getByText('14:00–18:00')).toBeInTheDocument();
    expect(screen.getAllByText('Sem atendimento')).toHaveLength(6);
    const dias = screen.getAllByRole('term').map((dia) => dia.textContent);
    expect(dias[0]).toBe('Segunda-feira');
    expect(dias[6]).toBe('Domingo');
  });

  it('adiciona um intervalo enviando o dia como número', async () => {
    let grade = [intervalo()];
    const api = mockarApi({
      'GET /api/availability': () => respostaJson(200, grade),
      'POST /api/availability': (corpo) => {
        grade = [...grade, intervalo({ id: 'av-2', day_of_week: 3, start_time: '13:00:00', end_time: '17:00:00' })];
        return respostaJson(201, corpo);
      },
    });

    renderizarEm('/agenda/horarios', <HorariosDeAtendimento />, '/agenda/horarios');
    await screen.findByText('08:00–12:00');

    await userEvent.selectOptions(screen.getByLabelText('Dia da semana'), 'Quarta-feira');
    await userEvent.type(screen.getByLabelText('Início'), '13:00');
    await userEvent.type(screen.getByLabelText('Fim'), '17:00');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('13:00–17:00')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Horário de quarta-feira, 13:00–17:00, adicionado.');
    const post = api.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ day_of_week: 3, start_time: '13:00', end_time: '17:00' });
    // O dia continua escolhido para cadastrar o próximo intervalo.
    expect(screen.getByLabelText('Dia da semana')).toHaveValue('3');
    expect(screen.getByLabelText('Início')).toHaveValue('');
  });

  it('mostra o erro do backend no campo e foca nele', async () => {
    mockarApi({
      'GET /api/availability': () => respostaJson(200, []),
      'POST /api/availability': () =>
        respostaJson(400, {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          issues: [{ path: 'end_time', message: 'Horário final deve ser depois do horário inicial' }],
        }),
    });

    renderizarEm('/agenda/horarios', <HorariosDeAtendimento />, '/agenda/horarios');
    await screen.findAllByText('Sem atendimento');
    await userEvent.type(screen.getByLabelText('Início'), '12:00');
    await userEvent.type(screen.getByLabelText('Fim'), '08:00');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText('Horário final deve ser depois do horário inicial')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Fim')).toHaveFocus());
  });

  it('remove um intervalo depois de confirmar', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let grade = [intervalo()];
    mockarApi({
      'GET /api/availability': () => respostaJson(200, grade),
      'DELETE /api/availability/av-1': () => {
        grade = [];
        return new Response(null, { status: 204 });
      },
    });

    renderizarEm('/agenda/horarios', <HorariosDeAtendimento />, '/agenda/horarios');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover segunda-feira 08:00–12:00' }));

    expect(confirmar).toHaveBeenCalledWith(expect.stringContaining('Consultas já marcadas nesse horário continuam valendo'));
    await waitFor(() => expect(screen.getAllByText('Sem atendimento')).toHaveLength(7));
  });
});
