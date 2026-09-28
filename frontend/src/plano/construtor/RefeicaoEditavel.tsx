import { useState } from 'react';
import { Botao } from '@/components/Botao';
import { formatarGramas, formatarHorario, formatarKcal, formatarQuantidade } from '@/lib/formato';
import { kcalDaRefeicao } from '../calculos';
import type { DadosDoItem } from '../planoApi';
import type { Refeicao } from '../tipos';
import { FormularioDeItem } from './FormularioDeItem';

interface Props {
  refeicao: Refeicao;
  aoAlterarItem: (itemId: string, dados: DadosDoItem) => Promise<void>;
  /**
   * Adicionar e remover só existem no rascunho. No plano ativo a refeição vem
   * sem eles e o nutricionista só troca o alimento de um item — o caso do
   * paciente que não quer comer algo, sem precisar montar um plano novo.
   */
  aoAdicionarItem?: (dados: DadosDoItem) => Promise<void>;
  aoRemoverItem?: (itemId: string) => Promise<void>;
  aoRemover?: () => Promise<void>;
}

/** Uma refeição editável do construtor, com seus alimentos e as ações permitidas. */
export function RefeicaoEditavel({ refeicao, aoAlterarItem, aoAdicionarItem, aoRemoverItem, aoRemover }: Props) {
  // Uma refeição recém-criada ainda não tem alimento: abre a busca direto.
  const [adicionando, setAdicionando] = useState(aoAdicionarItem !== undefined && refeicao.items.length === 0);
  const [alterando, setAlterando] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);

  async function remover(chave: string, acao: () => Promise<void>) {
    setRemovendo(chave);
    try {
      await acao();
    } finally {
      setRemovendo(null);
    }
  }

  function removerRefeicao(acao: () => Promise<void>) {
    const aviso =
      refeicao.items.length > 0
        ? `Remover "${refeicao.nome}" e os ${refeicao.items.length} alimento(s) dela?`
        : `Remover "${refeicao.nome}"?`;
    if (window.confirm(aviso)) void remover('refeicao', acao);
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
          {aoRemover && (
            <Botao
              variante="perigo"
              onClick={() => removerRefeicao(aoRemover)}
              carregando={removendo === 'refeicao'}
              aria-label={`Remover refeição ${refeicao.nome}`}
            >
              Remover
            </Botao>
          )}
        </div>
      </div>

      {refeicao.items.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-200">
          {refeicao.items.map((item) =>
            alterando === item.id ? (
              <li key={item.id}>
                <FormularioDeItem
                  nomeDaRefeicao={refeicao.nome}
                  itemAtual={item}
                  aoEnviar={async (dados) => {
                    await aoAlterarItem(item.id, dados);
                    setAlterando(null);
                  }}
                  aoCancelar={() => setAlterando(null)}
                />
              </li>
            ) : (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block text-slate-800">{item.food_nome}</span>
                  <span className="text-slate-600">
                    {formatarQuantidade(item)} · {formatarKcal(item.kcal)} · P {formatarGramas(item.proteina_g)} · C{' '}
                    {formatarGramas(item.carb_g)} · G {formatarGramas(item.gordura_g)}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Botao
                    variante="secundario"
                    onClick={() => setAlterando(item.id)}
                    aria-label={`Alterar ${item.food_nome} de ${refeicao.nome}`}
                  >
                    Alterar
                  </Botao>
                  {aoRemoverItem && (
                    <Botao
                      variante="secundario"
                      onClick={() => void remover(item.id, () => aoRemoverItem(item.id))}
                      carregando={removendo === item.id}
                      aria-label={`Remover ${item.food_nome} de ${refeicao.nome}`}
                    >
                      Remover
                    </Botao>
                  )}
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      {aoAdicionarItem &&
        (adicionando ? (
          <FormularioDeItem
            nomeDaRefeicao={refeicao.nome}
            aoEnviar={aoAdicionarItem}
            aoCancelar={() => setAdicionando(false)}
          />
        ) : (
          <div className="border-t border-slate-200 px-4 py-3">
            <Botao variante="secundario" onClick={() => setAdicionando(true)}>
              + Adicionar alimento
            </Botao>
          </div>
        ))}
    </li>
  );
}
