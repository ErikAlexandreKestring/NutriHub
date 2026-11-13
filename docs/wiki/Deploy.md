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

## Monitoramento

- **Disponibilidade:** UptimeRobot testa o `/health` a cada 5 minutos. Página pública: https://stats.uptimerobot.com/oyd8DCaAIF
- **Qualidade:** SonarCloud a cada pull request e merge.
- **Auditoria:** eventos de segurança e de negócio em `audit_logs`.
