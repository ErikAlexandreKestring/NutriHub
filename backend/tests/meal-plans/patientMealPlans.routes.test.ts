import { AddressInfo } from 'net';
import { Server } from 'http';
import express, { NextFunction, Request, Response } from 'express';

// Os testes do service cobrem a regra; estes protegem a FIAÇÃO da rota de
// conclusão (UC-03): `authorize('paciente')` e `ensurePatientScope` rodam de
// verdade. Só o `authenticate` (JWT + banco) e o controller são trocados.
const mockCompleteMeal = jest.fn((_req: Request, res: Response) => {
  res.status(204).send();
});
const mockUncompleteMeal = jest.fn((_req: Request, res: Response) => {
  res.status(204).send();
});

jest.mock('../../src/middlewares/authenticate', () => ({
  // O teste informa quem é o portador pelo cabeçalho, no lugar do JWT.
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.auth = JSON.parse(req.headers['x-test-auth'] as string);
    next();
  },
}));

jest.mock('../../src/modules/meal-plans/mealPlans.controller', () => ({
  MealPlansController: jest.fn().mockImplementation(() => ({
    completeMeal: mockCompleteMeal,
    uncompleteMeal: mockUncompleteMeal,
    getActiveForPatient: jest.fn(),
    createDraft: jest.fn(),
    listByPatient: jest.fn(),
  })),
}));

import { patientMealPlansRoutes } from '../../src/modules/meal-plans/patientMealPlans.routes';
import { errorHandler } from '../../src/middlewares/errorHandler';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const PACIENTE_ID = '33333333-3333-4333-8333-333333333333';
const OUTRO_PACIENTE_ID = '44444444-4444-4444-8444-444444444444';
const MEAL_ID = '55555555-5555-4555-8555-555555555555';

const PACIENTE = { userId: PACIENTE_ID, tenantId: TENANT_ID, role: 'paciente' };
const NUTRICIONISTA = { userId: TENANT_ID, tenantId: TENANT_ID, role: 'nutricionista' };

let server: Server;
let baseUrl: string;

beforeAll((done) => {
  const app = express();
  app.use('/api/patients/:patientId/meal-plans', patientMealPlansRoutes);
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
  mockCompleteMeal.mockClear();
  mockUncompleteMeal.mockClear();
});

function conclusao(method: 'PUT' | 'DELETE', patientId: string, auth: object) {
  return fetch(`${baseUrl}/api/patients/${patientId}/meal-plans/ativo/meals/${MEAL_ID}/conclusao`, {
    method,
    headers: { 'x-test-auth': JSON.stringify(auth) },
  });
}

describe('Rotas de conclusão de refeição (UC-03)', () => {
  it.each(['PUT', 'DELETE'] as const)('%s: o paciente marca/desmarca a própria refeição', async (method) => {
    const res = await conclusao(method, PACIENTE_ID, PACIENTE);

    expect(res.status).toBe(204);
    const handler = method === 'PUT' ? mockCompleteMeal : mockUncompleteMeal;
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it.each(['PUT', 'DELETE'] as const)('%s: o nutricionista recebe 403 e não marca pelo paciente', async (method) => {
    const res = await conclusao(method, PACIENTE_ID, NUTRICIONISTA);

    expect(res.status).toBe(403);
    expect(mockCompleteMeal).not.toHaveBeenCalled();
    expect(mockUncompleteMeal).not.toHaveBeenCalled();
  });

  it.each(['PUT', 'DELETE'] as const)('%s: um paciente não marca a refeição de outro paciente', async (method) => {
    const res = await conclusao(method, OUTRO_PACIENTE_ID, PACIENTE);

    expect(res.status).toBe(403);
    expect(mockCompleteMeal).not.toHaveBeenCalled();
    expect(mockUncompleteMeal).not.toHaveBeenCalled();
  });
});
