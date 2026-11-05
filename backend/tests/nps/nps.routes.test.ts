import { AddressInfo } from 'net';
import { Server } from 'http';
import express, { NextFunction, Request, Response } from 'express';

// O service está coberto à parte; aqui se testa a FIAÇÃO das rotas: quem
// responde a pesquisa é só o próprio paciente, e o consolidado é só do
// nutricionista. `authenticate` (JWT + banco) e o controller são trocados.
const mockPendente = jest.fn((_req: Request, res: Response) => {
  res.status(200).json({ pesquisa: null });
});
const mockResponder = jest.fn((_req: Request, res: Response) => {
  res.status(200).json({});
});
const mockResumo = jest.fn((_req: Request, res: Response) => {
  res.status(200).json({});
});

jest.mock('../../src/middlewares/authenticate', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.auth = JSON.parse(req.headers['x-test-auth'] as string);
    next();
  },
}));

jest.mock('../../src/modules/nps/nps.controller', () => ({
  NpsController: jest.fn().mockImplementation(() => ({
    pendente: mockPendente,
    responder: mockResponder,
    resumo: mockResumo,
  })),
}));

import { patientNpsRoutes } from '../../src/modules/nps/patientNps.routes';
import { npsRoutes } from '../../src/modules/nps/nps.routes';
import { errorHandler } from '../../src/middlewares/errorHandler';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const PACIENTE_ID = '33333333-3333-4333-8333-333333333333';
const OUTRO_PACIENTE_ID = '44444444-4444-4444-8444-444444444444';
const PESQUISA_ID = '55555555-5555-4555-8555-555555555555';

const PACIENTE = { userId: PACIENTE_ID, tenantId: TENANT_ID, role: 'paciente' };
const NUTRICIONISTA = { userId: TENANT_ID, tenantId: TENANT_ID, role: 'nutricionista' };

let server: Server;
let baseUrl: string;

beforeAll((done) => {
  const app = express();
  app.use(express.json());
  app.use('/api/patients/:patientId/nps', patientNpsRoutes);
  app.use('/api/nps', npsRoutes);
  app.use(errorHandler);
  server = app.listen(0, () => {
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

beforeEach(() => {
  mockPendente.mockClear();
  mockResponder.mockClear();
  mockResumo.mockClear();
});

function chamar(method: string, caminho: string, auth: object) {
  return fetch(`${baseUrl}${caminho}`, {
    method,
    headers: { 'x-test-auth': JSON.stringify(auth), 'content-type': 'application/json' },
    body: method === 'POST' ? JSON.stringify({ nota: 9 }) : undefined,
  });
}

describe('Rotas do NPS (RF-09, UC-07)', () => {
  it('o paciente consulta e responde a própria pesquisa', async () => {
    const pendente = await chamar('GET', `/api/patients/${PACIENTE_ID}/nps/pendente`, PACIENTE);
    const resposta = await chamar('POST', `/api/patients/${PACIENTE_ID}/nps/${PESQUISA_ID}/resposta`, PACIENTE);

    expect(pendente.status).toBe(200);
    expect(resposta.status).toBe(200);
    expect(mockPendente).toHaveBeenCalledTimes(1);
    expect(mockResponder).toHaveBeenCalledTimes(1);
  });

  it('o paciente não alcança a pesquisa de outro paciente', async () => {
    const pendente = await chamar('GET', `/api/patients/${OUTRO_PACIENTE_ID}/nps/pendente`, PACIENTE);
    const resposta = await chamar('POST', `/api/patients/${OUTRO_PACIENTE_ID}/nps/${PESQUISA_ID}/resposta`, PACIENTE);

    expect(pendente.status).toBe(403);
    expect(resposta.status).toBe(403);
    expect(mockPendente).not.toHaveBeenCalled();
    expect(mockResponder).not.toHaveBeenCalled();
  });

  it('o nutricionista não responde nem abre a pesquisa pelo paciente', async () => {
    const pendente = await chamar('GET', `/api/patients/${PACIENTE_ID}/nps/pendente`, NUTRICIONISTA);
    const resposta = await chamar('POST', `/api/patients/${PACIENTE_ID}/nps/${PESQUISA_ID}/resposta`, NUTRICIONISTA);

    expect(pendente.status).toBe(403);
    expect(resposta.status).toBe(403);
    expect(mockResponder).not.toHaveBeenCalled();
  });

  it('o consolidado é do nutricionista, não do paciente', async () => {
    const doNutricionista = await chamar('GET', '/api/nps', NUTRICIONISTA);
    const doPaciente = await chamar('GET', '/api/nps', PACIENTE);

    expect(doNutricionista.status).toBe(200);
    expect(doPaciente.status).toBe(403);
    expect(mockResumo).toHaveBeenCalledTimes(1);
  });
});
