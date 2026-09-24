import { useState } from 'react';
import { Botao } from '@/components/Botao';
import { formatarGramas, formatarHorario, formatarKcal } from '@/lib/formato';
import { kcalDaRefeicao } from '../calculos';
import type { Refeicao } from '../tipos';
import { AdicionarAlimento } from './AdicionarAlimento';

interface Props {
  refeicao: Refeicao;
  aoAdicionarItem: (dados: { food_id: string; quantidade_g: number }) => Promise<void>;
  aoRemoverItem: (itemId: string) => Promise<void>;
  aoRemover: () => Promise<void>;
}

/** Uma refeição do rascunho, com seus alimentos e as ações do construtor. */
export function RefeicaoEditavel({ refeicao, aoAdicionarItem, aoRemoverItem, aoRemover }: Props) {
  // Uma refeição recém-criada ainda não tem alimento: abre a busca direto.
  const [adicionando, setAdicionando] = useState(refeicao.items.length === 0);
  const [removendo, setRemovendo] = useState<string | null>(null);

  async function remover(chave: string, acao: () => Promise<void>) {
    setRemovendo(chave);
    try {
      await acao();
    } finally {
      setRemovendo(null);
    }
  }

  function removerRefeicao() {
    const aviso =
      refeicao.items.length > 0
        ? `Remover "${refeicao.nome}" e os ${refeicao.items.length} alimento(s) dela?`
        : `Remover "${refeicao.nome}"?`;
    if (window.confirm(aviso)) void remover('refeicao', aoRemover);
  }

  return (
    <li className="overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h3 className="font-semibold text-slate-900">
          <span className="tabular-nums text-marca-800">{formatarHorario(refeicao.horario)}</span>{' '}
          <span className="ml-1">{refeicao.nome}</span>
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{formatarKcal(kcalDaRefeicao(refeicao))}</span>
          <Botao
            variante="perigo"
            onClick={removerRefeicao}
            carregando={removendo === 'refeicao'}
            aria-label={`Remover refeição ${refeicao.nome}`}
          >
            Remover
          </Botao>
        </div>
      </div>

      {refeicao.items.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-200">
          {refeicao.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="min-w-0">
                <span className="block text-slate-800">{item.food_nome}</span>
                <span className="text-slate-600">
                  {formatarGramas(item.quantidade_g)} · {formatarKcal(item.kcal)} · P {formatarGramas(item.proteina_g)}{' '}
                  · C {formatarGramas(item.carb_g)} · G {formatarGramas(item.gordura_g)}
                </span>
              </span>
              <Botao
                variante="secundario"
                onClick={() => void remover(item.id, () => aoRemoverItem(item.id))}
                carregando={removendo === item.id}
                aria-label={`Remover ${item.food_nome} de ${refeicao.nome}`}
              >
                Remover
              </Botao>
            </li>
          ))}
        </ul>
      )}

      {adicionando ? (
        <AdicionarAlimento
          nomeDaRefeicao={refeicao.nome}
          aoAdicionar={aoAdicionarItem}
          aoCancelar={() => setAdicionando(false)}
        />
      ) : (
        <div className="border-t border-slate-200 px-4 py-3">
          <Botao variante="secundario" onClick={() => setAdicionando(true)}>
            + Adicionar alimento
          </Botao>
        </div>
      )}
    </li>
  );
}
