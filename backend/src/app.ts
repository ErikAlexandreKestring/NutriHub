import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { authRoutes } from './modules/auth/auth.routes';
import { errorHandler } from './middlewares/errorHandler';

export function createApp(): Express {
  const app = express();

  // HTTPS em trânsito é garantido pelo Azure (Static Web Apps / App Service
  // forçam SSL por padrão — RFC seção 6.3). CORS é necessário porque o
  // frontend (Static Web Apps) e a API (App Service) vão ficar em origens
  // diferentes; ajuste CORS_ORIGIN quando o domínio do frontend existir.
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);

  // Próximos módulos entram aqui conforme forem implementados:
  // app.use('/api/patients', patientRoutes);   // RF-03
  // app.use('/api/meal-plans', mealPlanRoutes); // RF-04, RF-05
  // app.use('/api/agenda', agendaRoutes);       // RF-08 a RF-12

  app.use(errorHandler);

  return app;
}
