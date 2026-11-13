# Testes e qualidade

## Estratégia

O projeto foi feito com TDD: o teste de uma regra vem junto com ela, e a regra de negócio fica no service, onde dá para testá-la sem HTTP e sem banco.

| Tipo | Ferramenta | Onde | O que cobre |
|---|---|---|---|
| Unitário (backend) | Jest | `backend/tests/<módulo>` | Services, validações, JWT, senhas, criptografia, middlewares |
| Integração (backend) | Jest + PostgreSQL real | `backend/tests/integration` | RLS, agenda, disponibilidade, NPS, LGPD, lembretes |
| Unitário (frontend) | Vitest + Testing Library | `frontend/src/**/__tests__` | Telas e hooks |
| Carga | k6 | `backend/carga` | Uso realista e limite do servidor |
| Desempenho e acessibilidade | Lighthouse | `docs/lighthouse` | RNF-04, RNF-07 e RNF-08 |

Os testes de integração rodam contra um Postgres de verdade porque o isolamento por RLS só pode ser provado no banco. Um banco simulado passaria mesmo com o RLS quebrado.

## Cobertura

Medida pelo SonarCloud, somando testes unitários e de integração do backend com os do frontend.

| Parte | Cobertura | Meta do Portfólio |
|---|---|---|
| Backend | 79,0% | 75% |
| Frontend | 95,0% | 25% |
| Total | 90,1% | |

Ficam fora da conta as migrations, o seed da TACO e os arquivos de inicialização, que não têm lógica para testar.

## CI/CD

| Workflow | Quando roda | O que faz |
|---|---|---|
| Backend CI | A cada PR e push | Lint, checagem de tipos e testes do backend |
| Frontend CI | A cada PR e push | Lint, checagem de tipos e testes do frontend |
| SonarCloud | A cada PR e merge na `main` | Testes com cobertura e análise estática |
| Deploy Azure | A cada merge na `main` | Build e publicação |

O desenvolvimento acontece em branches curtas e pull requests; o SonarCloud comenta o Quality Gate em cada um.

## Análise estática

SonarCloud, com o Quality Gate aprovado: 0 bugs, 0 vulnerabilidades, 0 code smells, 0 hotspots pendentes, 0,3% de duplicação. Detalhes em [docs/sonarcloud/RESULTADO.md](https://github.com/ErikAlexandreKestring/NutriHub/blob/main/docs/sonarcloud/RESULTADO.md).

## Carga

4 consultórios e 40 pacientes ao mesmo tempo em produção: 0% de erro, 95% das respostas em menos de 177 ms. O limite do App Service B1 ficou em 20 requisições por segundo, com a CPU como gargalo. O teste achou um problema real, a verificação do JWT gastava um terço da CPU, e a correção reduziu cerca de 7 vezes o gasto. Detalhes em [docs/teste-de-carga/RESULTADO.md](https://github.com/ErikAlexandreKestring/NutriHub/blob/main/docs/teste-de-carga/RESULTADO.md).

## Lighthouse em produção

Desempenho 98, acessibilidade 100, PWA aprovado e 21 telas sem rolagem horizontal em 360 px. Detalhes em [docs/lighthouse/RESULTADO.md](https://github.com/ErikAlexandreKestring/NutriHub/blob/main/docs/lighthouse/RESULTADO.md).

## Como rodar

```bash
cd backend
npm test                      # unitários
npm run test:integration      # precisa do docker compose up -d
npm run test:coverage

cd ../frontend
npm test
npm run test:coverage
```
