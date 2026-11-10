# Mudanças em relação ao RFC

Este documento lista o que foi implementado de forma diferente do RFC (`docs/RFC_Nutri-hub.pdf`) e o porquê. O RFC continua como foi entregue: as mudanças ficam registradas aqui.

Situação em 09/11/2026. O sistema está no ar em https://appnutrihub.com.br.

## 1. WhatsApp: link direto em vez da WhatsApp Business API

| Onde no RFC | O que o RFC previa | Como ficou |
|---|---|---|
| RF-07, RF-06, UC-06, fluxos 3.3 (passo 8) e 3.5 (passo 4), E-18, módulo 6 (seção 7.1), seção 5.5 | Mensagens automáticas pela WhatsApp Business API (Meta Cloud): novo plano disponível, lembrete diário de refeição pendente e alerta de feedback ao nutricionista | As notificações automáticas saem **por e-mail**. O WhatsApp virou um **link direto** (`wa.me`) no app do paciente, que abre a conversa com o número do nutricionista. |

**Motivo:** a API exige conta comercial verificada na Meta, número dedicado e modelos de mensagem aprovados, o que não cabe no prazo nem no escopo do TCC. O link resolve o contato paciente → nutricionista sem depender de aprovação externa.

Consequências:

- **Novo plano, feedback, resolução de feedback, consultas e NPS:** e-mail, com as mesmas novas tentativas do E-17.
- **Lembrete diário de refeição pendente (RF-07):**
  - **Quando:** um e-mail por dia, às 19:00 de Brasília.
  - **Conteúdo:** as refeições do dia cujo horário já passou e que o paciente não marcou como feitas. Quem marcou tudo não recebe.
  - **Como desligar:** o paciente desliga na tela **Meu plano**.
- **E-18 (falha no WhatsApp) não se aplica**, porque não há envio por WhatsApp.

## 2. Hospedagem: um App Service só, sem o Static Web Apps

| Onde no RFC | O que o RFC previa | Como ficou |
|---|---|---|
| Seções 5.2, 5.5 e 6.3 | Frontend no Azure Static Web Apps, API e worker no App Service | **Um único App Service (B1)** entrega a API e o PWA no mesmo endereço. O Express serve o build do frontend, e o worker de notificações roda no mesmo processo da API. |
| Seção 5.5 | Azure Blob Storage para arquivos estáticos | **Não foi usado:** os arquivos do PWA saem do próprio App Service. |

**Motivo:** a assinatura Azure for Students só permite criar recursos em regiões onde o Static Web Apps não está disponível. Servir tudo do mesmo endereço ainda dispensa CORS. HTTPS, domínio próprio (`appnutrihub.com.br`) e certificado gerenciado foram configurados no App Service.

## 3. Segurança

| Onde no RFC | O que o RFC previa | Como ficou | Motivo |
|---|---|---|---|
| Seção 6.3 | Dados sensíveis em repouso com **AES-256-CBC** | **AES-256-GCM** (mesmo tamanho de chave) | O GCM autentica o conteúdo: um valor adulterado no banco falha ao decifrar, em vez de virar texto corrompido sem aviso. |
| Seção 6.1, E-04 | 5 tentativas inválidas bloqueiam **o e-mail** por 15 min | Bloqueio por **e-mail + IP de origem** (5 tentativas) e um teto por e-mail (50 tentativas), por 15 min | Bloquear só pelo e-mail deixava qualquer pessoa trancar a conta de outra apenas errando a senha dela 5 vezes. |
| Seção 6.1 | JWT HS256 | HS256, e a verificação **aceita apenas HS256** | Um token assinado com outro algoritmo é recusado de cara. |
| Seção 6.5 | `audit_logs` com `acao`, `tabela_afetada`, `registro_id`, `ip_origem` | `audit_logs` com `evento`, `user_id`, `tenant_id`, `ip` e `detalhes` (JSON) | Os detalhes variam por evento: login, plano, consulta, feedback, exclusão de dados. A tabela continua com RLS e imutável, porque o papel da aplicação não tem UPDATE nem DELETE nela. |

## 4. Modelo de dados

| Onde no RFC | O que o RFC previa | Como ficou | Motivo |
|---|---|---|---|
| Seção 5.3 | Tabela `feedbacks` unificando feedback de refeição e NPS (`nps_nota`, `nps_comentario`) | NPS em tabela própria, `nps_pesquisas` | O feedback tem descrição obrigatória e um ciclo pendente → resolvido que o NPS não tem. Juntos, toda consulta da caixa de feedbacks precisaria filtrar as avaliações para fora. A tabela própria também guarda a data de envio, que a regra de 1 por trimestre consulta. |
| Seções 5.4 e 6.2 | RLS em `patients`, `meal_plans`, `meals`, `meal_items`, `appointments`, `availability`, `feedbacks` e `audit_logs` | As mesmas, **mais** `meal_completions`, `notifications` e `nps_pesquisas` | Tabelas criadas depois do RFC, com o mesmo isolamento por `tenant_id`. |

## 5. Funcionalidades além do RFC

- **Confirmação de e-mail no cadastro do nutricionista e "esqueci minha senha"**, com os erros novos E-25 a E-27.
- **Excluir rascunho de plano alimentar.** Planos ativos e encerrados continuam como histórico.
- **Copiar um plano** como ponto de partida de um novo.
- **Reativar paciente inativado.**
- **Regras extras de agenda:**
  - o paciente tem uma consulta futura por vez (E-22);
  - o paciente só agenda até 60 dias à frente (E-23);
  - os horários seguem a grade de hora em hora (E-24).
- **E-mail sem diferenciar maiúsculas e minúsculas** no cadastro e no login.

Os códigos E-22 a E-27 não existem no RFC: foram criados com essas funcionalidades.

## 6. Versões da stack

| Tecnologia | RFC | Usado | Motivo |
|---|---|---|---|
| Node.js | v20 LTS | v22 LTS | O Node 20 saiu de suporte em abril de 2026. O 22 é o LTS seguinte, e é o runtime configurado no App Service. |
| Nodemailer | v6 | v10 | Versão atual na época da implementação. |
| Envio de e-mail | Azure Communication (compatível) | SMTP do Gmail (`nutrihub.avisos@gmail.com`) | Gratuito e suficiente para o volume do TCC. |

As demais versões batem com o RFC: React 18, Vite 5, TypeScript 5, Tailwind 3, Express 4, jsonwebtoken 9, bcrypt 5, Knex 3 e PostgreSQL 16.

## 7. Custos

| Onde no RFC | O que o RFC previa | Como ficou |
|---|---|---|
| Seção 5.5 | App Service B1 com 750 h gratuitas; consumo de R$ 30–80/mês | O B1 e o PostgreSQL Flexible (B1ms) são cobrados do crédito do Azure for Students: cerca de **US$ 45/mês**. O crédito de US$ 100 cobre o sistema no ar até a avaliação final (20/12/2026). |

## 8. Teste de carga (RNF-06)

| Onde no RFC | O que o RFC previa | Como ficou |
|---|---|---|
| RNF-06 | No mínimo 50 nutricionistas ativos simultaneamente, sem degradação perceptível | **Nesta etapa, por orientação do professor, o teste usa 4 consultórios com 10 pacientes cada (44 usuários simultâneos).** O mesmo teste roda com 50 consultórios mudando um parâmetro. |

Os testes ficam em `backend/carga/`. São dois, ambos com o k6:

- **Uso realista:** todos os usuários navegam ao mesmo tempo, com 5 a 15 s entre as telas. O teste confere se 95% das respostas saem em menos de 1 s, se o plano do paciente abre em menos de 2 s (KPI da seção 1.6) e se não há degradação em relação a uma fase com o sistema quase vazio.
- **Limite:** aumenta a carga até o servidor saturar. Em 09/11/2026, o App Service B1 respondeu bem até **20 requisições por segundo**, com 0% de erro.
  - O gargalo foi a CPU do App Service, e não o banco.
  - Acima disso, a solução é um plano maior da Azure.

**Resultado com 4 consultórios e 40 pacientes (09/11/2026): APROVADO.** Houve 0% de erro, 95% das respostas saíram em menos de 177 ms e o plano do paciente abriu em menos de 266 ms. Os prints e os gráficos estão em [`docs/teste-de-carga/RESULTADO.md`](teste-de-carga/RESULTADO.md), também em PDF.

O teste também encontrou um gargalo real: a verificação do JWT gastava um terço da CPU da API. A correção cortou cerca de 7 vezes a CPU gasta no tratamento das requisições.
