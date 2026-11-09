import { useEffect, useState } from 'react';
import { mensagemDeFalha } from '@/lib/useErrosDeFormulario';
import { useRecurso } from '@/lib/useRecurso';
import { buscarPreferenciaDeLembrete, definirPreferenciaDeLembrete } from './lembreteApi';

/**
 * RF-07: o paciente liga e desliga o lembrete diário por e-mail das refeições
 * que ainda não marcou como feitas. Como o botão de refeição feita, a troca
 * aparece na hora e volta atrás se o servidor recusar.
 *
 * É um complemento da tela: enquanto carrega ou se a busca falhar, não aparece.
 */
export function LembreteDiario({ patientId }: { patientId: string }) {
  const { estado } = useRecurso(`lembrete:${patientId}`, (sinal) => buscarPreferenciaDeLembrete(patientId, sinal));
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (estado.situacao === 'pronto' && typeof estado.dados.ativo === 'boolean') setAtivo(estado.dados.ativo);
  }, [estado]);

  if (ativo === null) return null;

  async function alternar() {
    const novo = !ativo;
    setErro(null);
    setAtivo(novo);
    setSalvando(true);
    try {
      await definirPreferenciaDeLembrete(patientId, novo);
    } catch (falha) {
      setAtivo(!novo);
      setErro(mensagemDeFalha(falha, 'Não foi possível salvar. Tente de novo.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section
      aria-labelledby="lembrete-titulo"
      className="rounded-2xl bg-white px-4 py-4 ring-1 ring-inset ring-slate-200"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="lembrete-titulo" className="font-medium text-slate-900">
            Lembrete diário por e-mail
          </h2>
          <p id="lembrete-descricao" className="mt-0.5 text-sm text-slate-600">
            No fim da tarde, avisa quais refeições do dia ainda não foram marcadas como feitas.
          </p>
        </div>
        {/* role="switch" anuncia "ligado/desligado"; a área de toque tem 44px (RNF-08). */}
        <button
          type="button"
          role="switch"
          aria-checked={ativo}
          aria-labelledby="lembrete-titulo"
          aria-describedby="lembrete-descricao"
          onClick={alternar}
          disabled={salvando}
          className="grid min-h-toque min-w-toque shrink-0 place-items-center disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors ${
              ativo ? 'justify-end bg-emerald-600' : 'justify-start bg-slate-300'
            }`}
          >
            <span className="h-5 w-5 rounded-full bg-white shadow" />
          </span>
        </button>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {erro}
        </p>
      )}
    </section>
  );
}
