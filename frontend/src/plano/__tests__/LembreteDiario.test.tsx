import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockarApi, respostaJson } from '@/test/utils';
import { LembreteDiario } from '../LembreteDiario';

const URL = '/api/patients/patient-1/lembrete';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LembreteDiario (RF-07)', () => {
  it('mostra a chave ligada quando o lembrete está ativo', async () => {
    mockarApi({ [`GET ${URL}`]: () => respostaJson(200, { ativo: true }) });

    render(<LembreteDiario patientId="patient-1" />);

    const chave = await screen.findByRole('switch', { name: 'Lembrete diário por e-mail' });
    expect(chave).toHaveAttribute('aria-checked', 'true');
  });

  it('desliga com um toque e manda ativo=false', async () => {
    const api = mockarApi({
      [`GET ${URL}`]: () => respostaJson(200, { ativo: true }),
      [`PUT ${URL}`]: (corpo) => respostaJson(200, corpo),
    });

    render(<LembreteDiario patientId="patient-1" />);
    await userEvent.click(await screen.findByRole('switch'));

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    const put = api.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(put?.[1]?.body as string)).toEqual({ ativo: false });
  });

  it('volta atrás e avisa quando o servidor não salva', async () => {
    mockarApi({
      [`GET ${URL}`]: () => respostaJson(200, { ativo: false }),
      [`PUT ${URL}`]: () => respostaJson(500, { message: 'Erro interno' }),
    });

    render(<LembreteDiario patientId="patient-1" />);
    await userEvent.click(await screen.findByRole('switch'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('não aparece quando a preferência não carrega', async () => {
    const api = mockarApi({ [`GET ${URL}`]: () => respostaJson(500, { message: 'Erro interno' }) });

    render(<LembreteDiario patientId="patient-1" />);

    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
