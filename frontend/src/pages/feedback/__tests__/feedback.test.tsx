import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockarApi, renderizarEm, respostaJson, salvarSessaoDe } from '@/test/utils';
import { congelarRelogio } from '@/agenda/__tests__/fixtures';
import { doConsultorio, feedback, planoAtivo } from '@/feedback/__tests__/fixtures';
import { montarDescricao } from '@/feedback/feedbackApi';
import { CaixaDeFeedbacks } from '../CaixaDeFeedbacks';
import { MeusFeedbacks } from '../MeusFeedbacks';
import { ReportarProblema } from '../ReportarProblema';

const ROTA_PLANO = 'GET /api/patients/patient-1/meal-plans/ativo';
const ROTA_ENVIO = 'POST /api/patients/patient-1/feedbacks';

beforeEach(() => {
  congelarRelogio();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('montarDescricao', () => {
  it('põe o tipo no começo do relato, menos quando é "Outro"', () => {
    expect(montarDescricao('Alergia', '  sou alérgica a camarão ')).toBe('Alergia: sou alérgica a camarão');
    expect(montarDescricao('Outro', 'o jantar está muito tarde')).toBe('o jantar está muito tarde');
  });
});

describe('ReportarProblema (RF-06, fluxo 3.5 passos 1-2)', () => {
  beforeEach(() => salvarSessaoDe('paciente'));

  function renderizar(rota = '/feedback/novo') {
    return renderizarEm('/feedback/novo', <ReportarProblema />, rota, { '/feedback': 'Lista de feedbacks' });
  }

  it('envia refeição, tipo e descrição e leva à lista de feedbacks', async () => {
    const api = mockarApi({
      [ROTA_PLANO]: () => respostaJson(200, planoAtivo()),
      [ROTA_ENVIO]: () => respostaJson(201, feedback()),
    });

    renderizar();
    await userEvent.selectOptions(await screen.findByLabelText('Refeição'), 'meal-2');
    await userEvent.click(screen.getByRole('radio', { name: 'Alergia' }));
    await userEvent.type(screen.getByLabelText('Descrição'), 'Sou alérgica a camarão.');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para nutricionista' }));

    expect(await screen.findByText('Lista de feedbacks')).toBeInTheDocument();
    const envio = api.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(envio?.[1]?.body as string)).toEqual({
      descricao: 'Alergia: Sou alérgica a camarão.',
      meal_id: 'meal-2',
    });
  });

  it('chega com a refeição escolhida quando vem do botão da refeição', async () => {
    mockarApi({ [ROTA_PLANO]: () => respostaJson(200, planoAtivo()) });

    renderizar('/feedback/novo?refeicao=meal-2');

    expect(await screen.findByLabelText('Refeição')).toHaveValue('meal-2');
  });

  it('sem refeição escolhida, o relato vai sobre o plano em geral (sem meal_id)', async () => {
    const api = mockarApi({
      [ROTA_PLANO]: () => respostaJson(200, planoAtivo()),
      [ROTA_ENVIO]: () => respostaJson(201, feedback({ meal_id: null })),
    });

    renderizar();
    await userEvent.click(await screen.findByRole('radio', { name: 'Outro' }));
    await userEvent.type(screen.getByLabelText('Descrição'), 'Não consigo seguir os horários do plano.');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para nutricionista' }));

    await screen.findByText('Lista de feedbacks');
    const envio = api.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(envio?.[1]?.body as string)).toEqual({ descricao: 'Não consigo seguir os horários do plano.' });
  });

  it('pede o tipo e a descrição antes de enviar', async () => {
    const api = mockarApi({ [ROTA_PLANO]: () => respostaJson(200, planoAtivo()) });

    renderizar();
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar para nutricionista' }));

    expect(screen.getByText('Escolha o tipo de problema.')).toBeInTheDocument();
    expect(screen.getByText('Descreva a dificuldade.')).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toHaveAttribute('aria-invalid', 'true');
    expect(api.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('mostra no campo a recusa do backend (descrição curta demais)', async () => {
    mockarApi({
      [ROTA_PLANO]: () => respostaJson(200, planoAtivo()),
      [ROTA_ENVIO]: () =>
        respostaJson(400, {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          issues: [{ path: 'descricao', message: 'Descreva a dificuldade em 10 a 1000 caracteres' }],
        }),
    });

    renderizar();
    await userEvent.click(await screen.findByRole('radio', { name: 'Outro' }));
    await userEvent.type(screen.getByLabelText('Descrição'), 'ruim');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar para nutricionista' }));

    expect(await screen.findByText('Descreva a dificuldade em 10 a 1000 caracteres')).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toHaveFocus();
  });

  it('explica que é preciso ter um plano ativo para reportar', async () => {
    mockarApi({
      [ROTA_PLANO]: () =>
        respostaJson(404, { code: 'NOT_FOUND', message: 'Você ainda não tem um plano alimentar ativo' }),
    });

    renderizar();

    expect(await screen.findByText('Você ainda não tem um plano ativo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar para nutricionista' })).not.toBeInTheDocument();
  });
});

describe('MeusFeedbacks (RF-06, lado do paciente)', () => {
  beforeEach(() => salvarSessaoDe('paciente'));

  it('lista os relatos com o status e a resposta do nutricionista', async () => {
    mockarApi({
      'GET /api/patients/patient-1/feedbacks': () =>
        respostaJson(200, [
          feedback({ id: 'fb-2', meal_id: null, meal_nome: null, descricao: 'Outro relato pendente.' }),
          feedback({ status: 'resolvido', resposta: 'Troque por farelo de milho.' }),
        ]),
    });

    renderizarEm('/feedback', <MeusFeedbacks />, '/feedback');

    const relatos = await screen.findByRole('list', { name: 'Seus relatos' });
    const itens = within(relatos).getAllByRole('listitem');
    expect(within(itens[0]).getByText('Plano em geral')).toBeInTheDocument();
    expect(within(itens[0]).getByText('Aguardando resposta')).toBeInTheDocument();
    expect(within(itens[1]).getByText('Respondido')).toBeInTheDocument();
    expect(within(itens[1]).getByText('Troque por farelo de milho.')).toBeInTheDocument();
    expect(within(itens[1]).getByText('Enviado em 30/09/2026 às 14:30')).toBeInTheDocument();
  });

  it('mostra o estado vazio e o caminho para reportar', async () => {
    mockarApi({ 'GET /api/patients/patient-1/feedbacks': () => respostaJson(200, []) });

    renderizarEm('/feedback', <MeusFeedbacks />, '/feedback');

    expect(await screen.findByText('Nenhum relato ainda')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reportar problema' })).toHaveAttribute('href', '/feedback/novo');
  });
});

describe('CaixaDeFeedbacks (RF-06, fluxo 3.5 passos 5-6)', () => {
  beforeEach(() => salvarSessaoDe('nutricionista'));

  function renderizar() {
    return renderizarEm('/feedbacks', <CaixaDeFeedbacks />, '/feedbacks');
  }

  it('abre nos pendentes e sinaliza a notificação que falhou (E-17)', async () => {
    const api = mockarApi({
      'GET /api/feedbacks?status=pendente': () => respostaJson(200, [doConsultorio({ notificacao_falhou: true })]),
    });

    renderizar();

    expect(await screen.findByRole('link', { name: 'João Silva' })).toHaveAttribute('href', '/pacientes/patient-1');
    expect(screen.getByText('Notificação falhou')).toBeInTheDocument();
    expect(screen.getByText('Café da manhã · 30/09/2026 às 14:30')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ajustar plano' })).toHaveAttribute('href', '/pacientes/patient-1');
    expect(screen.getByRole('radio', { name: 'Pendentes' })).toBeChecked();
    expect(api).toHaveBeenCalledWith('/api/feedbacks?status=pendente', expect.anything());
  });

  it('resolve com a resposta ao paciente e recarrega a lista', async () => {
    let resolvido = false;
    const api = mockarApi({
      'GET /api/feedbacks?status=pendente': () => respostaJson(200, resolvido ? [] : [doConsultorio()]),
      'POST /api/feedbacks/fb-1/resolve': () => {
        resolvido = true;
        return respostaJson(200, feedback({ status: 'resolvido', resposta: 'Troque por farelo de milho.' }));
      },
    });

    renderizar();
    await userEvent.click(await screen.findByRole('button', { name: 'Responder e resolver' }));
    await userEvent.type(screen.getByLabelText('Resposta ao paciente (opcional)'), 'Troque por farelo de milho.');
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como resolvido' }));

    expect(await screen.findByText('Feedback de João Silva resolvido. O paciente será avisado.')).toBeInTheDocument();
    expect(await screen.findByText('Nenhum feedback pendente')).toBeInTheDocument();
    const post = api.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ resposta: 'Troque por farelo de milho.' });
  });

  it('mostra o conflito quando o feedback já tinha sido resolvido', async () => {
    mockarApi({
      'GET /api/feedbacks?status=pendente': () => respostaJson(200, [doConsultorio()]),
      'POST /api/feedbacks/fb-1/resolve': () =>
        respostaJson(409, { code: 'CONFLICT', message: 'Este feedback já foi resolvido' }),
    });

    renderizar();
    await userEvent.click(await screen.findByRole('button', { name: 'Responder e resolver' }));
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como resolvido' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este feedback já foi resolvido');
    expect(screen.getByRole('button', { name: 'Marcar como resolvido' })).toBeEnabled();
  });

  it('troca entre resolvidos e todos', async () => {
    const api = mockarApi({
      'GET /api/feedbacks?status=pendente': () => respostaJson(200, []),
      'GET /api/feedbacks?status=resolvido': () =>
        respostaJson(200, [doConsultorio({ status: 'resolvido', resposta: 'Ajustei o café.' })]),
      'GET /api/feedbacks': () => respostaJson(200, []),
    });

    renderizar();
    await screen.findByText('Nenhum feedback pendente');

    await userEvent.click(screen.getByRole('radio', { name: 'Resolvidos' }));
    expect(await screen.findByText('Ajustei o café.')).toBeInTheDocument();
    expect(screen.getByText('Resolvido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Responder e resolver' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Todos' }));
    expect(await screen.findByText('Nenhum feedback recebido')).toBeInTheDocument();
    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/feedbacks', expect.anything()));
  });
});
