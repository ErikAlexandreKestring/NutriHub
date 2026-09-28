import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Knex } from 'knex';

// RF-04 / RN-03: Tabela TACO completa (4ª edição, NEPA/UNICAMP), valores por
// 100 g, e as medidas caseiras curadas a partir da POF/IBGE. Os dados ficam em
// CSV em seeds/data/ (origem e licença em FONTES.md) e são carregados uma vez
// no banco: a busca do construtor consulta o Postgres, não um serviço externo —
// um catálogo de terceiros fora do ar não pode travar a prescrição (RNF-05), e
// `meal_items.food_id` precisa de uma linha local para a chave estrangeira.
//
// Idempotente: pode rodar de novo a cada atualização dos CSVs. Alimentos são
// casados por `taco_numero`; os do recorte antigo (sem número) não são
// apagados porque planos já publicados apontam para eles, mas saem da busca.
const DATA_DIR = path.join(__dirname, 'data');

/** CSV simples (RFC 4180): vírgula como separador, aspas duplas para escapar. */
function lerCsv(arquivo: string): Array<Record<string, string>> {
  const texto = readFileSync(path.join(DATA_DIR, arquivo), 'utf8');
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreAspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') {
        entreAspas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreAspas = true;
    } else if (c === ',') {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo);
      if (linha.some((valor) => valor !== '')) linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }

  const [cabecalho, ...dados] = linhas;
  return dados.map((valores) => Object.fromEntries(cabecalho.map((coluna, i) => [coluna, valores[i] ?? ''])));
}

export async function seed(knex: Knex): Promise<void> {
  const alimentos = lerCsv('taco_composicao.csv').map((linha) => ({
    taco_numero: Number(linha.taco_numero),
    nome: linha.nome,
    categoria: linha.categoria,
    kcal_100g: Number(linha.kcal_100g),
    proteina_100g: Number(linha.proteina_100g),
    carb_100g: Number(linha.carb_100g),
    gordura_100g: Number(linha.gordura_100g),
  }));
  const medidas = lerCsv('taco_medidas_caseiras.csv');

  await knex.transaction(async (trx) => {
    await trx('foods')
      .insert(alimentos)
      .onConflict('taco_numero')
      .merge(['nome', 'categoria', 'kcal_100g', 'proteina_100g', 'carb_100g', 'gordura_100g']);

    const ids = new Map<number, string>(
      (await trx('foods').whereNotNull('taco_numero').select('id', 'taco_numero')).map(
        (linha: { id: string; taco_numero: number }) => [linha.taco_numero, linha.id],
      ),
    );

    // As medidas não são referenciadas por id em lugar nenhum (meal_items
    // guarda um retrato), então recriar a tabela inteira é seguro e mantém o
    // banco igual ao CSV — inclusive quando uma linha é removida dele.
    await trx('food_measures').delete();
    const linhasDeMedida = medidas.map((linha) => {
      const foodId = ids.get(Number(linha.taco_numero));
      if (!foodId) {
        throw new Error(`taco_medidas_caseiras.csv: alimento TACO ${linha.taco_numero} não existe na composição`);
      }
      return { food_id: foodId, nome: linha.medida, gramas: Number(linha.gramas) };
    });
    if (linhasDeMedida.length > 0) {
      await trx('food_measures').insert(linhasDeMedida);
    }
  });
}
