import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { authRoutes } from './modules/auth/auth.routes';
import { patientsRoutes } from './modules/patients/patients.routes';
import { foodsRoutes } from './modules/foods/foods.routes';
import { mealPlansRoutes } from './modules/meal-plans/mealPlans.routes';
import { patientMealPlansRoutes } from './modules/meal-plans/patientMealPlans.routes';
import { availabilityRoutes } from './modules/availability/availability.routes';
import { appointmentsRoutes } from './modules/appointments/appointments.routes';
import { patientAppointmentsRoutes } from './modules/appointments/patientAppointments.routes';
import { errorHandler } from './middlewares/errorHandler';

export function createApp(): Express {
  const app = express();

  // HTTPS em trânsito é garantido pelo Azure (Static Web Apps / App Service
  // forçam SSL por padrão — RFC seção 6.3). CORS é necessário porque o
  // frontend (Static Web Apps) e a API (App Service) vão ficar em origens
  // diferentes; ajuste CORS_ORIGIN quando o domínio do frontend existir.
  // O bloqueio de login (E-04) conta tentativas por (e-mail, IP do cliente), e
  // atrás do App Service o IP real só chega via X-Forwarded-For — sem isto todo
  // mundo cairia no mesmo balde e o bloqueio voltaria a ser por e-mail puro,
  // que é justamente o que permitia trancar a conta alheia. Um salto (o próprio
  // App Service); fora de produção não há proxy, e confiar no cabeçalho ali
  // deixaria qualquer cliente forjar a própria origem.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/patients', patientsRoutes);
  app.use('/api/patients/:patientId/meal-plans', patientMealPlansRoutes);
  app.use('/api/meal-plans', mealPlansRoutes);
  app.use('/api/foods', foodsRoutes);
  app.use('/api/availability', availabilityRoutes);
  app.use('/api/patients/:patientId/appointments', patientAppointmentsRoutes);
  app.use('/api/appointments', appointmentsRoutes);

  app.use(errorHandler);

  return app;
}
