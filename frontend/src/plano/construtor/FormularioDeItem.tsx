import { useEffect, useId, useState, type FormEvent } from 'react';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { Selecao } from '@/components/Selecao';
import { formatarGramas, formatarKcal, formatarMedida } from '@/lib/formato';
import { mensagemDeFalha, useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import { macrosDoAlimento } from '../calculos';
import { buscarAlimento, buscarAlimentos, type DadosDoItem } from '../planoApi';
import type { Alimento, ItemDaRefeicao } from '../tipos';

const CAMPOS = ['food_id', 'quantidade', 'quantidade_g'] as const;

/** Abaixo disso a busca devolveria boa parte da TACO inteira. */
const MINIMO_PARA_BUSCAR = 2;
const MAXIMO_DE_RESULTADOS = 8;
/** Espera o nutricionista parar de digitar antes de ir ao servidor. */
const ATRASO_DA_BUSCA_MS = 300;
/** Valor do seletor de medida que significa "em gramas". */
const GRAMAS = '';

type EstadoDaBusca =
  | { situacao: 'ocioso' }
  | { situacao: 'buscando' }
  | { situacao: 'pronto'; alimentos: Alimento[] }
  | { situacao: 'erro'; mensagem: string };

/**
 * Medida inicial ao escolher um alimento: "unidade" quando existe (fruta, ovo,
 * pão — o caso que motivou as medidas), senão a primeira medida, senão gramas.
 */
function medidaPadrao(alimento: Alimento): string {
  const unidade = alimento.medidas.find((medida) => medida.nome === 'unidade');
  return (unidade ?? alimento.medidas[0])?.id ?? GRAMAS;
}

function quantidadePadrao(medidaId: string): string {
  return medidaId === GRAMAS ? '100' : '1';
}

/** "1.5" → "1,5": o valor gravado volta ao campo no formato que o usuário digita. */
function paraCampo(valor: string): string {
  return String(Number(valor)).replace('.', ',');
}

interface Props {
  /** Entra no rótulo: com várias refeições abertas, cada formulário precisa ser distinguível. */
  nomeDaRefeicao: string;
  /** Presente ao alterar: o formulário abre com o alimento e a quantidade atuais. */
  itemAtual?: ItemDaRefeicao;
  aoEnviar: (dados: DadosDoItem) => Promise<void>;
  aoCancelar: () => void;
}

/**
 * RF-04, passos 4-5: busca um alimento da TACO (RN-03: só entra o que está na
 * base), define a quantidade em gramas ou numa medida caseira e mostra os
 * macros antes de confirmar. Também serve para trocar um item já prescrito.
 */
export function FormularioDeItem({ nomeDaRefeicao, itemAtual, aoEnviar, aoCancelar }: Props) {
  const editando = itemAtual !== undefined;
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState<EstadoDaBusca>({ situacao: 'ocioso' });
  const [alimento, setAlimento] = useState<Alimento | null>(null);
  const [carregandoAtual, setCarregandoAtual] = useState(editando);
  const [medidaId, setMedidaId] = useState(GRAMAS);
  const [quantidade, setQuantidade] = useState('100');
  const [enviando, setEnviando] = useState(false);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha } = useErrosDeFormulario(CAMPOS);
  const idResultados = useId();

  // Ao alterar, carrega o alimento atual com as medidas dele e reproduz a
  // prescrição gravada (medida + quantidade, ou gramas).
  useEffect(() => {
    if (!itemAtual) return;
    const controlador = new AbortController();
    buscarAlimento(itemAtual.food_id, controlador.signal)
      .then((atual) => {
        const medida = atual.medidas.find((m) => m.nome === itemAtual.medida_nome);
        setAlimento(atual);
        if (medida && itemAtual.quantidade_medida) {
          setMedidaId(medida.id);
          setQuantidade(paraCampo(itemAtual.quantidade_medida));
        } else {
          setMedidaId(GRAMAS);
          setQuantidade(paraCampo(itemAtual.quantidade_g));
        }
      })
      .catch((falha: unknown) => {
        if (falha instanceof DOMException && falha.name === 'AbortError') return;
        tratarFalha(falha, 'Não foi possível carregar o alimento atual.');
      })
      .finally(() => setCarregandoAtual(false));
    return () => controlador.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir o formulário
  }, [itemAtual?.id]);

  useEffect(() => {
    const limpo = termo.trim();
    if (alimento || limpo.length < MINIMO_PARA_BUSCAR) {
      setBusca({ situacao: 'ocioso' });
      return;
    }

    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => {
      setBusca({ situacao: 'buscando' });
      buscarAlimentos(limpo, controlador.signal)
        .then((alimentos) => setBusca({ situacao: 'pronto', alimentos: alimentos.slice(0, MAXIMO_DE_RESULTADOS) }))
        .catch((falha: unknown) => {
          if (falha instanceof DOMException && falha.name === 'AbortError') return;
          setBusca({ situacao: 'erro', mensagem: mensagemDeFalha(falha, 'Não foi possível buscar alimentos.') });
        });
    }, ATRASO_DA_BUSCA_MS);

    return () => {
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [termo, alimento]);

  function escolher(opcao: Alimento) {
    const medida = medidaPadrao(opcao);
    setAlimento(opcao);
    setMedidaId(medida);
    setQuantidade(quantidadePadrao(medida));
  }

  function trocarMedida(novaMedida: string) {
    setMedidaId(novaMedida);
    setQuantidade(quantidadePadrao(novaMedida));
  }

  const medida = alimento?.medidas.find((m) => m.id === medidaId) ?? null;
  const numero = Number(quantidade.replace(',', '.'));
  const valido = Number.isFinite(numero) && numero > 0;
  // Mesma conversão do backend (quantidade × gramatura, duas casas), para a
  // prévia bater com o que fica gravado.
  const gramas = valido ? (medida ? Math.round(numero * Number(medida.gramas) * 100) / 100 : numero) : null;
  const previa = alimento && gramas ? macrosDoAlimento(alimento, gramas) : null;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!alimento) return;
    limpar();
    setEnviando(true);
    try {
      await aoEnviar(
        medida
          ? { food_id: alimento.id, medida_id: medida.id, quantidade: numero }
          : { food_id: alimento.id, quantidade_g: numero },
      );
      if (!editando) {
        // Fica pronto para o próximo alimento da mesma refeição.
        setAlimento(null);
        setTermo('');
        setMedidaId(GRAMAS);
        setQuantidade('100');
      }
    } catch (falha) {
      tratarFalha(falha, editando ? 'Não foi possível alterar o alimento.' : 'Não foi possível adicionar o alimento.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      // Nome acessível do formulário: os botões se repetem em cada refeição
      // aberta, e é pelo formulário que o leitor de tela diz de qual se trata.
      aria-label={
        editando ? `Alterar ${itemAtual.food_nome} em ${nomeDaRefeicao}` : `Adicionar alimento em ${nomeDaRefeicao}`
      }
      className="space-y-3 border-t border-black/5 bg-creme/70 px-4 py-4"
    >
      {erroGeral && <Alerta>{erroGeral}</Alerta>}
      {errosPorCampo.food_id && <Alerta>{errosPorCampo.food_id}</Alerta>}

      {carregandoAtual ? (
        <p className="text-sm text-slate-600">Carregando alimento…</p>
      ) : alimento ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-inset ring-black/5">
          <span className="text-sm">
            <span className="block font-medium text-slate-900">{alimento.nome}</span>
            <span className="text-slate-600">{formatarKcal(alimento.kcal_100g)} em 100 g</span>
          </span>
          <Botao type="button" variante="secundario" onClick={() => setAlimento(null)}>
            Trocar alimento
          </Botao>
        </div>
      ) : (
        <div>
          <Campo
            rotulo={`Buscar alimento da TACO para ${nomeDaRefeicao}`}
            type="search"
            autoFocus
            placeholder="Ex.: arroz, banana, frango"
            aria-controls={idResultados}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
          />
          <div id={idResultados} aria-live="polite" className="mt-2">
            {busca.situacao === 'buscando' && <p className="text-sm text-slate-600">Buscando…</p>}
            {busca.situacao === 'erro' && <Alerta>{busca.mensagem}</Alerta>}
            {busca.situacao === 'pronto' && busca.alimentos.length === 0 && (
              // E-07: fora da TACO não entra no plano (RN-03).
              <p className="text-sm text-slate-600">Nenhum alimento da Tabela TACO encontrado para “{termo.trim()}”.</p>
            )}
            {busca.situacao === 'pronto' && busca.alimentos.length > 0 && (
              <ul className="divide-y divide-black/5 overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-black/5">
                {busca.alimentos.map((opcao) => (
                  <li key={opcao.id}>
                    <button
                      type="button"
                      onClick={() => escolher(opcao)}
                      className="flex min-h-toque w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-marca-50"
                    >
                      <span className="text-slate-900">{opcao.nome}</span>
                      <span className="shrink-0 text-slate-600">{formatarKcal(opcao.kcal_100g)}/100 g</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {alimento && (
        <div className="flex flex-wrap items-start gap-3">
          {alimento.medidas.length > 0 && (
            <Selecao
              rotulo="Medida"
              className="w-56"
              value={medidaId}
              onChange={(e) => trocarMedida(e.target.value)}
            >
              {alimento.medidas.map((opcao) => (
                <option key={opcao.id} value={opcao.id}>
                  {opcao.nome} ({formatarGramas(opcao.gramas)})
                </option>
              ))}
              <option value={GRAMAS}>gramas</option>
            </Selecao>
          )}
          <Campo
            // key: o campo troca de nome ao trocar de medida, e o ref precisa
            // acompanhar para o foco no erro cair no input certo.
            key={medida ? 'quantidade' : 'quantidade_g'}
            ref={registrar(medida ? 'quantidade' : 'quantidade_g')}
            rotulo={medida ? 'Quantidade' : 'Quantidade (g)'}
            type="number"
            inputMode="decimal"
            min={medida ? 0.5 : 1}
            step={medida ? 0.5 : 1}
            max={medida ? 50 : 5000}
            autoFocus={!editando}
            className="w-36"
            erro={medida ? errosPorCampo.quantidade : errosPorCampo.quantidade_g}
            dica={medida && gramas ? `${formatarMedida(numero, medida.nome)} = ${formatarGramas(gramas)}` : undefined}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
          <div className="min-w-0 flex-1 sm:mt-6">
            {previa && (
              <p className="text-sm text-slate-700" aria-live="polite">
                <span className="font-semibold text-slate-900">{formatarKcal(previa.kcal)}</span> ·{' '}
                {formatarGramas(previa.proteina_g)} proteína · {formatarGramas(previa.carb_g)} carboidrato ·{' '}
                {formatarGramas(previa.gordura_g)} gordura
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Botao type="button" variante="secundario" onClick={aoCancelar} disabled={enviando}>
          {editando ? 'Cancelar' : 'Fechar'}
        </Botao>
        <Botao type="submit" disabled={!alimento} carregando={enviando}>
          {editando ? 'Salvar alteração' : 'Adicionar à refeição'}
        </Botao>
      </div>
    </form>
  );
}
