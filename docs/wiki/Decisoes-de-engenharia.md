# Decisões de engenharia

O RFC continua como foi entregue. Tudo que mudou na implementação está registrado em [Mudanças em relação ao RFC](https://github.com/ErikAlexandreKestring/NutriHub/blob/main/docs/MUDANCAS_EM_RELACAO_AO_RFC.md), com o motivo de cada mudança. Esta página resume as decisões principais.

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Monolito modular | Microsserviços | Um desenvolvedor e um domínio. Os módulos têm fronteiras claras para separar depois |
| Multi-tenant com RLS no PostgreSQL | Filtro por `tenant_id` só na aplicação | O isolamento vale mesmo se uma consulta esquecer o filtro |
| API com papel sem privilégio de dono | Conectar como administrador | Um dono das tabelas ignora o RLS |
| Um App Service para API e PWA | Static Web Apps | Não existe nas regiões permitidas. Evita CORS |
| AES-256-GCM nos dados de saúde | AES-256-CBC do RFC | O GCM detecta adulteração do valor no banco |
| Bloqueio de login por e-mail e IP | Só por e-mail | Só pelo e-mail, qualquer um trancaria a conta de outra pessoa |
| JWT que aceita apenas HS256 | Aceitar o algoritmo do token | Evita troca de algoritmo |
| WhatsApp por link direto | WhatsApp Business API | A API exige conta comercial verificada na Meta |
| NPS em tabela própria | Unificado em `feedbacks` | Os ciclos de vida são diferentes |
| Fila de notificações no banco | Broker externo | Um reinício não perde envios e não há serviço a mais para pagar |
| Região Chile Central | Brasil Sul | Cerca de US$ 7 por mês mais barato, com 50 ms a mais por requisição |
