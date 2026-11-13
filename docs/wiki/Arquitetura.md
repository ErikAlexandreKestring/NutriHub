# Arquitetura do Nutri-Hub (modelo C4)

Versão para leitura na Wiki; a fonte versionada fica em `docs/ARQUITETURA.md`. Os diagramas seguem o [modelo C4](https://c4model.com), em três níveis: contexto, contêiner e componente. Estão em Mermaid, então o GitHub os desenha direto no navegador e a fonte fica versionada junto com o código.

Eles mostram o sistema **como foi implementado**. O RFC (seção 5) previa o frontend no Azure Static Web Apps, que não existe nas regiões permitidas pela assinatura. Os motivos estão em [Mudanças em relação ao RFC](Decisoes-de-engenharia).

## Nível 1: contexto

Quem usa o sistema e com o que ele conversa.

```mermaid
flowchart TB
    nutri(["<b>Nutricionista</b><br/>Gerencia pacientes, planos<br/>e agenda do consultório"])
    paciente(["<b>Paciente</b><br/>Vê o plano do dia, agenda<br/>consultas e envia feedback"])

    sistema["<b>Nutri-Hub</b><br/>Plataforma SaaS multi-tenant<br/>para nutricionistas"]

    smtp[["<b>Servidor SMTP (Gmail)</b><br/>Envia os e-mails do sistema"]]
    whats[["<b>WhatsApp</b><br/>Contato por link direto (wa.me),<br/>sem integração por API"]]
    uptime[["<b>UptimeRobot</b><br/>Mede a disponibilidade"]]
    insights[["<b>Azure Application Insights</b><br/>Logs, métricas e exceções da API"]]

    nutri -- "Usa pelo navegador (HTTPS)" --> sistema
    paciente -- "Usa o app instalável (PWA, HTTPS)" --> sistema
    sistema -- "Envia e-mails (SMTP)" --> smtp
    smtp -. "Entrega os avisos" .-> nutri
    smtp -. "Entrega os avisos" .-> paciente
    paciente -- "Abre a conversa pelo link" --> whats
    uptime -- "GET /health a cada 5 min" --> sistema
    sistema -- "Envia telemetria (HTTPS)" --> insights
```

## Nível 2: contêineres

Os blocos que rodam e o que cada um guarda ou executa. A API, o worker de notificações e o PWA compilado saem do **mesmo processo Node**, no mesmo endereço, e por isso não há CORS.

```mermaid
flowchart TB
    nutri(["Nutricionista"])
    paciente(["Paciente"])

    subgraph azure["Azure, região Chile Central"]
        subgraph app["Azure App Service (Linux, Node 22, plano B1)"]
            pwa["<b>PWA</b><br/>React 18, Vite, TypeScript, Tailwind<br/>Build estático servido pelo Express<br/>Service worker para uso instalável"]
            api["<b>API REST</b><br/>Express 4, TypeScript, Knex<br/>Rotas em /api, JWT, validação,<br/>regras de negócio, auditoria"]
            worker["<b>Worker de notificações</b><br/>Mesmo processo da API<br/>Fila em banco, novas tentativas<br/>e lembrete diário às 19:00"]
        end
        db[("<b>PostgreSQL 16</b><br/>Azure Database for PostgreSQL<br/>Row-Level Security por tenant<br/>Dados de saúde cifrados (AES-256-GCM)")]
    end

    smtp[["SMTP (Gmail)"]]
    insights[["Azure Application Insights<br/>Painel de métricas, falhas e logs"]]

    nutri -- "HTTPS" --> pwa
    paciente -- "HTTPS" --> pwa
    pwa -- "JSON via /api<br/>(Bearer JWT)" --> api
    api -- "SQL com o papel nutrihub_app<br/>e app.current_tenant na sessão" --> db
    worker -- "Lê e grava notifications" --> db
    worker -- "SMTP" --> smtp
    api -. "Telemetria: requisições, consultas,<br/>exceções e logs" .-> insights
```

Decisões que aparecem no diagrama:

| Decisão | Motivo |
|---|---|
| Monolito modular em vez de microsserviços | Um desenvolvedor e um domínio só. Os módulos têm fronteiras claras e podem ser separados depois |
| Isolamento por RLS no banco | O isolamento entre consultórios vale mesmo que a aplicação erre uma consulta (RNF-01) |
| A API conecta com um papel sem privilégio de dono | Um papel dono das tabelas ignoraria o RLS |
| Application Insights no próprio processo | Observabilidade sem montar Prometheus e Grafana. Plano gratuito, e a API segue funcionando se o coletor estiver desligado |
| Worker no mesmo processo | Evita um segundo serviço pago. A fila fica no banco, então um reinício não perde envios |
| PWA servido pela API | Sem CORS e sem Static Web Apps, que não existe nas regiões permitidas |

## Nível 3: componentes da API

Cada módulo de `backend/src/modules` segue as mesmas camadas: rotas, controller, service, repository e validação.

```mermaid
flowchart TB
    cliente(["PWA"])

    subgraph api["API REST (Express)"]
        direction TB
        mw["<b>Middlewares</b><br/>authenticate, authorize,<br/>errorHandler"]

        subgraph mods["Módulos de domínio (backend/src/modules)"]
            direction LR
            auth["auth<br/>login, cadastro,<br/>recuperação de senha"]
            pacientes["patients<br/>pacientes e convite"]
            planos["meal-plans<br/>plano e macros"]
            foods["foods<br/>tabela TACO"]
            agenda["appointments +<br/>availability<br/>agenda"]
            fb["feedbacks + nps<br/>retorno do paciente"]
            lembretes["meal-reminders<br/>lembrete diário"]
            audit["audit<br/>auditoria"]
        end

        notif["<b>notifications</b><br/>fila, worker e transporte de e-mail"]
        shared["<b>shared</b><br/>JWT, bcrypt, criptografia,<br/>validação, AppError"]
    end

    db[("PostgreSQL<br/>com RLS")]
    smtp[["SMTP"]]

    cliente --> mw --> mods
    mods --> shared
    mods -- "Knex, uma transação<br/>por requisição" --> db
    fb --> notif
    planos --> notif
    agenda --> notif
    lembretes --> notif
    notif --> db
    notif --> smtp
    auth --> audit
    agenda --> audit
    planos --> audit
```

## Camadas dentro de um módulo

```mermaid
flowchart LR
    rota["routes<br/>caminho e perfil exigido"] --> ctrl["controller<br/>HTTP: lê e responde"]
    ctrl --> val["validation<br/>formato da entrada"]
    ctrl --> svc["service<br/>regras de negócio"]
    svc --> repo["repository<br/>SQL com Knex"]
    repo --> bd[("PostgreSQL")]
```

O controller não conhece SQL, o repository não conhece HTTP, e as regras de negócio ficam só no service. É isso que permite testar o service com o repository simulado (testes unitários) e o conjunto contra um Postgres de verdade (testes de integração).
