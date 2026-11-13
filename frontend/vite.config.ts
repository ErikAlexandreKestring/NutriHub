/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import type { Plugin } from 'vite';

// A fonte dos títulos só é descoberta depois que o CSS e o JS chegam, e a troca
// de fonte vira o "maior conteúdo" (LCP) da tela uns 300 ms depois da primeira
// pintura. O preload no <head> faz o download começar junto com o CSS.
// O nome do arquivo tem hash, então o link é montado no build.
function preloadDaFonteDosTitulos(): Plugin {
  return {
    name: 'preload-fonte-titulos',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const fonte = Object.keys(ctx.bundle ?? {}).find((nome) =>
          /plus-jakarta-sans-latin-700-normal-.*\.woff2$/.test(nome),
        );
        if (!fonte) return [];
        return [
          {
            tag: 'link',
            attrs: { rel: 'preload', href: `/${fonte}`, as: 'font', type: 'font/woff2', crossorigin: '' },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  // O Vite não injeta o `.env` em `process.env`; sem `loadEnv` o alvo do proxy
  // cairia sempre no fallback e o `.env.example` seria letra morta.
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [
      react(),
      preloadDaFonteDosTitulos(),
      // RNF-07: a aplicação precisa ser instalável como PWA. `autoUpdate` evita
      // que o paciente fique preso numa versão antiga do app em cache depois de
      // um deploy — o service worker troca sozinho no próximo carregamento.
      VitePWA({
        registerType: 'autoUpdate',
        // Sem isto, o registerSW.js entra no <head> sem defer e trava a primeira
        // pintura (cerca de 0,5 s em 4G, medido pelo Lighthouse em produção).
        injectRegister: 'script-defer',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Nutri-Hub',
          short_name: 'Nutri-Hub',
          description: 'Acompanhe seu plano alimentar e suas consultas.',
          lang: 'pt-BR',
          start_url: '/',
          display: 'standalone',
          background_color: '#F7F5F1',
          theme_color: '#171D29',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // As respostas da API carregam dados de saúde (RNF-03) e mudam a cada
          // consulta marcada; só o casco estático do app é pré-cacheado.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallbackDenylist: [/^\/api/],
        },
      }),
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 5173,
      // Em desenvolvimento o front chama /api no mesmo host e o Vite encaminha
      // para o Express, então não há CORS nem URL absoluta espalhada no código.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: false,
      // `npm run test:coverage` gera o lcov que o SonarCloud lê.
      coverage: {
        provider: 'v8',
        // Caminhos a partir da raiz do repositório (frontend/src/...), como no backend.
        reporter: ['text-summary', ['lcov', { projectRoot: '..' }]],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/__tests__/**', 'src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      },
    },
  };
});
