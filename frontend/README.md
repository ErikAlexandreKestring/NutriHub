# Nutri-Hub — Frontend

PWA do Nutri-Hub: interface do paciente e painel do nutricionista.

Stack definida na RFC (seção 5.5): React 18, Vite 5, TypeScript 5 e Tailwind CSS 3.

## Rodando localmente

O frontend consome a API do `backend/`, que precisa estar no ar:

```bash
cd ../backend && npm run dev     # sobe a API em http://localhost:3000
cd ../frontend && npm install && npm run dev
```

O Vite serve em `http://localhost:5173` e encaminha `/api` para o backend
(`VITE_API_PROXY_TARGET`, veja `.env.example`), então não há CORS em
desenvolvimento nem URL de API espalhada pelo código.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento com HMR |
| `npm run build` | Checagem de tipos + build de produção (gera o service worker) |
| `npm run preview` | Serve o build — use para testar a instalação do PWA |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## Estado atual

Esta é a base do projeto: ferramental, PWA, estilos e componentes de interface.
As telas chegam nas entregas seguintes, uma por requisito.

A aplicação é instalável como PWA e responsiva a partir de 360px (RNF-07). Os
componentes base já seguem o RNF-08: alvo de toque de 44x44px, foco visível,
contraste AA e mensagens de erro associadas ao campo via `aria-describedby`.

## Deploy

`staticwebapp.config.json` configura o Azure Static Web Apps: fallback de
navegação para `/index.html` (a aplicação é uma SPA com rotas no cliente) e
`no-cache` no service worker, para que um deploy novo não fique preso atrás do
`sw.js` antigo em cache.
