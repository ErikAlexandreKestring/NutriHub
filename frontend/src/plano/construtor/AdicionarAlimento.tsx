import { useEffect, useId, useState, type FormEvent } from 'react';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { formatarGramas, formatarKcal } from '@/lib/formato';
import { mensagemDeFalha, useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import { macrosDoAlimento } from '../calculos';
import { buscarAlimentos } from '../planoApi';
import type { Alimento } from '../tipos';

const CAMPOS = ['food_id', 'quantidade_g'] as const;

/** Abaixo disso a busca devolveria boa parte da TACO inteira. */
const MINIMO_PARA_BUSCAR = 2;
const MAXIMO_DE_RESULTADOS = 8;
/** Espera o nutricionista parar de digitar antes de ir ao servidor. */
const ATRASO_DA_BUSCA_MS = 300;

type EstadoDaBusca =
  | { situacao: 'ocioso' }
  | { situacao: 'buscando' }
  | { situacao: 'pronto'; alimentos: Alimento[] }
  | { situacao: 'erro'; mensagem: string };

interface Props {
  /** Entra no rótulo: com várias refeições abertas, cada busca precisa ser distinguível. */
  nomeDaRefeicao: string;
  aoAdicionar: (dados: { food_id: string; quantidade_g: number }) => Promise<void>;
  aoCancelar: () => void;
}

/**
 * RF-04, passos 4-5: busca um alimento da TACO (RN-03: só entra o que está na
 * base), define a quantidade e mostra os macros antes de confirmar.
 */
export function AdicionarAlimento({ nomeDaRefeicao, aoAdicionar, aoCancelar }: Props) {
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState<EstadoDaBusca>({ situacao: 'ocioso' });
  const [alimento, setAlimento] = useState<Alimento | null>(null);
  const [quantidade, setQuantidade] = useState('100');
  const [enviando, setEnviando] = useState(false);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha } = useErrosDeFormulario(CAMPOS);
  const idResultados = useId();

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

  const gramas = Number(quantidade.replace(',', '.'));
  const previa = alimento && Number.isFinite(gramas) && gramas > 0 ? macrosDoAlimento(alimento, gramas) : null;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!alimento) return;
    limpar();
    setEnviando(true);
    try {
      await aoAdicionar({ food_id: alimento.id, quantidade_g: gramas });
      // Fica pronto para o próximo alimento da mesma refeição.
      setAlimento(null);
      setTermo('');
      setQuantidade('100');
    } catch (falha) {
      tratarFalha(falha, 'Não foi possível adicionar o alimento.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      // Nome acessível do formulário: os botões ("Adicionar à refeição",
      // "Fechar") se repetem em cada refeição aberta, e é pelo formulário que o
      // leitor de tela diz de qual refeição se trata.
      aria-label={`Adicionar alimento em ${nomeDaRefeicao}`}
      className="space-y-3 border-t border-slate-200 bg-slate-50 px-4 py-4"
    >
      {erroGeral && <Alerta>{erroGeral}</Alerta>}
      {errosPorCampo.food_id && <Alerta>{errosPorCampo.food_id}</Alerta>}

      {alimento ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
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
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                {busca.alimentos.map((opcao) => (
                  <li key={opcao.id}>
                    <button
                      type="button"
                      onClick={() => setAlimento(opcao)}
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
          <Campo
            ref={registrar('quantidade_g')}
            rotulo="Quantidade (g)"
            type="number"
            inputMode="decimal"
            min={1}
            max={5000}
            autoFocus
            className="w-36"
            erro={errosPorCampo.quantidade_g}
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
          Fechar
        </Botao>
        <Botao type="submit" disabled={!alimento} carregando={enviando}>
          Adicionar à refeição
        </Botao>
      </div>
    </form>
  );
}
