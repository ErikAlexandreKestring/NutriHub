# Fontes dos dados de alimentos

Carregados no banco por `../001_foods_taco.ts` (`npm run seed`).

## `taco_composicao.csv`

Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição revisada e
ampliada, NEPA/UNICAMP, 2011. Valores por 100 g de parte comestível.

Extraído dos CSVs normalizados do projeto [brolesi/taco](https://github.com/brolesi/taco)
(commit `7facb2c`, arquivo `data/processed/taco/taco_composicao.csv`), mantendo
só as colunas que o Nutri-Hub usa, com duas casas decimais. Regras aplicadas:

- `Tr` (traço) e campos `NA` de proteína, carboidrato ou lipídeos viram `0`.
- Os 7 alimentos sem energia analisada na TACO (entre eles
  "Leite, de vaca, integral" e "Leite, de vaca, desnatado, UHT") ficam de fora:
  prescrevê-los mostraria 0 kcal, que é pior do que não oferecer o alimento.

## `taco_medidas_caseiras.csv`

Gramatura de medidas caseiras (unidade, fatia, colher de sopa...) da Tabela de
Medidas Referidas para os Alimentos Consumidos no Brasil — POF 2008-2009, IBGE,
via `data/processed/pof/pof_medidas_caseiras.csv` do mesmo projeto.

Os códigos de alimento da POF **não** correspondem aos números da TACO, então a
ligação entre as duas foi feita à mão, alimento por alimento. A coluna
`referencia` guarda a descrição da linha da POF de onde saiu cada valor.
Alimentos sem correspondência segura ficaram só com gramas.

## Licença do projeto brolesi/taco

MIT License — Copyright (c) 2026 Fabio Fogliarini Brolesi

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
