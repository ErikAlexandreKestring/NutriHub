import { useState, type FormEvent, type ReactNode } from 'react';
import { Alerta } from '@/components/Alerta';
import { AreaDeTexto } from '@/components/AreaDeTexto';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { formatarKcal } from '@/lib/formato';
import { META_MAXIMA, META_MINIMA, metaPelaSoma } from '../calculos';
import { useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import type { DetalhesDoPlano } from '../planoApi';

const CAMPOS = ['meta_kcal', 'orientacoes'] as const;

interface Props {
  titulo: string;
  descricao: ReactNode;
  valores: DetalhesDoPlano;
  /** Controlado pela página, que mostra a meta digitada no resumo em tempo real. */
  aoMudar: (valores: DetalhesDoPlano) => void;
  rotuloEnviar: string;
  aoEnviar: () => Promise<void>;
  /** Soma das kcal dos alimentos do plano, como o resumo mostra. */
  previstoKcal: number;
  /** O nutricionista digitou a meta: a página para de acompanhar a soma. */
  aoDigitarMeta: () => void;
}


/**
 * RF-05: meta calórica e orientações que o paciente vê. Serve à publicação do
 * rascunho e à correção de um plano já ativo — os dois validam igual no backend.
 */
export function FormularioDeDetalhes({
  titulo,
  descricao,
  valores,
  aoMudar,
  rotuloEnviar,
  aoEnviar,
  previstoKcal,
  aoDigitarMeta,
}: Props) {
  const [enviando, setEnviando] = useState(false);
  const soma = metaPelaSoma(previstoKcal);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha } = useErrosDeFormulario(CAMPOS);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpar();
    setEnviando(true);
    try {
      await aoEnviar();
    } catch (falha) {
      tratarFalha(falha, 'Não foi possível salvar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-labelledby="detalhes-titulo"
      className="space-y-4 cartao p-6"
    >
      <div>
        <h2 id="detalhes-titulo" className="font-titulo text-2xl text-slate-900">
          {titulo}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{descricao}</p>
      </div>

      {erroGeral && <Alerta>{erroGeral}</Alerta>}

      <div>
        <Campo
          ref={registrar('meta_kcal')}
          rotulo="Meta calórica diária (kcal, opcional)"
          type="number"
          inputMode="numeric"
          min={META_MINIMA}
          max={META_MAXIMA}
          className="sm:w-72"
          erro={errosPorCampo.meta_kcal}
          dica={
            soma && valores.meta_kcal.trim() === soma
              ? `É a soma das kcal dos alimentos do plano. Altere se a meta for outra.`
              : undefined
          }
          value={valores.meta_kcal}
          onChange={(e) => {
            aoDigitarMeta();
            aoMudar({ ...valores, meta_kcal: e.target.value });
          }}
        />
        {/* A meta difere da soma (foi digitada, ou o plano mudou depois): um
            clique volta a igualar as duas. */}
        {soma && valores.meta_kcal.trim() !== soma && (
          <button
            type="button"
            onClick={() => aoMudar({ ...valores, meta_kcal: soma })}
            className="mt-1 inline-flex min-h-toque items-center text-sm font-semibold text-marca-700 underline"
          >
            Usar a soma dos alimentos ({formatarKcal(previstoKcal)})
          </button>
        )}
      </div>

      <AreaDeTexto
        ref={registrar('orientacoes')}
        rotulo="Orientações ao paciente (opcional)"
        rows={5}
        maxLength={2000}
        dica="Aparece para o paciente logo acima das refeições. Até 2000 caracteres."
        erro={errosPorCampo.orientacoes}
        value={valores.orientacoes}
        onChange={(e) => aoMudar({ ...valores, orientacoes: e.target.value })}
      />

      <div className="flex justify-end">
        <Botao type="submit" carregando={enviando}>
          {rotuloEnviar}
        </Botao>
      </div>
    </form>
  );
}
