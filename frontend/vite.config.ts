/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // O Vite não injeta o `.env` em `process.env`; sem `loadEnv` o alvo do proxy
  // cairia sempre no fallback e o `.env.example` seria letra morta.
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [
      react(),
      // RNF-07: a aplicação precisa ser instalável como PWA. `autoUpdate` evita
      // que o paciente fique preso numa versão antiga do app em cache depois de
      // um deploy — o service worker troca sozinho no próximo carregamento.
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Nutri-Hub',
          short_name: 'Nutri-Hub',
          description: 'Acompanhe seu plano alimentar e suas consultas.',
          lang: 'pt-BR',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#15803d',
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
    },
  };
});
