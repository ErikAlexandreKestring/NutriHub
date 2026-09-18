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

Base do projeto (ferramental, PWA, estilos e componentes) e o login do RF-02.
As demais telas chegam nas entregas seguintes, uma por requisito.

A aplicação é instalável como PWA e responsiva a partir de 360px (RNF-07). Os
componentes base já seguem o RNF-08: alvo de toque de 44x44px, foco visível,
contraste AA e mensagens de erro associadas ao campo via `aria-describedby`.

## Autenticação e sessão

`lib/api.ts` é o único ponto que fala com a API: prefixa `/api`, injeta o
`Bearer` e traduz o corpo de erro do backend (`{ code, message, issues }`) em
`ErroDaApi`. Um 401 em rota autenticada avisa os inscritos em `aoExpirarSessao`,
e o `SessaoProvider` derruba a sessão a partir daí — nenhuma tela precisa tratar
expiração por conta própria. Um 401 em rota pública (senha errada, E-04) não
conta como expiração, senão a própria tela de login se derrubaria.

O token fica em `localStorage` porque o backend emite um Bearer JWT sem refresh
e sem cookie `httpOnly`, e a RNF-07 pede um PWA que o paciente fecha e reabre.
Isso deixa o token exposto a XSS; trocar por cookie `httpOnly` é mudança no
backend. O `exp` do JWT é lido no boot (sem verificar assinatura — quem valida é
o servidor) para não restaurar uma sessão já morta.

`RotaProtegida` espelha no cliente o que o `authorize()` garante no servidor. É
navegação, não segurança: a autoridade continua sendo o backend, já que o JWT do
paciente carrega o mesmo `tenant_id` do nutricionista.

## Deploy

`public/staticwebapp.config.json` configura o Azure Static Web Apps: fallback de
navegação para `/index.html` (a aplicação é uma SPA com rotas no cliente) e
`no-cache` no service worker, para que um deploy novo não fique preso atrás do
`sw.js` antigo em cache. Ele fica em `public/` porque o Azure só lê o arquivo
na raiz da pasta publicada (`dist/`), e é de lá que o Vite copia.
