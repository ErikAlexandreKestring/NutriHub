import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockarApi, renderizarEm, respostaJson, salvarSessaoDe } from '@/test/utils';
import { pesquisaAberta, RESUMO_VAZIO, resumoNps } from '@/nps/__tests__/fixtures';
import { MeusFeedbacks } from '@/pages/feedback/MeusFeedbacks';
import { Avaliacoes } from '../Avaliacoes';
import { Avaliar } from '../Avaliar';

const PENDENTE = 'GET /api/patients/patient-1/nps/pendente';
const RESPOSTA = 'POST /api/patients/patient-1/nps/nps-1/resposta';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Avaliar (UC-07)', () => {
  beforeEach(() => salvarSessaoDe('paciente'));

  function renderizar() {
    return renderizarEm('/avaliar', <Avaliar />, '/avaliar');
  }

  it('envia a nota e o comentário e agradece', async () => {
    const usuario = userEvent.setup();
    const api = mockarApi({
      [PENDENTE]: () => respostaJson(200, { pesquisa: pesquisaAberta() }),
      [RESPOSTA]: (corpo) => respostaJson(200, { ...pesquisaAberta(), ...(corpo as object) }),
    });

    renderizar();
    await usuario.click(await screen.findByRole('radio', { name: 'Nota 9' }));
    await usuario.type(screen.getByLabelText('Comentário (opcional)'), '  Gostei muito  ');
    await usuario.click(screen.getByRole('button', { name: 'Enviar avaliação' }));

    expect(await screen.findByText('Obrigado pela avaliação!')).toBeInTheDocument();
    const [, init] = api.mock.calls.find(([, i]) => i?.method === 'POST')!;
    expect(JSON.parse(init!.body as string)).toEqual({ nota: 9, comentario: 'Gostei muito' });
  });

  it('não manda comentário vazio', async () => {
    const usuario = userEvent.setup();
    const api = mockarApi({
      [PENDENTE]: () => respostaJson(200, { pesquisa: pesquisaAberta() }),
      [RESPOSTA]: () => respostaJson(200, pesquisaAberta({ nota: 0 })),
    });

    renderizar();
    await usuario.click(await screen.findByRole('radio', { name: 'Nota 0' }));
    await usuario.click(screen.getByRole('button', { name: 'Enviar avaliação' }));

    await screen.findByText('Obrigado pela avaliação!');
    const [, init] = api.mock.calls.find(([, i]) => i?.method === 'POST')!;
    expect(JSON.parse(init!.body as string)).toEqual({ nota: 0 });
  });

  it('pede a nota antes de enviar', async () => {
    const usuario = userEvent.setup();
    const api = mockarApi({ [PENDENTE]: () => respostaJson(200, { pesquisa: pesquisaAberta() }) });

    renderizar();
    await usuario.click(await screen.findByRole('button', { name: 'Enviar avaliação' }));

    expect(screen.getByText('Escolha uma nota de 0 a 10.')).toBeInTheDocument();
    expect(api.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(false);
  });

  it('mostra a mensagem do servidor quando a pesquisa já foi respondida', async () => {
    const usuario = userEvent.setup();
    mockarApi({
      [PENDENTE]: () => respostaJson(200, { pesquisa: pesquisaAberta() }),
      [RESPOSTA]: () =>
        respostaJson(409, { code: 'CONFLICT', message: 'Esta pesquisa já foi respondida. Obrigado!' }),
    });

    renderizar();
    await usuario.click(await screen.findByRole('radio', { name: 'Nota 5' }));
    await usuario.click(screen.getByRole('button', { name: 'Enviar avaliação' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Esta pesquisa já foi respondida. Obrigado!');
  });

  it('sem pesquisa em aberto, explica quando ela chega', async () => {
    mockarApi({ [PENDENTE]: () => respostaJson(200, { pesquisa: null }) });

    renderizar();

    expect(await screen.findByText('Nenhuma avaliação pendente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar avaliação' })).not.toBeInTheDocument();
  });
});

describe('Convite na aba Feedback (UC-07)', () => {
  beforeEach(() => salvarSessaoDe('paciente'));

  it('aparece quando há pesquisa em aberto e leva à avaliação', async () => {
    mockarApi({
      'GET /api/patients/patient-1/feedbacks': () => respostaJson(200, []),
      [PENDENTE]: () => respostaJson(200, { pesquisa: pesquisaAberta() }),
    });

    renderizarEm('/feedback', <MeusFeedbacks />, '/feedback');

    expect(await screen.findByRole('link', { name: 'Avaliar' })).toHaveAttribute('href', '/avaliar');
  });

  it('some sem pesquisa e também quando a busca falha', async () => {
    mockarApi({
      'GET /api/patients/patient-1/feedbacks': () => respostaJson(200, []),
      [PENDENTE]: () => respostaJson(500, { code: 'ERRO', message: 'Falha' }),
    });

    renderizarEm('/feedback', <MeusFeedbacks />, '/feedback');

    await screen.findByText('Nenhum relato ainda');
    expect(screen.queryByRole('link', { name: 'Avaliar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Avaliacoes (RF-09, nutricionista)', () => {
  beforeEach(() => salvarSessaoDe('nutricionista'));

  it('mostra o índice, a distribuição e as respostas com a categoria de cada nota', async () => {
    mockarApi({ 'GET /api/nps': () => respostaJson(200, resumoNps()) });

    renderizarEm('/avaliacoes', <Avaliacoes />, '/avaliacoes');

    expect(await screen.findByText('+25')).toBeInTheDocument();
    expect(screen.getByText(/4 respostas de 5 pesquisas enviadas/)).toHaveTextContent('taxa de resposta 80%');

    const distribuicao = within(screen.getByRole('list', { name: 'Distribuição das notas' }));
    expect(distribuicao.getByText('2 (50%)')).toBeInTheDocument();

    const respostas = within(screen.getByRole('region', { name: 'Respostas recentes' }));
    const joao = respostas.getByText('João Silva').closest('li')!;
    expect(within(joao).getByText('Promotor')).toBeInTheDocument();
    expect(within(joao).getByText('Plano fácil de seguir.')).toBeInTheDocument();
    expect(within(respostas.getByText('Maria Souza').closest('li')!).getByText('Detrator')).toBeInTheDocument();
  });

  it('sem respostas, mostra o traço no índice e explica quando a pesquisa sai', async () => {
    mockarApi({ 'GET /api/nps': () => respostaJson(200, RESUMO_VAZIO) });

    renderizarEm('/avaliacoes', <Avaliacoes />, '/avaliacoes');

    expect(await screen.findByText('Nenhuma avaliação ainda')).toBeInTheDocument();
    expect(screen.getByText('Ainda sem respostas')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Distribuição das notas' })).not.toBeInTheDocument();
  });
});
