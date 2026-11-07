import fs from 'fs';
import os from 'os';
import path from 'path';
import { AddressInfo } from 'net';
import { Server } from 'http';
import express from 'express';
import { servirFrontend } from '../../src/shared/http/servirFrontend';

describe('servirFrontend', () => {
  let pasta: string;
  let servidor: Server;
  let base: string;

  beforeAll(async () => {
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'nutrihub-front-'));
    fs.mkdirSync(path.join(pasta, 'assets'));
    fs.writeFileSync(path.join(pasta, 'index.html'), '<html>app</html>');
    fs.writeFileSync(path.join(pasta, 'sw.js'), 'self.x = 1;');
    fs.writeFileSync(path.join(pasta, 'manifest.webmanifest'), '{}');
    fs.writeFileSync(path.join(pasta, 'assets', 'index-abc123.js'), 'console.log(1);');

    const app = express();
    app.get('/api/ping', (_req, res) => {
      res.json({ ok: true });
    });
    servirFrontend(app, pasta);

    servidor = app.listen(0);
    await new Promise((resolve) => servidor.once('listening', resolve));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => servidor.close(resolve));
    fs.rmSync(pasta, { recursive: true, force: true });
  });

  it('continua respondendo a API normalmente', async () => {
    const resposta = await fetch(`${base}/api/ping`);
    expect(await resposta.json()).toEqual({ ok: true });
  });

  it('entrega o index.html nas rotas do React Router, sem cache', async () => {
    const resposta = await fetch(`${base}/pacientes/123`);
    expect(resposta.status).toBe(200);
    expect(await resposta.text()).toBe('<html>app</html>');
    expect(resposta.headers.get('cache-control')).toBe('no-cache');
    expect(resposta.headers.get('x-frame-options')).toBe('DENY');
  });

  it('não troca uma rota /api desconhecida pela página do app', async () => {
    const resposta = await fetch(`${base}/api/nao-existe`);
    expect(resposta.status).toBe(404);
    expect(await resposta.text()).not.toContain('<html>app</html>');
  });

  it('dá 404 para arquivo inexistente em vez de devolver o index.html', async () => {
    const resposta = await fetch(`${base}/assets/sumiu.js`);
    expect(resposta.status).toBe(404);
  });

  it('guarda em cache só os arquivos com hash de assets/', async () => {
    const asset = await fetch(`${base}/assets/index-abc123.js`);
    expect(asset.headers.get('cache-control')).toContain('immutable');

    const sw = await fetch(`${base}/sw.js`);
    expect(sw.headers.get('cache-control')).toBe('no-cache');
  });

  it('serve o manifesto do PWA com o tipo certo', async () => {
    const resposta = await fetch(`${base}/manifest.webmanifest`);
    expect(resposta.headers.get('content-type')).toContain('application/manifest+json');
  });

  it('não faz nada quando a pasta do build não existe (desenvolvimento)', () => {
    const app = express();
    const antes = app._router?.stack?.length ?? 0;
    servirFrontend(app, path.join(pasta, 'nao-existe'));
    expect(app._router?.stack?.length ?? 0).toBe(antes);
  });
});
