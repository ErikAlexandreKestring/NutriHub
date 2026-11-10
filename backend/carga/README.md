# Testes de carga (RNF-06)

O RNF-06 pede que o sistema aguente **no mínimo 50 nutricionistas ativos ao mesmo tempo, sem degradação perceptível de performance**. Para isso há dois testes com o [k6](https://k6.io).

**Tamanho nesta etapa:** por orientação do professor, os testes usam **4 consultórios com 10 pacientes cada**, 44 usuários. Os testes leem os números da massa de teste. Para rodar com 50 consultórios basta mudar o preparo (`CARGA_CONSULTORIOS=50`), sem mexer nos testes.

| Teste | Pergunta | Comando |
|---|---|---|
| Uso realista (`cenario.js`) | 44 usuários ao mesmo tempo (4 nutricionistas e 40 pacientes) continuam com o app rápido? Responde APROVADO ou REPROVADO. | `npm run carga:rodar` |
| Limite (`limite.js`) | Até quantas requisições por segundo o servidor responde bem? | `npm run carga:limite` |

## Uso realista

São duas fases, uma depois da outra:

| Fase | Duração | Usuários ao mesmo tempo |
|---|---|---|
| Referência | 4 min | 1 nutricionista e 4 pacientes |
| Carga | 6 min e 30 s (sobe em 1 min, fica 5 min, desce em 30 s) | 4 nutricionistas e 40 pacientes (10 de cada consultório), 44 usuários ao mesmo tempo |

- **Cada nutricionista usa o próprio consultório**, junto com os 10 pacientes dele.
- **A referência dura 4 minutos** para ter umas 120 requisições. Com 30 requisições, o p95 é quase a segunda resposta mais lenta, e um pico isolado decidiria a comparação.
- **Os usuários navegam como pessoas**: abrem uma tela e levam de **5 a 15 s** lendo e decidindo antes de abrir a próxima.
  - **Nutricionista:** lista de pacientes, ficha, planos, plano, feedbacks, agenda, busca na TACO, NPS e grade de atendimento.
  - **Paciente:** plano do dia, marca e desmarca uma refeição, contato do nutricionista, consultas, horários livres, NPS e lembrete.
- **A carga é maior que a do uso real.** As 44 pessoas navegam sem parar durante os 5 minutos inteiros, enquanto um paciente de verdade abre o app só algumas vezes por dia.

Critérios na fase de carga:

- menos de **1%** de erro;
- **p95** de todas as requisições abaixo de **1 s**, ou seja, 95% respondem em menos de 1 s;
- **p95 do plano do paciente** abaixo de **2 s** (KPI da seção 1.6 do RFC);
- **sem degradação perceptível**: o teste só reprova se o p95 da carga ficar acima de 2 vezes o da referência e, ao mesmo tempo, subir mais de 200 ms. Dobrar de 5 ms para 10 ms não é algo que uma pessoa perceba.

## Limite

- **A carga sobe em degraus de requisições por segundo:** 2, 4, 6, 8, 10, 15, 20, 25, 30 e 40. Cada degrau sobe em 10 s e fica 50 s no alvo, então o teste leva no máximo 10 minutos.
- **Cada requisição é uma tela do app**, sorteada entre as mesmas telas do uso realista e entre todos os nutricionistas e pacientes da massa de teste.
- **A capacidade** é o maior degrau em que o servidor entregou pelo menos 95% das requisições pedidas, com p95 abaixo de 1 s e menos de 1% de erro.
- **O teste para sozinho** quando o p95 de um degrau passa de 5 s, para não deixar o site lento por mais tempo que o necessário. Nesse caso o k6 sai com código 99, o que é esperado.

## Como rodar

Todos os comandos são rodados de dentro de `backend/`.

1. **Criar a massa de teste.**
   - São 4 consultórios no domínio `@carga.nutrihub.test`, cada um com 10 pacientes com plano ativo, grade de atendimento, feedbacks e consultas. `CARGA_CONSULTORIOS` e `CARGA_PACIENTES` mudam esses números.
   - O lembrete diário já nasce desligado.
   - A senha é sorteada e vai para `carga/contas.json`, que fica fora do git.

   ```
   npm run carga:preparar
   ```

2. **Rodar os testes**, um de cada vez. Cada um leva uns 12 minutos. Durante o teste dá para acompanhar os gráficos em http://localhost:5665. Feche essa aba quando o teste acabar, senão o k6 fica esperando e não mostra o resultado.

   ```
   BASE_URL=https://appnutrihub.com.br npm run carga:rodar
   ```
   ```
   BASE_URL=https://appnutrihub.com.br npm run carga:limite
   ```

   Sem `BASE_URL`, os testes vão para `http://localhost:3000`.

3. **Apagar a massa de teste.**

   ```
   npm run carga:limpar
   ```

Os comandos 1 e 3 usam o banco configurado no ambiente. Para a Azure, carregue o `.env.azure` na frente, como nas migrations (ver `docs/DEPLOY.md`):

```
(set -a; source .env.azure; npm run carga:preparar)
```

O login acontece uma vez antes de cada teste e não entra na medição. O login usa bcrypt de custo 12 (RNF-02), que é caro de propósito, então no B1 da Azure essa preparação leva perto de 1 minuto. Nenhum teste manda feedback ou agenda consulta, porque essas ações disparam e-mail de verdade.

## Resultados

Ficam em `carga/resultados/`:

| Arquivo | Conteúdo |
|---|---|
| `cenario.txt` | Referência contra carga, os critérios e o resultado (APROVADO ou REPROVADO) |
| `limite.txt` | Tabela por degrau e a capacidade |
| `cenario.html`, `limite.html` | Relatório do k6 com os gráficos ao longo do tempo |
| `cenario.json`, `limite.json` | Todos os números |
