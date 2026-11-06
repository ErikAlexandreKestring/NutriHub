import fs from 'fs';
import path from 'path';
import express, { Express, NextFunction, Request, Response } from 'express';

/**
 * Onde o deploy coloca o build do frontend: `backend/public`, ao lado de
 * `dist/` (ver .github/workflows/deploy-azure.yml). Em desenvolvimento a pasta
 * não existe e quem serve o front é o Vite.
 */
export const PASTA_DO_FRONTEND = path.resolve(__dirname, '../../../../public');

/**
 * Em produção o mesmo App Service entrega a API e o PWA, no mesmo endereço.
 * A RFC previa o Azure Static Web Apps para o front, mas a assinatura Azure for
 * Students só permite regiões onde o SWA não existe. Mesma origem também
 * dispensa CORS: o front continua chamando `/api` como no proxy do Vite.
 *
 * Precisa ser registrado depois das rotas da API e antes do errorHandler.
 */
export function servirFrontend(app: Express, pasta: string = PASTA_DO_FRONTEND): void {
  const indexHtml = path.join(pasta, 'index.html');
  if (!fs.existsSync(indexHtml)) return;

  // Os mesmos cabeçalhos que o staticwebapp.config.json definia.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(
    express.static(pasta, {
      index: false,
      setHeaders(res, arquivo) {
        // Arquivos de assets/ têm hash no nome: um deploy novo gera nomes novos,
        // então podem ficar em cache para sempre. O resto (index.html, sw.js,
        // manifest) precisa ser conferido a cada visita, senão o PWA não
        // percebe que saiu versão nova.
        const emAssets = path.relative(pasta, arquivo).split(path.sep)[0] === 'assets';
        res.setHeader('Cache-Control', emAssets ? 'public, max-age=31536000, immutable' : 'no-cache');
        if (arquivo.endsWith('.webmanifest')) res.type('application/manifest+json');
      },
    }),
  );

  // Rotas do React Router (/pacientes/123, /avaliar...) não são arquivos: o
  // navegador recebe o index.html e o roteador do front resolve. Rotas /api
  // desconhecidas seguem para o 404 da API, e não para a página do app.
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/') || req.path === '/api' || path.extname(req.path) !== '') return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}
