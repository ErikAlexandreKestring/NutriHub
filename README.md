# Nutri-Hub

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=ErikAlexandreKestring_NutriHub&metric=alert_status)](https://sonarcloud.io/summary/overall?id=ErikAlexandreKestring_NutriHub)
[![Cobertura](https://sonarcloud.io/api/project_badges/measure?project=ErikAlexandreKestring_NutriHub&metric=coverage)](https://sonarcloud.io/summary/overall?id=ErikAlexandreKestring_NutriHub)
[![Confiabilidade](https://sonarcloud.io/api/project_badges/measure?project=ErikAlexandreKestring_NutriHub&metric=reliability_rating)](https://sonarcloud.io/summary/overall?id=ErikAlexandreKestring_NutriHub)
[![Segurança](https://sonarcloud.io/api/project_badges/measure?project=ErikAlexandreKestring_NutriHub&metric=security_rating)](https://sonarcloud.io/summary/overall?id=ErikAlexandreKestring_NutriHub)
[![Manutenibilidade](https://sonarcloud.io/api/project_badges/measure?project=ErikAlexandreKestring_NutriHub&metric=sqale_rating)](https://sonarcloud.io/summary/overall?id=ErikAlexandreKestring_NutriHub)
[![Backend CI](https://github.com/ErikAlexandreKestring/NutriHub/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/ErikAlexandreKestring/NutriHub/actions/workflows/backend-ci.yml)
[![Frontend CI](https://github.com/ErikAlexandreKestring/NutriHub/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/ErikAlexandreKestring/NutriHub/actions/workflows/frontend-ci.yml)

Plataforma SaaS multi-tenant para nutricionistas. Cada nutricionista tem o próprio consultório isolado, com estas funções:
- cadastrar pacientes;
- montar planos alimentares com a tabela TACO;
- organizar a agenda;
- acompanhar o retorno dos pacientes.

O paciente usa um app instalável no celular (PWA) para:
- ver o plano do dia e marcar as refeições feitas;
- agendar, remarcar e cancelar consultas;
- registrar dificuldades com a dieta.

Trabalho de Conclusão de Curso de Erik Alexandre Kestring. A especificação completa está no [RFC](docs/RFC_Nutri-hub.pdf). As decisões que mudaram durante a implementação estão em [Mudanças em relação ao RFC](docs/MUDANCAS_EM_RELACAO_AO_RFC.md).

**Endereço:** https://appnutrihub.com.br · **Disponibilidade:** [status no UptimeRobot](https://stats.uptimerobot.com/oyd8DCaAIF)

## Funcionalidades

| Requisito | O que faz |
|---|---|
| RF-01 | Cadastro do nutricionista com CRN, confirmação de e-mail e criação automática do consultório (tenant) |
| RF-02 | Login de nutricionista e paciente com JWT: 8 h para o nutricionista e 24 h para o paciente. Também tem recuperação de senha |
| RF-03 | Pacientes: cadastrar, editar, listar, inativar e reativar, com histórico e convite de primeiro acesso por e-mail |
| RF-04 | Construtor de plano alimentar com a base TACO e cálculo automático de calorias, carboidratos, proteínas e gorduras. Os planos podem ser rascunho, publicados ou copiados |
| RF-05 | Meu plano: o paciente vê as refeições do dia, as metas e as orientações, e marca o que já comeu |
| RF-06 | Feedback do paciente (alergia, falta de ingrediente etc.), com aviso ao nutricionista em até 30 s |
| RF-07 | Notificações por e-mail: novo plano disponível, lembrete diário das refeições não marcadas e alerta de feedback. O WhatsApp é por link direto, veja as [mudanças](docs/MUDANCAS_EM_RELACAO_AO_RFC.md) |
| RF-08 | Grade de disponibilidade do nutricionista por dia da semana e horário |
| RF-09 | Pesquisa NPS ao fim do ciclo do plano, no máximo uma vez por trimestre, consolidada no painel |
| RF-10 | Painel do nutricionista: pacientes ativos, feedbacks pendentes e próximas consultas |
| RF-11 | Cancelamento de consulta com a antecedência mínima configurada pelo nutricionista |
| RF-12 | Remarcação de consulta dentro da grade, com aviso às duas partes |

## Requisitos de qualidade e evidências

| Requisito | Como é atendido | Evidência |
|---|---|---|
| RNF-01: isolamento entre consultórios | Row-Level Security no PostgreSQL. A API usa um papel sem privilégio, e cada requisição roda com o `tenant_id` do token | Testes de integração contra um Postgres de verdade ([`tenantIsolation.test.ts`](backend/tests/integration/tenantIsolation.test.ts)) |
| RNF-02: senhas | bcrypt com custo 12 | Testes do módulo de autenticação ([`password.test.ts`](backend/tests/auth/password.test.ts)) |
| RNF-03: LGPD | Dados de saúde criptografados com AES-256-GCM. O nutricionista pode excluir os dados do paciente a pedido dele | [`sensitiveData.ts`](backend/src/shared/utils/sensitiveData.ts) e [`patientData.test.ts`](backend/tests/integration/patientData.test.ts) |
| RNF-04: plano em menos de 2 s em 4G | Compressão gzip, esqueleto de carregamento e o plano pedido em paralelo com o JavaScript | [Lighthouse em produção](docs/lighthouse/RESULTADO.md): tela em **1,7 s** e plano completo em **2,2 s** no 4G lento do Lighthouse, desempenho 98 |
| RNF-05: uptime de 99,9% | App Service com Always On | [Página pública do UptimeRobot](https://stats.uptimerobot.com/oyd8DCaAIF), que testa o `/health` a cada 5 minutos |
| RNF-06: escalabilidade | Monolito modular sem estado, com o banco gerenciado | [Teste de carga com o k6](docs/teste-de-carga/RESULTADO.md): aprovado, com p95 de 177 ms e 0% de erro |
| RNF-07: 360 px e PWA | Layout para celular primeiro, manifesto e service worker | [Lighthouse](docs/lighthouse/RESULTADO.md): PWA aprovado e 21 telas sem rolagem horizontal |
| RNF-08: acessibilidade | Contraste AA, foco visível e área de toque de 44 x 44 px | [Lighthouse](docs/lighthouse/RESULTADO.md): acessibilidade 100 |
| RNF-09: agenda em tempo real | A API valida a grade, os conflitos e os horários passados no momento do agendamento | Testes de integração de [agenda](backend/tests/integration/appointments.test.ts) e [disponibilidade](backend/tests/integration/availability.test.ts) |
| RNF-10: auditoria | Login, plano, agendamento e cancelamento registrados em `audit_logs` com data e hora, usuário e IP | Testes do módulo de auditoria |

**Qualidade do código:** a cada PR, rodam o lint, a checagem de tipos e os testes do backend e do frontend no GitHub Actions. O [SonarCloud](https://sonarcloud.io/summary/overall?id=ErikAlexandreKestring_NutriHub) analisa bugs, vulnerabilidades, duplicação e cobertura de testes, que está acima de 90%.

## Arquitetura

Os diagramas C4 (contexto, contêiner e componente) estão em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

O backend é um **monolito modular**: uma única API Express, com um módulo por domínio em `backend/src/modules`, como auth, patients, meal-plans, appointments e notifications. Todos os módulos compartilham o mesmo processo e o mesmo banco.

Em produção, um único **Azure App Service** entrega a API (`/api`) e o PWA compilado no mesmo endereço, e o banco é um **Azure Database for PostgreSQL**. O worker de notificações roda no mesmo processo da API.

```
Celular / navegador ──HTTPS──> App Service (Node 22)
                                ├── /api   → Express (módulos + worker de notificações)
                                └── /      → PWA (React, build do Vite)
                                         │
                                         ├──> PostgreSQL 16 (RLS por tenant)
                                         └──> SMTP (e-mails)
```

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind CSS 3, PWA (vite-plugin-pwa) |
| Backend | Node.js 22, Express 4, TypeScript 5, Knex 3, jsonwebtoken 9, bcrypt 5, Nodemailer |
| Banco | PostgreSQL 16 com Row-Level Security |
| Testes | Jest (backend), Vitest e Testing Library (frontend), k6 (carga), Lighthouse |
| Infra | Azure App Service e Azure Database for PostgreSQL (região Chile Central), GitHub Actions, SonarCloud, UptimeRobot |

## Rodando localmente

É preciso ter o **Node.js 22** e o **Docker**.

```bash
# 1. Banco
docker compose up -d

# 2. API (http://localhost:3000)
cd backend
cp .env.example .env
npm install
npm run migrate
npm run seed        # tabela TACO
npm run dev

# 3. PWA (http://localhost:5173), em outro terminal
cd frontend
npm install
npm run dev
```

Em desenvolvimento, os e-mails não são enviados: o conteúdo aparece no terminal da API (`EMAIL_TRANSPORT=console`). Os links de confirmação de cadastro e de primeiro acesso do paciente são pegos de lá.

**Primeiro uso:**
1. Cadastre um nutricionista em `/cadastro`.
2. Confirme o e-mail pelo link no terminal.
3. Cadastre um paciente e use o link de primeiro acesso para entrar como ele.

## Testes

```bash
cd backend
npm test                     # testes unitários
npm run test:integration     # integração contra o Postgres do docker compose (RLS, agenda...)
npm run test:coverage        # unitários com cobertura

cd frontend
npm test                     # Vitest
npm run test:coverage        # com cobertura
```

O teste de carga (k6) está em [`backend/carga`](backend/carga/README.md), e o resultado em [`docs/teste-de-carga`](docs/teste-de-carga/RESULTADO.md).

## Estrutura

```
backend/
  src/modules/      um módulo por domínio (rotas, controller, service, repository)
  src/db/           migrations do Knex e seed da TACO
  src/shared/       JWT, criptografia, validação, erros, envio do frontend
  tests/            unitários; tests/integration contra o Postgres
  carga/            teste de carga com o k6
frontend/
  src/pages/        telas do paciente e do nutricionista
  src/lib/api.ts    único ponto de acesso à API
docs/               RFC, deploy, mudanças e resultados (carga, Lighthouse e SonarCloud), em Markdown e PDF
.github/workflows/  CI, SonarCloud e deploy na Azure
```

## Documentação

- [RFC](docs/RFC_Nutri-hub.pdf): requisitos, arquitetura e regras de negócio.
- [Arquitetura (diagramas C4)](docs/ARQUITETURA.md): contexto, contêineres e componentes.
- [Wiki](https://github.com/ErikAlexandreKestring/NutriHub/wiki): requisitos, user stories, arquitetura, deploy e testes.
- [Mudanças em relação ao RFC](docs/MUDANCAS_EM_RELACAO_AO_RFC.md).
- [Deploy na Azure](docs/DEPLOY.md), passo a passo.
- [Resultado do teste de carga](docs/teste-de-carga/RESULTADO.md) (RNF-06).
- [Resultado do Lighthouse](docs/lighthouse/RESULTADO.md) (RNF-04, RNF-07 e RNF-08).
- [Resultado do SonarCloud](docs/sonarcloud/RESULTADO.md) (qualidade do código).
- [Frontend](frontend/README.md): sessão, autenticação e PWA.
