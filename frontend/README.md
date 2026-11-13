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

## Telas

- **Paciente:**
  - Meu plano;
  - Minhas consultas (agendar, remarcar e cancelar);
  - feedback e NPS.
- **Nutricionista:**
  - painel;
  - pacientes;
  - construtor de planos;
  - agenda e disponibilidade;
  - feedbacks e NPS.
- **Entrada:**
  - login e cadastro;
  - confirmação de e-mail e recuperação de senha;
  - primeiro acesso do paciente.

A aplicação é instalável como PWA e responsiva a partir de 360 px (RNF-07). Os componentes seguem o RNF-08:
- área de toque de 44 x 44 px;
- foco visível;
- contraste AA;
- mensagens de erro associadas ao campo via `aria-describedby`.

A medição com o Lighthouse está em [`docs/lighthouse`](../docs/lighthouse/RESULTADO.md).

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

Em produção, o build (`dist/`) é copiado para `backend/public` e servido pela própria API, no mesmo endereço do `/api`. Por isso não há CORS nem URL de API configurada no frontend. O passo a passo está em [`docs/DEPLOY.md`](../docs/DEPLOY.md).
