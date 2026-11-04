import { AddressInfo } from 'net';
import { Server } from 'http';
import express, { NextFunction, Request, Response } from 'express';

// Protege a fiação da rota (RF-07): `authorize('paciente')` e
// `ensurePatientScope` rodam de verdade; só o `authenticate` (JWT + banco) e o
// controller são trocados.
const mockGetContato = jest.fn((_req: Request, res: Response) => {
  res.status(200).json({ nome: 'Eridiane Kestring', whatsapp: '5547999990000' });
});

jest.mock('../../src/middlewares/authenticate', () => ({
  // O teste informa quem é o portador pelo cabeçalho, no lugar do JWT.
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.auth = JSON.parse(req.headers['x-test-auth'] as string);
    next();
  },
}));

jest.mock('../../src/modules/nutricionista/nutricionista.controller', () => ({
  NutricionistaController: jest.fn().mockImplementation(() => ({ getContato: mockGetContato })),
}));

import { patientNutricionistaRoutes } from '../../src/modules/nutricionista/patientNutricionista.routes';
import { errorHandler } from '../../src/middlewares/errorHandler';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const PACIENTE_ID = '33333333-3333-4333-8333-333333333333';
const OUTRO_PACIENTE_ID = '44444444-4444-4444-8444-444444444444';

const PACIENTE = { userId: PACIENTE_ID, tenantId: TENANT_ID, role: 'paciente' };
const NUTRICIONISTA = { userId: TENANT_ID, tenantId: TENANT_ID, role: 'nutricionista' };

let server: Server;
let baseUrl: string;

beforeAll((done) => {
  const app = express();
  app.use('/api/patients/:patientId/nutricionista', patientNutricionistaRoutes);
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
  mockGetContato.mockClear();
});

function buscarContato(patientId: string, auth: object) {
  return fetch(`${baseUrl}/api/patients/${patientId}/nutricionista`, {
    headers: { 'x-test-auth': JSON.stringify(auth) },
  });
}

describe('GET /api/patients/:patientId/nutricionista (RF-07)', () => {
  it('o paciente recebe o contato do próprio nutricionista', async () => {
    const res = await buscarContato(PACIENTE_ID, PACIENTE);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ nome: 'Eridiane Kestring', whatsapp: '5547999990000' });
  });

  it('o nutricionista recebe 403', async () => {
    const res = await buscarContato(PACIENTE_ID, NUTRICIONISTA);

    expect(res.status).toBe(403);
    expect(mockGetContato).not.toHaveBeenCalled();
  });

  it('um paciente não usa o id de outro paciente', async () => {
    const res = await buscarContato(OUTRO_PACIENTE_ID, PACIENTE);

    expect(res.status).toBe(403);
    expect(mockGetContato).not.toHaveBeenCalled();
  });
});
