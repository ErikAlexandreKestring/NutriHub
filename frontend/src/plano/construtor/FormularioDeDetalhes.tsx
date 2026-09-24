import { useState, type FormEvent, type ReactNode } from 'react';
import { Alerta } from '@/components/Alerta';
import { AreaDeTexto } from '@/components/AreaDeTexto';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
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
}

/**
 * RF-05: meta calórica e orientações que o paciente vê. Serve à publicação do
 * rascunho e à correção de um plano já ativo — os dois validam igual no backend.
 */
export function FormularioDeDetalhes({ titulo, descricao, valores, aoMudar, rotuloEnviar, aoEnviar }: Props) {
  const [enviando, setEnviando] = useState(false);
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
      className="space-y-4 rounded-xl bg-white p-6 ring-1 ring-slate-200"
    >
      <div>
        <h2 id="detalhes-titulo" className="font-semibold text-slate-900">
          {titulo}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{descricao}</p>
      </div>

      {erroGeral && <Alerta>{erroGeral}</Alerta>}

      <Campo
        ref={registrar('meta_kcal')}
        rotulo="Meta calórica diária (kcal, opcional)"
        type="number"
        inputMode="numeric"
        min={500}
        max={10000}
        className="sm:w-72"
        erro={errosPorCampo.meta_kcal}
        value={valores.meta_kcal}
        onChange={(e) => aoMudar({ ...valores, meta_kcal: e.target.value })}
      />

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
