# Requisitos

A especificação completa está no [RFC](https://github.com/ErikAlexandreKestring/NutriHub/blob/main/docs/RFC_Nutri-hub.pdf), com casos de uso, fluxos e regras. Esta página resume o que foi implementado.

## Atores

- **Nutricionista:** dono de um consultório (tenant). Acessa pelo navegador.
- **Paciente:** convidado pelo nutricionista. Acessa pelo app instalável (PWA).

## Requisitos funcionais

| Requisito | O que faz | Ator |
|---|---|---|
| RF-01 | Cadastro do nutricionista com CRN, confirmação de e-mail e criação automática do consultório | Nutricionista |
| RF-02 | Login com JWT (8 h para o nutricionista, 24 h para o paciente) e recuperação de senha | Ambos |
| RF-03 | Pacientes: cadastrar, editar, listar, inativar e reativar, com histórico e convite de primeiro acesso por e-mail | Nutricionista |
| RF-04 | Construtor de plano alimentar com a tabela TACO e cálculo de calorias, carboidratos, proteínas e gorduras. Rascunho, publicado ou copiado | Nutricionista |
| RF-05 | Meu plano: refeições do dia, metas e orientações, com marcação do que foi comido | Paciente |
| RF-06 | Feedback do paciente (alergia, falta de ingrediente etc.), com aviso ao nutricionista em até 30 s | Paciente |
| RF-07 | Notificações por e-mail: novo plano, lembrete diário das refeições não marcadas e alerta de feedback | Sistema |
| RF-08 | Grade de disponibilidade por dia da semana e horário | Nutricionista |
| RF-09 | Pesquisa NPS ao fim do ciclo do plano, no máximo uma por trimestre | Paciente |
| RF-10 | Painel: pacientes ativos, feedbacks pendentes e próximas consultas | Nutricionista |
| RF-11 | Cancelamento de consulta com a antecedência mínima configurada | Paciente |
| RF-12 | Remarcação de consulta dentro da grade, com aviso às duas partes | Ambos |

## User stories

**Nutricionista**

1. Como nutricionista, quero me cadastrar com o meu CRN para ter um consultório só meu, sem ver dados de outros profissionais. (RF-01)
2. Como nutricionista, quero cadastrar um paciente e enviar um convite por e-mail para que ele crie a própria senha. (RF-03)
3. Como nutricionista, quero montar um plano buscando alimentos na tabela TACO e ver as calorias e os macros mudarem na hora, para fechar as metas sem fazer conta. (RF-04)
4. Como nutricionista, quero salvar o plano como rascunho e só publicá-lo quando estiver pronto, para o paciente não ver uma versão incompleta. (RF-04)
5. Como nutricionista, quero copiar um plano antigo como ponto de partida de um novo, para não refazer tudo. (RF-04)
6. Como nutricionista, quero definir os meus horários de atendimento e a antecedência mínima de cancelamento, para organizar a agenda. (RF-08, RF-11)
7. Como nutricionista, quero ser avisado quando um paciente relata um problema com a dieta, para resolver cedo. (RF-06, RF-07)
8. Como nutricionista, quero um painel com pacientes ativos, feedbacks pendentes e próximas consultas, para começar o dia sabendo o que fazer. (RF-10)

**Paciente**

9. Como paciente, quero abrir o plano de hoje no celular e marcar o que já comi, para acompanhar a dieta sem papel. (RF-05)
10. Como paciente, quero registrar que não consegui seguir uma refeição e o motivo, para o nutricionista ajustar o plano. (RF-06)
11. Como paciente, quero agendar, remarcar e cancelar consultas dentro dos horários livres, sem ligar para o consultório. (RF-11, RF-12)
12. Como paciente, quero receber um lembrete das refeições que esqueci de marcar, e poder desligá-lo. (RF-07)

## Fluxos de negócio completos

1. **Plano alimentar:** cadastro do paciente → construção do plano com a TACO → publicação → aviso por e-mail → paciente marca as refeições → lembrete diário.
2. **Agenda:** grade de disponibilidade → paciente agenda → remarcação ou cancelamento com a regra de antecedência → aviso às duas partes.
3. **Retorno do paciente:** feedback de uma refeição → alerta ao nutricionista → resolução → pesquisa NPS no painel.

## Regras de negócio principais

| Regra | Descrição |
|---|---|
| RN-01 | Cada nutricionista só acessa os dados do próprio consultório. Garantido pelo Row-Level Security no banco |
| Plano ativo | Só há um plano ativo por paciente. Publicar um novo encerra o anterior |
| Consultas | O paciente tem uma consulta futura por vez, agenda até 60 dias à frente e em horários cheios da grade |
| Cancelamento | Só com a antecedência mínima definida pelo nutricionista |
| NPS | No máximo uma pesquisa por trimestre para cada paciente |
| Login | 5 tentativas erradas por e-mail e IP bloqueiam o acesso por 15 min |

## Requisitos não funcionais

| Requisito | Meta | Evidência |
|---|---|---|
| RNF-01 Isolamento entre consultórios | RLS no PostgreSQL | Testes de integração `tenantIsolation` |
| RNF-02 Senhas | bcrypt, custo 12 | Testes de `password` |
| RNF-03 LGPD | Dados de saúde cifrados (AES-256-GCM) e exclusão a pedido | Testes de `patientData` |
| RNF-04 Plano em menos de 2 s em 4G | Tela em 1,7 s e plano completo em 2,2 s no 4G lento do Lighthouse | `docs/lighthouse/RESULTADO.md` |
| RNF-05 Uptime de 99,9% | App Service com Always On | UptimeRobot |
| RNF-06 Escalabilidade | p95 de 177 ms e 0% de erro no k6 | `docs/teste-de-carga/RESULTADO.md` |
| RNF-07 360 px e PWA | Layout mobile-first, manifesto e service worker | Lighthouse |
| RNF-08 Acessibilidade | Contraste AA e área de toque de 44 x 44 px (WCAG 2.1) | Lighthouse: 100 |
| RNF-09 Agenda em tempo real | Validação na hora do agendamento | Testes de integração de agenda |
| RNF-10 Auditoria | Eventos em `audit_logs` com usuário, IP e data | Testes de `audit` |

## Normas aplicáveis

- **LGPD (Lei 13.709/2018):** minimização de dados, criptografia dos dados de saúde, exclusão a pedido do titular e registro de auditoria.
- **Lei 13.787/2018 (prontuário eletrônico):** confidencialidade e controle de acesso aos registros dos pacientes.
- **WCAG 2.1:** contraste, foco visível, área de toque e navegação por teclado.
- **OWASP Top 10:** senhas com bcrypt, JWT com algoritmo fixo, consultas parametrizadas, bloqueio de tentativas e isolamento por tenant.
- **Licenças de terceiros:** a base nutricional é a tabela TACO (Unicamp). A fonte está em `backend/src/db/seeds/data/FONTES.md`.
