# Deploy na Azure

Como o Nutri-Hub fica no ar:

| Parte | Serviço | Plano |
|---|---|---|
| Frontend (PWA) e backend (API + worker de notificações) | Azure App Service (Linux, Node 22) | B1 |
| Banco | Azure Database for PostgreSQL – Flexible Server | Burstable B1ms |
| E-mail | Brevo (SMTP) | gratuito, 300 e-mails/dia |
| Domínio | `appnutrihub.com.br`, DNS do registro.br | R$ 40/ano |

Tudo na região `brazilsouth`.

**Por que não o Static Web Apps da RFC.** A assinatura Azure for Students tem
uma política que só permite criar recursos em `brazilsouth`, `chilecentral`,
`belgiumcentral`, `northcentralus` e `spaincentral`, e o Static Web Apps não
existe em nenhuma delas. O App Service passou a servir também o build do front
(`backend/src/shared/http/servirFrontend.ts`). Front e API no mesmo endereço
dispensam CORS: o front chama `/api` igual ao proxy do Vite em desenvolvimento.

**RLS em produção.** A aplicação conecta no banco com o papel `nutrihub_app`,
que não é dono das tabelas e por isso respeita o RLS (RN-01). A senha do
administrador do banco fica só com quem roda as migrations; o App Service nunca
a recebe.

Custo aproximado: US$ 30 por mês (App Service B1 + Postgres B1ms com 32 GB),
descontado do crédito do Azure for Students. Para parar a cobrança depois da
apresentação, veja o passo 10.

---

## 0. Pré-requisitos

```bash
sudo pacman -S azure-cli      # Arch; em outras distros: https://aka.ms/InstallAzureCLI
az login                      # abre o navegador; escolha a assinatura Azure for Students
gh auth status                # o GitHub CLI logado no dono do repositório
sudo pacman -S bind           # o comando dig, usado no passo 9

# Na primeira vez, a assinatura precisa habilitar os serviços usados.
az provider register -n Microsoft.Web --wait
az provider register -n Microsoft.DBforPostgreSQL --wait
```

Defina os nomes uma vez no terminal. O nome do App Service e o do Postgres
viram endereços públicos e precisam ser únicos na Azure inteira; troque o
sufixo se algum já existir.

```bash
RG=nutrihub-rg
LOC=brazilsouth
PG=nutrihub-db-erik
API=nutrihub-erik
DOMAIN=appnutrihub.com.br

# Senhas e chaves de produção. Guarde as quatro num gerenciador de senhas:
# sem a DATA_ENCRYPTION_KEY o histórico dos pacientes não pode mais ser lido.
PG_ADMIN_PASS="$(openssl rand -base64 24 | tr -d '/+=')Aa1"
APP_DB_PASS="$(openssl rand -base64 24 | tr -d '/+=')"
JWT_SECRET="$(openssl rand -base64 48)"
DATA_ENCRYPTION_KEY="$(openssl rand -base64 32)"
```

Se fechar o terminal, as variáveis somem. As senhas ficam salvas no arquivo do
passo 3 (`backend/.env.azure`, que o git ignora); para recuperá-las, rode
`set -a && source backend/.env.azure && set +a`.

## 1. Grupo de recursos

Tudo fica num grupo só, para apagar de uma vez no final.

```bash
az group create -n $RG -l $LOC
```

## 2. Banco PostgreSQL

Leva de 5 a 10 minutos.

```bash
az postgres flexible-server create -g $RG -n $PG -l $LOC \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
  --admin-user nutriadmin --admin-password "$PG_ADMIN_PASS" \
  --public-access "$(curl -s https://ifconfig.me)" --yes

az postgres flexible-server db create -g $RG -s $PG -d nutrihub

# A migration create_tenants usa a extensão pgcrypto, que a Azure só libera
# se estiver nesta lista.
az postgres flexible-server parameter set -g $RG -s $PG \
  -n azure.extensions -v PGCRYPTO

# Deixa os serviços da Azure (o App Service) chegarem ao banco.
az postgres flexible-server firewall-rule create -g $RG -n $PG \
  --rule-name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

O `--public-access` libera só o IP da sua máquina, para rodar as migrations. Se
o seu IP mudar (outra rede, roteador reiniciado), libere o novo:

```bash
MEU_IP="$(curl -s https://ifconfig.me)"
az postgres flexible-server firewall-rule create -g $RG -n $PG \
  --rule-name MinhaMaquina --start-ip-address $MEU_IP --end-ip-address $MEU_IP
```

## 3. Migrations e tabela TACO

As migrations rodam da sua máquina, com o usuário administrador. Crie
`backend/.env.azure`:

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
```

Depois rode:

```bash
cd backend
set -a && source .env.azure && set +a
npm run migrate
npm run seed
```

A migration `create_app_role` cria o papel `nutrihub_app` com a senha de
desenvolvimento que está no código. Troque-a pela de produção:

```bash
psql "host=$DB_HOST dbname=nutrihub user=nutriadmin password=$DB_PASSWORD sslmode=require" \
  -c "ALTER ROLE nutrihub_app PASSWORD '$DB_APP_PASSWORD'"
cd ..
```

Toda migration nova precisa ser aplicada assim, da sua máquina, **antes** do
merge que a usa. O deploy automático não roda migrations.

## 4. App Service

```bash
# Confira se o Node 22 está na lista; se não, use o LTS mais novo e troque
# também o node-version em .github/workflows/deploy-azure.yml.
az webapp list-runtimes --os linux | grep -i node

az appservice plan create -g $RG -n nutrihub-plan -l $LOC --is-linux --sku B1
az webapp create -g $RG -p nutrihub-plan -n $API --runtime "NODE:22-lts"

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

`EMAIL_TRANSPORT=console` faz os e-mails irem só para o log até o SMTP do
passo 8 estar pronto. `APP_URL` é o endereço que vai nos links dos e-mails; ele
muda para o domínio no passo 9.

## 5. Ligar o GitHub Actions

O workflow `.github/workflows/deploy-azure.yml` precisa de uma credencial e de
uma variável no repositório.

```bash
# A Azure desliga por padrão a autenticação básica que o perfil de publicação usa.
az resource update -g $RG --namespace Microsoft.Web \
  --resource-type basicPublishingCredentialsPolicies \
  --parent sites/$API -n scm --set properties.allow=true

az webapp deployment list-publishing-profiles -g $RG -n $API --xml \
  | gh secret set AZURE_WEBAPP_PUBLISH_PROFILE

gh variable set AZURE_WEBAPP_NAME -b "$API"
```

## 6. Primeiro deploy

Faça o merge do PR do deploy na `main`. O workflow roda sozinho; acompanhe com:

```bash
gh run watch
```

Depois disso, todo merge na `main` publica sozinho. Para publicar sem merge:
`gh workflow run "Deploy Azure"`.

## 7. Conferir

```bash
curl https://$API.azurewebsites.net/health   # {"status":"ok"}
az webapp log tail -g $RG -n $API             # log ao vivo (Ctrl+C sai)
```

Abra `https://$API.azurewebsites.net` no navegador e crie uma conta.

Se der erro:

- **A API não sobe:** abra o `log tail`. A mensagem "Variável de ambiente
  obrigatória ausente" diz qual configuração faltou no passo 4.
- **Timeout no banco:** falta a regra de firewall `AllowAzureServices` do
  passo 2.
- **Login dá erro 500:** confira se a senha do `nutrihub_app` foi trocada no
  passo 3 e se é a mesma do `DB_APP_PASSWORD`.

## 8. E-mail de verdade (Brevo)

1. Crie uma conta em https://www.brevo.com (o plano gratuito basta).
2. Em **Senders, Domains & Dedicated IPs → Senders**, cadastre e confirme o
   e-mail remetente.
3. Em **SMTP & API → SMTP**, gere uma chave SMTP e anote o login.
4. Configure no App Service:

```bash
az webapp config appsettings set -g $RG -n $API --settings \
  EMAIL_TRANSPORT=smtp \
  EMAIL_FROM="Nutri-Hub <seu-remetente@confirmado.com>" \
  SMTP_HOST=smtp-relay.brevo.com \
  SMTP_PORT=587 \
  SMTP_SECURE=false \
  SMTP_USER="<login SMTP da Brevo>" \
  SMTP_PASSWORD="<chave SMTP>"
```

Mudar uma configuração reinicia a API sozinha.

## 9. Domínio próprio

O site passa a abrir em `https://appnutrihub.com.br` e em
`https://www.appnutrihub.com.br`. O DNS continua no registro.br.

**9.1. Pegar os valores que vão no DNS:**

```bash
az webapp show -g $RG -n $API --query customDomainVerificationId -o tsv   # ID de verificação
dig +short $API.azurewebsites.net | tail -1                               # IP do App Service
```

**9.2. Criar as entradas no registro.br.** No painel, clique no domínio →
**DNS → Configurar zona DNS** (se pedir, ative o *modo avançado* e espere ele
ficar pronto). Adicione:

| Tipo | Nome | Valor |
|---|---|---|
| A | *(vazio)* | IP do App Service |
| TXT | `asuid` | ID de verificação |
| CNAME | `www` | `nutrihub-erik.azurewebsites.net` |
| TXT | `asuid.www` | ID de verificação |

Salve e confira (pode levar de alguns minutos a uma hora):

```bash
dig +short $DOMAIN
dig +short TXT asuid.$DOMAIN
dig +short www.$DOMAIN
```

**9.3. Ligar o domínio e o HTTPS:**

```bash
az webapp config hostname add -g $RG --webapp-name $API --hostname $DOMAIN
az webapp config hostname add -g $RG --webapp-name $API --hostname www.$DOMAIN

# Certificado gratuito gerenciado pela Azure, renovado sozinho.
for HOST in $DOMAIN www.$DOMAIN; do
  THUMB=$(az webapp config ssl create -g $RG -n $API --hostname $HOST --query thumbprint -o tsv)
  az webapp config ssl bind -g $RG -n $API --certificate-thumbprint $THUMB --ssl-type SNI
done

az webapp config appsettings set -g $RG -n $API --settings \
  APP_URL="https://$DOMAIN" \
  CORS_ORIGIN="https://$DOMAIN"
```

Se o PWA já estava instalado no celular pelo endereço `azurewebsites.net`,
desinstale e instale de novo pelo domínio: para o navegador, são dois apps
diferentes.

## 10. Depois da apresentação

```bash
az group delete -n $RG --yes   # apaga tudo e para a cobrança
```

O domínio continua registrado no registro.br até vencer; se não for renovar,
basta não pagar a renovação.

O Postgres também pode ser só parado (`az postgres flexible-server stop -g $RG
-n $PG`), mas a Azure religa o banco sozinha depois de 7 dias. O plano do App
Service cobra enquanto existir.
