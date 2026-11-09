# Teste de carga (RNF-06)

O RNF-06 pede que o sistema aguente **no mínimo 50 nutricionistas ativos ao mesmo tempo sem degradação perceptível de performance**. Este teste usa o [k6](https://k6.io) para simular isso e dizer se o sistema passa ou não.

## O que o teste faz

O teste tem duas fases, uma depois da outra:

| Fase | Duração | Usuários ao mesmo tempo |
|---|---|---|
| Referência | 1 min | 1 nutricionista e 2 pacientes |
| Carga | 6 min e 30 s (sobe em 1 min, fica 5 min, desce em 30 s) | 50 nutricionistas e 100 pacientes |

Cada nutricionista fica no seu próprio consultório, com 2 pacientes dele usando o app ao mesmo tempo. Os usuários repetem o que uma pessoa faz no app, com uma pausa de 1 a 3 s entre as telas:

- **Nutricionista:** lista de pacientes, ficha, planos, plano, feedbacks, agenda, busca na TACO, NPS e grade de atendimento.
- **Paciente:** plano do dia, marca e desmarca uma refeição, contato do nutricionista, consultas, horários livres, NPS e lembrete.

O login acontece uma vez antes do teste e não entra na medição. O teste não manda feedback nem agenda consulta, porque essas ações disparam e-mail de verdade.

## Critérios de aprovação

Na fase de carga:

- menos de **1%** de erro;
- **p95** de todas as requisições abaixo de **1 s**, ou seja, 95% respondem em menos de 1 s;
- **p95 do plano do paciente** abaixo de **2 s** (KPI da seção 1.6 do RFC);
- **sem degradação perceptível**: o teste só reprova se o p95 da carga passar de 2 vezes o da referência e, ao mesmo tempo, subir mais de 200 ms. Dobrar de 5 ms para 10 ms não é algo que uma pessoa perceba.

## Como rodar

Todos os comandos são rodados de dentro de `backend/`.

1. **Criar a massa de teste.** São 50 consultórios no domínio `@carga.nutrihub.test`, cada um com 5 pacientes com plano ativo, grade de atendimento, feedbacks e consultas. O lembrete diário já nasce desligado. A senha é sorteada e vai para `carga/contas.json`, que fica fora do git.

   ```
   npm run carga:preparar
   ```

2. **Rodar o teste.** Ele leva uns 8 minutos. Durante o teste dá para acompanhar os gráficos em http://localhost:5665.

   ```
   BASE_URL=https://appnutrihub.com.br npm run carga:rodar
   ```

   Sem `BASE_URL`, o teste vai para `http://localhost:3000`.

3. **Apagar a massa de teste.**

   ```
   npm run carga:limpar
   ```

Os comandos 1 e 3 usam o banco configurado no ambiente. Para a Azure, carregue o `.env.azure` antes (ver `docs/DEPLOY.md`).

## Resultados

Ficam em `carga/resultados/`:

- `resumo.txt`: a tabela da referência contra a carga e os critérios, com o resultado final (APROVADO ou REPROVADO);
- `relatorio.html`: o relatório do k6 com os gráficos ao longo do tempo, que abre no navegador;
- `resumo.json`: todos os números.

O comando termina com código diferente de 0 se algum critério falhar.
