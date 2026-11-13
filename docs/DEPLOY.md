# Deploy na Azure

Como o Nutri-Hub fica no ar:

| Parte | Serviço | Plano |
|---|---|---|
| Frontend (PWA) e backend (API e worker de notificações) | Azure App Service (Linux, Node 22) | B1 |
| Banco | Azure Database for PostgreSQL, Flexible Server | Burstable B1ms, 32 GB |
| E-mail | SMTP do Gmail (`nutrihub.avisos@gmail.com`) | Gratuito, cerca de 500 e-mails por dia |
| Domínio | `appnutrihub.com.br`, com o DNS no registro.br | R$ 40 por ano |

Tudo fica na região **`chilecentral`** (Chile Central).

**Por que o Chile.** A assinatura Azure for Students só permite criar recursos em `brazilsouth`, `chilecentral`, `belgiumcentral`, `northcentralus` e `spaincentral`. Entre as duas regiões da América do Sul, o Chile sai mais barato no total. Preço de tabela em novembro de 2026, em US$ por mês, com tudo ligado:

| Item | Brasil | Chile |
|---|---|---|
| App Service B1 | 14,60 | 17,40 |
| Postgres B1ms | 25,50 | 17,40 |
| Disco do Postgres (32 GB) | 7,00 | 5,20 |
| **Total** | **~47** | **~40** |

Para os usuários no Brasil, cada requisição demora uns 50 ms a mais. Isso fica muito abaixo dos limites do RNF-04 e do teste de carga.

**Por que não o Static Web Apps do RFC.** O Static Web Apps não existe em nenhuma das regiões permitidas. Por isso, o App Service também serve o build do frontend (`backend/src/shared/http/servirFrontend.ts`). Com o frontend e a API no mesmo endereço, não é preciso CORS: o frontend chama `/api`, como faz com o proxy do Vite em desenvolvimento.

**RLS em produção.** A aplicação conecta no banco com o papel `nutrihub_app`, que não é dono das tabelas e por isso respeita o RLS (RN-01). A senha do administrador do banco fica só com quem roda as migrations. O App Service nunca a recebe.

O custo sai do crédito do Azure for Students. Fora dos períodos de avaliação, dá para pausar quase tudo sem custo (passo 10).

---

## 0. Pré-requisitos

```bash
sudo pacman -S azure-cli      # Arch; nas outras distros: https://aka.ms/InstallAzureCLI
az login                      # abre o navegador; escolha a assinatura Azure for Students
gh auth status                # o GitHub CLI logado com o dono do repositório
sudo pacman -S bind           # o comando dig, usado no passo 9
# Docker: o passo 12 usa as ferramentas do Postgres 16 por meio dele.

# Na primeira vez, a assinatura precisa habilitar os serviços usados.
az provider register -n Microsoft.Web --wait
az provider register -n Microsoft.DBforPostgreSQL --wait
```

Defina os nomes uma vez no terminal. Os nomes do App Service e do Postgres viram endereços públicos e precisam ser únicos em toda a Azure. Se algum já existir, troque o sufixo.

```bash
RG=nutrihub-rg
LOC=chilecentral
PG=nutrihub-db-erik
API=nutrihub-erik
PLANO=nutrihub-plan
DOMAIN=appnutrihub.com.br
```

**Se já existe `backend/.env.azure`,** reaproveite as senhas e as chaves dele em vez de gerar outras:

```bash
set -a && source backend/.env.azure && set +a
PG_ADMIN_PASS="$DB_PASSWORD"; APP_DB_PASS="$DB_APP_PASSWORD"
```

Trocar a `DATA_ENCRYPTION_KEY` deixaria ilegíveis os dados de saúde já gravados.

**Só na primeira instalação,** gere as senhas e as chaves. Guarde as quatro num gerenciador de senhas: sem a `DATA_ENCRYPTION_KEY`, o histórico dos pacientes não pode mais ser lido.

```bash
PG_ADMIN_PASS="$(openssl rand -base64 24 | tr -d '/+=')Aa1"
APP_DB_PASS="$(openssl rand -base64 24 | tr -d '/+=')"
JWT_SECRET="$(openssl rand -base64 48)"
DATA_ENCRYPTION_KEY="$(openssl rand -base64 32)"
```

Se você fechar o terminal, as variáveis somem. Para recuperá-las, rode de novo o bloco de nomes e o `source` do `.env.azure`.

## 1. Grupo de recursos

Tudo fica num grupo só, para apagar de uma vez no final.

```bash
az group create -n $RG -l $LOC
```

## 2. Banco PostgreSQL

A criação leva de 5 a 10 minutos.

```bash
MEU_IP="$(curl -4 -s https://ifconfig.me)"   # -4: o firewall só aceita IPv4

az postgres flexible-server create -g $RG -n $PG -l $LOC \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
  --admin-user nutriadmin --admin-password "$PG_ADMIN_PASS" \
  --public-access $MEU_IP --yes

az postgres flexible-server db create -g $RG --server-name $PG --name nutrihub

# A migration create_tenants usa a extensão pgcrypto, e a Azure só a libera
# se ela estiver nesta lista.
az postgres flexible-server parameter set -g $RG --server-name $PG \
  --name azure.extensions --value PGCRYPTO

# Deixa os serviços da Azure (o App Service) chegarem ao banco.
az postgres flexible-server firewall-rule create -g $RG --server-name $PG \
  --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

O `--public-access` libera só o IP da sua máquina, para rodar as migrations. A regra criada para esse IP pode ganhar um nome automático. Se o seu IP mudar (outra rede ou roteador reiniciado), a conexão com o banco dá timeout, e é preciso liberar o novo IP:

```bash
MEU_IP="$(curl -4 -s https://ifconfig.me)"
az postgres flexible-server firewall-rule create -g $RG --server-name $PG \
  --name MinhaMaquina --start-ip-address $MEU_IP --end-ip-address $MEU_IP
# Se a regra MinhaMaquina já existe, troque "create" por "update".
```

## 3. Migrations e tabela TACO

As migrations rodam da sua máquina, com o usuário administrador. Crie o `backend/.env.azure`. O git ignora esse arquivo. **Se ele já existe, só troque o `DB_HOST`.**

```bash
cat > backend/.env.azure <<EOF
NODE_ENV=production
DB_HOST=$PG.postgres.database.azure.com
DB_PORT=5432
DB_NAME=nutrihub
DB_SSL=true
DB_USER=nutriadmin
DB_PASSWORD=$PG_ADMIN_PASS
DB_APP_USER=nutrihub_app
DB_APP_PASSWORD=$APP_DB_PASS
JWT_SECRET=$JWT_SECRET
DATA_ENCRYPTION_KEY=$DATA_ENCRYPTION_KEY
EOF
chmod 600 backend/.env.azure
```

Depois rode:

```bash
cd backend
set -a && source .env.azure && set +a
npm run migrate
npm run seed
```

A migration `create_app_role` cria o papel `nutrihub_app` com a senha de desenvolvimento que está no código. Troque pela de produção:

```bash
psql "host=$DB_HOST dbname=nutrihub user=nutriadmin password=$DB_PASSWORD sslmode=require" \
  -c "ALTER ROLE nutrihub_app PASSWORD '$DB_APP_PASSWORD'"
cd ..
```

Toda migration nova precisa ser aplicada assim, da sua máquina, **antes** do merge que a usa, porque o deploy automático não roda migrations:

```bash
cd backend && set -a && source .env.azure && set +a && npm run migrate
```

## 4. App Service

```bash
# Confira se o Node 22 está na lista. Se não estiver, use o LTS mais novo e troque
# também o node-version em .github/workflows/deploy-azure.yml.
az webapp list-runtimes --os linux | grep -i node

az appservice plan create -g $RG -n $PLANO -l $LOC --is-linux --sku B1
az webapp create -g $RG -p $PLANO -n $API --runtime "NODE:22-lts"

# Always On: o worker de notificações roda no mesmo processo da API e não
# pode dormir quando ninguém está usando o site.
az webapp config set -g $RG -n $API --always-on true \
  --startup-file "node dist/src/server.js"
az webapp update -g $RG -n $API --https-only true

az webapp config appsettings set -g $RG -n $API --settings \
  NODE_ENV=production \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false \
  DB_HOST=$PG.postgres.database.azure.com \
  DB_PORT=5432 \
  DB_NAME=nutrihub \
  DB_SSL=true \
  DB_APP_USER=nutrihub_app \
  DB_APP_PASSWORD="$APP_DB_PASS" \
  JWT_SECRET="$JWT_SECRET" \
  DATA_ENCRYPTION_KEY="$DATA_ENCRYPTION_KEY" \
  APP_URL="https://$API.azurewebsites.net" \
  EMAIL_TRANSPORT=console
```

`EMAIL_TRANSPORT=console` faz os e-mails irem só para o log até o SMTP do passo 8 estar pronto. O `APP_URL` é o endereço que vai nos links dos e-mails, e ele muda para o domínio no passo 9.

## 5. Ligar o GitHub Actions

O workflow `.github/workflows/deploy-azure.yml` precisa de uma credencial e de uma variável no repositório. Rode de dentro da pasta do repositório:

```bash
# A Azure desliga por padrão a autenticação básica, que o perfil de publicação usa.
az resource update -g $RG --namespace Microsoft.Web \
  --resource-type basicPublishingCredentialsPolicies \
  --parent sites/$API -n scm --set properties.allow=true

az webapp deployment list-publishing-profiles -g $RG -n $API --xml \
  | gh secret set AZURE_WEBAPP_PUBLISH_PROFILE

gh variable set AZURE_WEBAPP_NAME -b "$API"
```

Recriar o App Service gera um perfil de publicação novo. Sempre que isso acontecer, rode o `gh secret set` de novo.

## 6. Primeiro deploy

```bash
gh workflow run "Deploy Azure"
gh run watch
```

Depois disso, todo merge na `main` que mexe em `backend/` ou `frontend/` publica sozinho.

## 7. Conferir

```bash
curl https://$API.azurewebsites.net/health   # {"status":"ok"}
az webapp log tail -g $RG -n $API             # log ao vivo (Ctrl+C sai)
```

Abra `https://$API.azurewebsites.net` no navegador e crie uma conta.

Se der erro:
- **A API não sobe:** abra o `log tail`. A mensagem "Variável de ambiente obrigatória ausente" diz qual configuração do passo 4 faltou.
- **Timeout no banco:** falta a regra de firewall `AllowAzureServices` do passo 2.
- **O login dá erro 500:** confira se a senha do `nutrihub_app` foi trocada no passo 3 e se é a mesma do `DB_APP_PASSWORD`.

## 7.1 Observabilidade (Application Insights)

O Azure Application Insights recebe da API as requisições (volume, latência e falhas por rota), as consultas ao PostgreSQL, as exceções, a CPU e a memória do processo e o que a API escreve no log. Fica no plano gratuito: os primeiros 5 GB de dados por mês não são cobrados, e o Nutri-Hub gera bem menos que isso.

```bash
az extension add -n application-insights --upgrade
az monitor app-insights component create --app nutrihub-insights -g $RG -l $LOC \
  --kind web --application-type web

CS=$(az monitor app-insights component show --app nutrihub-insights -g $RG \
  --query connectionString -o tsv)
az webapp config appsettings set -g $RG -n $API \
  --settings APPLICATIONINSIGHTS_CONNECTION_STRING="$CS"
```

O App Service reinicia sozinho ao mudar a configuração. Se o comando `create` recusar a região `chilecentral`, crie o recurso em `brazilsouth`: ele só recebe a telemetria, e a região dele não afeta o app.

Para conferir, abra a API algumas vezes e olhe no portal, em **nutrihub-insights**:

- **Live Metrics:** requisições chegando em tempo real.
- **Investigate → Performance:** tempo por rota e por consulta ao banco.
- **Investigate → Failures:** exceções e requisições com erro.
- **Monitoring → Logs:** consultas em KQL, por exemplo `requests | summarize count(), percentile(duration, 95) by name`.

Sem a variável `APPLICATIONINSIGHTS_CONNECTION_STRING`, a telemetria fica desligada. É o caso em desenvolvimento e nos testes.

## 8. E-mail de verdade (Gmail)

Os e-mails saem pela conta `nutrihub.avisos@gmail.com`, por SMTP, com uma **senha de app** do Google.

1. Entre na conta do Gmail e ative a **verificação em duas etapas**, em https://myaccount.google.com/security.
2. Em https://myaccount.google.com/apppasswords, crie uma senha de app com o nome "Nutri-Hub". O Google mostra 16 letras uma única vez; copie.
3. Configure no App Service. O `EMAIL_FROM` precisa ser o próprio endereço do Gmail.

```bash
az webapp config appsettings set -g $RG -n $API --settings \
  EMAIL_TRANSPORT=smtp \
  EMAIL_FROM="Nutri-Hub <nutrihub.avisos@gmail.com>" \
  SMTP_HOST=smtp.gmail.com \
  SMTP_PORT=587 \
  SMTP_SECURE=false \
  SMTP_USER=nutrihub.avisos@gmail.com \
  SMTP_PASSWORD="<senha de app, sem espaços>"
```

Mudar uma configuração reinicia a API sozinha. Para testar, peça "Esqueci minha senha" na tela de login.

## 9. Domínio próprio

O site passa a abrir em `https://appnutrihub.com.br` e em `https://www.appnutrihub.com.br`. O DNS continua no registro.br.

**9.1. Pegue os valores que vão no DNS:**

```bash
az webapp show -g $RG -n $API --query customDomainVerificationId -o tsv   # ID de verificação
dig +short $API.azurewebsites.net | tail -1                               # IP do App Service
```

**9.2. Crie ou atualize as entradas no registro.br.** No painel, clique no domínio e vá em **DNS → Configurar zona DNS**. Se ele pedir, ative o *modo avançado* e espere ficar pronto. Ao recriar o App Service (como na mudança para o Chile), o IP e o ID de verificação mudam, então é só editar as entradas do A e dos dois TXT.

| Tipo | Nome | Valor |
|---|---|---|
| A | *(vazio)* | IP do App Service |
| TXT | `asuid` | ID de verificação |
| CNAME | `www` | `<API>.azurewebsites.net` (hoje, `nutrihub-erik.azurewebsites.net`) |
| TXT | `asuid.www` | ID de verificação |

Salve e confira. Pode levar de alguns minutos a algumas horas:

```bash
dig +short $DOMAIN
dig +short TXT asuid.$DOMAIN
dig +short www.$DOMAIN
```

**9.3. Ligue o domínio e o HTTPS:**

```bash
az webapp config hostname add -g $RG --webapp-name $API --hostname $DOMAIN
az webapp config hostname add -g $RG --webapp-name $API --hostname www.$DOMAIN

# Certificado gratuito gerenciado pela Azure, que se renova sozinho.
for HOST in $DOMAIN www.$DOMAIN; do
  THUMB=$(az webapp config ssl create -g $RG -n $API --hostname $HOST --query thumbprint -o tsv)
  az webapp config ssl bind -g $RG -n $API --certificate-thumbprint $THUMB --ssl-type SNI
done

az webapp config appsettings set -g $RG -n $API --settings \
  APP_URL="https://$DOMAIN" \
  CORS_ORIGIN="https://$DOMAIN"
```

Se o PWA já estava instalado no celular pelo endereço `azurewebsites.net`, desinstale e instale de novo pelo domínio. Para o navegador, são dois apps diferentes.

## 10. Pausar sem gastar

Para os períodos em que ninguém vai usar o sistema. O plano B1 cobra enquanto existir, mesmo com o app parado, então ele desce para o **F1**, que é gratuito.

O F1 não aceita domínio próprio nem Always On. Por isso, o domínio e os certificados são desligados antes. Os certificados continuam guardados no grupo de recursos, de graça, e o DNS no registro.br não muda.

```bash
az webapp config set -g $RG -n $API --always-on false

# Anote os thumbprints: eles servem para religar sem criar certificado novo.
az webapp config ssl list -g $RG --query "[].{host:subjectName, thumb:thumbprint}" -o table

for THUMB in <thumbprint da raiz> <thumbprint do www>; do
  az webapp config ssl unbind -g $RG -n $API --certificate-thumbprint $THUMB
done
for HOST in $DOMAIN www.$DOMAIN; do
  az webapp config hostname delete -g $RG --webapp-name $API --hostname $HOST
done

az appservice plan update -g $RG -n $PLANO --sku F1
az webapp stop -g $RG -n $API
az postgres flexible-server stop -g $RG -n $PG
```

Pausado, o único custo é o disco do Postgres: cerca de US$ 5 por mês no Chile.

**Atenção:** a Azure **religa o Postgres sozinha depois de 7 dias** parado. Para continuar sem custo, rode o `stop` do Postgres de novo nesse dia.

Enquanto estiver pausado, os merges na `main` continuam publicando. O app só volta a responder quando for religado.

## 11. Religar

Rode na ordem:

```bash
az appservice plan update -g $RG -n $PLANO --sku B1
az webapp config set -g $RG -n $API --always-on true

az postgres flexible-server start -g $RG -n $PG
az webapp start -g $RG -n $API

for HOST in $DOMAIN www.$DOMAIN; do
  az webapp config hostname add -g $RG --webapp-name $API --hostname $HOST
done

# Tente primeiro reaproveitar os certificados anotados no passo 10.
for THUMB in <thumbprint da raiz> <thumbprint do www>; do
  az webapp config ssl bind -g $RG -n $API --certificate-thumbprint $THUMB --ssl-type SNI
done
```

Se o `ssl bind` falhar, crie certificados novos com o laço do passo 9.3.

Para conferir:

```bash
curl https://$DOMAIN/health
```

Se você vai rodar migrations, confira antes se o IP da sua máquina ainda está liberado (passo 2).

## 12. Mudar de região (do Brasil para o Chile)

Uma região não se troca: o banco e o App Service precisam ser recriados. O roteiro abaixo leva os dados, as senhas e o domínio do `brazilsouth` para o `chilecentral`. São cerca de 1 hora de trabalho, mais o tempo do DNS. Faça a mudança alguns dias antes de uma apresentação.

**12.1. Salve os dados e as configurações do Brasil.** Defina os nomes do passo 0, mas com `LOC=brazilsouth`. Confira se o IP da sua máquina está liberado no banco do Brasil (passo 2) e rode:

```bash
az postgres flexible-server start -g $RG -n $PG

# As configurações do App Service, incluindo a senha do Gmail. O arquivo é
# ignorado pelo git (.env.*). Não o compartilhe.
az webapp config appsettings list -g $RG -n $API > backend/.env.azure-appsettings.json
chmod 600 backend/.env.azure-appsettings.json

# Cópia do banco, feita com as ferramentas do Postgres 16 (as mesmas do servidor).
set -a && source backend/.env.azure && set +a
docker run --rm -v "$PWD/backend:/backup" -e PGPASSWORD="$DB_PASSWORD" postgres:16 \
  pg_dump -h "$DB_HOST" -U nutriadmin -d nutrihub -Fc --no-owner -f /backup/nutrihub.dump
```

Confira se o arquivo `backend/nutrihub.dump` foi criado. Ele contém dados de pacientes: apague-o no fim (12.4) e nunca o envie ao git.

**12.2. Apague os recursos do Brasil.** Só depois de conferir o 12.1. Os nomes ficam livres para reaproveitar no Chile.

```bash
az group delete -n $RG --yes
```

**12.3. Crie tudo no Chile.** Com `LOC=chilecentral` e o `source` do `.env.azure` do passo 0:
- **Passo 1:** grupo de recursos.
- **Passo 2:** banco.
- **No lugar do passo 3, restaure a cópia.** O papel `nutrihub_app` precisa existir antes, porque as permissões e as políticas de RLS se referem a ele:

```bash
psql "host=$PG.postgres.database.azure.com dbname=nutrihub user=nutriadmin password=$PG_ADMIN_PASS sslmode=require" \
  -c "CREATE ROLE nutrihub_app LOGIN PASSWORD '$APP_DB_PASS'"

docker run --rm -v "$PWD/backend:/backup" -e PGPASSWORD="$PG_ADMIN_PASS" postgres:16 \
  pg_restore -h $PG.postgres.database.azure.com -U nutriadmin -d nutrihub --no-owner /backup/nutrihub.dump
```

O `pg_restore` pode avisar que o schema `public` ou a extensão já existem; esses avisos podem ser ignorados. Para conferir, rode `npm run migrate` como no passo 3. Ele deve dizer que já está tudo atualizado ("Already up to date").

- **Passo 4:** crie o plano e o App Service e restaure as configurações salvas no 12.1:

```bash
az webapp config appsettings set -g $RG -n $API --settings @backend/.env.azure-appsettings.json
```

- **Passos 5 e 6:** o perfil de publicação é novo, então o `gh secret set` é obrigatório.
- **Passo 9:** o IP e o ID de verificação mudam, então atualize o A e os dois TXT no registro.br e depois rode o 9.3.

**12.4. Limpe:**

```bash
rm backend/nutrihub.dump backend/.env.azure-appsettings.json
```

## 13. Depois da avaliação final

```bash
az group delete -n $RG --yes   # apaga tudo e para a cobrança
```

O domínio continua registrado no registro.br até vencer. Se não for renovar, basta não pagar a renovação.
