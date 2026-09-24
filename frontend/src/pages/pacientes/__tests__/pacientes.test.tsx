import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockarApi, renderizarEm, respostaJson, salvarSessaoDe } from '@/test/utils';
import type { Paciente } from '@/pacientes/tipos';
import { DetalheDoPaciente } from '../DetalheDoPaciente';
import { EditarPaciente } from '../EditarPaciente';
import { ListaDePacientes } from '../ListaDePacientes';
import { NovoPaciente } from '../NovoPaciente';

function paciente(sobrescritas: Partial<Paciente> = {}): Paciente {
  return {
    id: 'p1',
    nome: 'João Silva',
    email: 'joao@nutrihub.com',
    data_nascimento: '1990-05-20',
    contato: null,
    historico: null,
    status: 'ativo',
    acesso_liberado: false,
    created_at: '2026-09-01T12:00:00.000Z',
    updated_at: '2026-09-01T12:00:00.000Z',
    ...sobrescritas,
  };
}

beforeEach(() => {
  localStorage.clear();
  salvarSessaoDe('nutricionista');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ListaDePacientes (RF-03)', () => {
  const pacientes = [
    paciente(),
    paciente({ id: 'p2', nome: 'Maria Souza', email: 'maria@x.com', acesso_liberado: true }),
    paciente({ id: 'p3', nome: 'Pedro Inativo', email: 'pedro@x.com', status: 'inativo' }),
  ];

  it('esconde inativos por padrão e mostra quem ainda não tem acesso ao app', async () => {
    mockarApi({ 'GET /api/patients': () => respostaJson(200, pacientes) });

    renderizarEm('/pacientes', <ListaDePacientes />, '/pacientes');

    expect(await screen.findByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
    expect(screen.queryByText('Pedro Inativo')).not.toBeInTheDocument();
    // Só o João ainda não fez o primeiro acesso.
    expect(screen.getAllByText('Sem acesso ao app')).toHaveLength(1);

    await userEvent.click(screen.getByLabelText('Mostrar inativos (1)'));
    expect(screen.getByText('Pedro Inativo')).toBeInTheDocument();
  });

  it('filtra por nome ignorando acentos', async () => {
    mockarApi({ 'GET /api/patients': () => respostaJson(200, pacientes) });

    renderizarEm('/pacientes', <ListaDePacientes />, '/pacientes');
    await screen.findByText('João Silva');

    await userEvent.type(screen.getByLabelText('Buscar por nome ou e-mail'), 'joao');

    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.queryByText('Maria Souza')).not.toBeInTheDocument();
  });

  it('orienta o cadastro quando a carteira está vazia', async () => {
    mockarApi({ 'GET /api/patients': () => respostaJson(200, []) });

    renderizarEm('/pacientes', <ListaDePacientes />, '/pacientes');

    expect(await screen.findByText('Nenhum paciente cadastrado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Novo paciente' })).toHaveAttribute('href', '/pacientes/novo');
  });
});

describe('NovoPaciente (RF-03)', () => {
  it('cadastra e leva à ficha do paciente com o próximo passo indicado', async () => {
    const api = mockarApi({
      'POST /api/patients': () => respostaJson(201, paciente({ id: 'p9' })),
    });

    renderizarEm('/pacientes/novo', <NovoPaciente />, '/pacientes/novo', { '/pacientes/:id': 'Ficha do paciente' });

    await userEvent.type(screen.getByLabelText('Nome completo'), 'João Silva');
    await userEvent.type(screen.getByLabelText('E-mail'), 'joao@nutrihub.com');
    await userEvent.type(screen.getByLabelText('Data de nascimento'), '1990-05-20');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar paciente' }));

    expect(await screen.findByText('Ficha do paciente')).toBeInTheDocument();
    const corpo = JSON.parse(api.mock.calls[0][1]?.body as string);
    expect(corpo).toMatchObject({ nome: 'João Silva', email: 'joao@nutrihub.com', data_nascimento: '1990-05-20' });
  });

  it('mostra o erro do backend no campo que o causou e foca nele', async () => {
    mockarApi({
      'POST /api/patients': () =>
        respostaJson(400, {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          issues: [{ path: 'data_nascimento', message: 'Data de nascimento inválida' }],
        }),
    });

    renderizarEm('/pacientes/novo', <NovoPaciente />, '/pacientes/novo');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar paciente' }));

    expect(await screen.findByText('Data de nascimento inválida')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Data de nascimento')).toHaveFocus());
  });

  it('mostra o conflito de e-mail já cadastrado', async () => {
    mockarApi({
      'POST /api/patients': () => respostaJson(409, { code: 'CONFLICT', message: 'E-mail já cadastrado' }),
    });

    renderizarEm('/pacientes/novo', <NovoPaciente />, '/pacientes/novo');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar paciente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail já cadastrado');
  });
});

describe('EditarPaciente (RF-03)', () => {
  // Apagar o contato precisa virar "sem contato", não string vazia gravada.
  it('envia campo opcional apagado como null', async () => {
    const api = mockarApi({
      'GET /api/patients/p1': () => respostaJson(200, paciente({ contato: '47999998888' })),
      'PUT /api/patients/p1': () => respostaJson(200, paciente()),
    });

    renderizarEm('/pacientes/:id/editar', <EditarPaciente />, '/pacientes/p1/editar', {
      '/pacientes/:id': 'Ficha do paciente',
    });

    const contato = await screen.findByLabelText('Contato (opcional)');
    expect(contato).toHaveValue('47999998888');
    await userEvent.clear(contato);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Ficha do paciente')).toBeInTheDocument();
    const put = api.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(put?.[1]?.body as string)).toMatchObject({ contato: null, historico: null });
  });
});

describe('DetalheDoPaciente (RF-03, RF-02)', () => {
  it('gera o link de primeiro acesso com o token no fragmento da URL', async () => {
    mockarApi({
      'GET /api/patients/p1': () => respostaJson(200, paciente()),
      'POST /api/patients/p1/access-token': () =>
        respostaJson(201, { patient_id: 'p1', token: 'a'.repeat(64), expira_em: '2026-09-27T12:00:00.000Z' }),
    });

    renderizarEm('/pacientes/:id', <DetalheDoPaciente />, '/pacientes/p1');
    await userEvent.click(await screen.findByRole('button', { name: 'Gerar link de primeiro acesso' }));

    const link = await screen.findByLabelText('Link de acesso');
    expect(link).toHaveValue(`${window.location.origin}/primeiro-acesso#${'a'.repeat(64)}`);
  });

  it('oferece redefinição de senha a quem já tem acesso', async () => {
    mockarApi({
      'GET /api/patients/p1': () => respostaJson(200, paciente({ acesso_liberado: true })),
    });

    renderizarEm('/pacientes/:id', <DetalheDoPaciente />, '/pacientes/p1');

    expect(await screen.findByRole('button', { name: 'Gerar link para redefinir senha' })).toBeInTheDocument();
  });

  it('inativa após confirmação e esconde as ações que não valem para inativos', async () => {
    mockarApi({
      'GET /api/patients/p1': () => respostaJson(200, paciente()),
      'DELETE /api/patients/p1': () => respostaJson(200, paciente({ status: 'inativo' })),
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderizarEm('/pacientes/:id', <DetalheDoPaciente />, '/pacientes/p1');
    await userEvent.click(await screen.findByRole('button', { name: 'Inativar' }));

    expect(await screen.findByText('Inativo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inativar' })).not.toBeInTheDocument();
    expect(screen.queryByText('Acesso ao app')).not.toBeInTheDocument();
  });

  it('mostra a data de nascimento sem deslocar o dia pelo fuso', async () => {
    mockarApi({
      'GET /api/patients/p1': () => respostaJson(200, paciente({ data_nascimento: '1990-01-01' })),
    });

    renderizarEm('/pacientes/:id', <DetalheDoPaciente />, '/pacientes/p1');

    expect(await screen.findByText('01/01/1990')).toBeInTheDocument();
  });
});
