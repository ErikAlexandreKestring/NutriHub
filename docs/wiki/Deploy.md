# Deploy

O passo a passo completo, com todos os comandos, está em [docs/DEPLOY.md](https://github.com/ErikAlexandreKestring/NutriHub/blob/main/docs/DEPLOY.md). Esta página resume.

## Onde roda

| Parte | Serviço | Plano |
|---|---|---|
| PWA, API e worker de notificações | Azure App Service (Linux, Node 22) | B1, Always On |
| Banco | Azure Database for PostgreSQL, Flexible Server | Burstable B1ms, 32 GB |
| E-mail | SMTP do Gmail | Gratuito |
| Domínio | `appnutrihub.com.br` (DNS no registro.br), com HTTPS gerenciado | |

Tudo fica na região Chile Central, a mais barata entre as que a assinatura Azure for Students permite na América do Sul.

## Como o deploy acontece

O deploy é automático, por GitHub Actions (`.github/workflows/deploy-azure.yml`), a cada merge na `main`:

1. Instala as dependências e compila o frontend e o backend.
2. Empacota o build.
3. Publica o pacote no App Service.

As migrations são rodadas à parte, por quem tem a senha de administrador do banco (veja o passo 3 de [docs/DEPLOY.md](https://github.com/ErikAlexandreKestring/NutriHub/blob/main/docs/DEPLOY.md)).

Não há deploy manual por SSH ou FTP. A aplicação conecta no banco com o papel `nutrihub_app`, sem privilégio de dono, para que o RLS valha. A senha do administrador fica só com quem roda as migrations.

## Variáveis de ambiente

O modelo está em `backend/.env.example`. Em produção ficam nas configurações do App Service e nos secrets do GitHub, nunca no repositório. Entre elas: URL do banco, segredo do JWT, chave de criptografia dos dados de saúde e credenciais do SMTP.

## Rodando localmente

Precisa de Node.js 22 e Docker.

```bash
docker compose up -d                 # PostgreSQL

cd backend
cp .env.example .env
npm install
npm run migrate
npm run seed                         # tabela TACO
npm run dev                          # http://localhost:3000

cd ../frontend                       # em outro terminal
npm install
npm run dev                          # http://localhost:5173
```

Em desenvolvimento, os e-mails aparecem no terminal da API (`EMAIL_TRANSPORT=console`).

## Monitoramento e observabilidade

| O que | Ferramenta | O que mostra |
|---|---|---|
| Disponibilidade | UptimeRobot | Testa o `/health` a cada 5 minutos. Página pública: https://stats.uptimerobot.com/oyd8DCaAIF |
| Logs, métricas e exceções | Azure Application Insights | Requisições e latência por rota, tempo das consultas ao PostgreSQL, taxa de erro, exceções, CPU e memória, e o log da API |
| Qualidade do código | SonarCloud | Bugs, vulnerabilidades e cobertura a cada PR e merge |
| Auditoria | Tabela `audit_logs` | Login, plano, agendamento e cancelamento, com usuário, IP e data |

O Application Insights roda dentro do processo da API e só liga quando existe a variável `APPLICATIONINSIGHTS_CONNECTION_STRING`. Em desenvolvimento e nos testes ela não existe e nada é enviado. O 500 tratado pelo `errorHandler` também é registrado como exceção. A criação do recurso e da variável está na seção 7.1 de [docs/DEPLOY.md](https://github.com/ErikAlexandreKestring/NutriHub/blob/main/docs/DEPLOY.md).

Consulta de exemplo (KQL, em *Monitoring → Logs*), com o p95 por rota:

```
requests
| summarize chamadas = count(), p95_ms = percentile(duration, 95), falhas = countif(success == false) by name
| order by chamadas desc
```
