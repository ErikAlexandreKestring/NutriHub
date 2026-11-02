import { useState } from 'react';
import { mensagemDeFalha } from '@/lib/useErrosDeFormulario';
import { marcarRefeicaoFeita } from './planoApi';
import type { RefeicaoDoDia } from './tipos';

/**
 * UC-03: "Pode marcar refeições como concluídas." Um toque marca, outro
 * desmarca. A troca aparece na hora e volta atrás se o servidor recusar —
 * esperar a resposta para mudar o botão deixava a Dona Maria tocando de novo
 * achando que não tinha funcionado.
 */
export function BotaoDeRefeicaoFeita({ patientId, refeicao }: { patientId: string; refeicao: RefeicaoDoDia }) {
  const [feita, setFeita] = useState(refeicao.concluida_hoje);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar() {
    const nova = !feita;
    setErro(null);
    setFeita(nova);
    setSalvando(true);
    try {
      await marcarRefeicaoFeita(patientId, refeicao.id, nova);
    } catch (falha) {
      setFeita(!nova);
      setErro(mensagemDeFalha(falha, 'Não foi possível salvar. Tente de novo.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-w-0">
      {/* aria-pressed anuncia o estado ("pressionado") e o texto visível faz
          parte do nome acessível; o nome da refeição vai só para o leitor de
          tela, que lê o botão fora do contexto do cartão. */}
      <button
        type="button"
        aria-pressed={feita}
        onClick={alternar}
        disabled={salvando}
        className={`flex min-h-toque items-center gap-2 px-4 text-sm font-medium disabled:opacity-60 ${
          feita ? 'text-emerald-800 hover:bg-emerald-50' : 'text-slate-800 hover:bg-slate-50'
        }`}
      >
        <span
          aria-hidden="true"
          className={`grid h-6 w-6 place-items-center rounded-full ring-2 ring-inset ${
            feita ? 'bg-emerald-600 text-white ring-emerald-600' : 'ring-slate-400'
          }`}
        >
          {feita ? '✓' : ''}
        </span>
        {feita ? 'Feita' : 'Marcar como feita'}
        <span className="sr-only">: {refeicao.nome}</span>
      </button>
      {erro && (
        <p role="alert" className="px-4 pb-2 text-sm text-red-700">
          {erro}
        </p>
      )}
    </div>
  );
}
