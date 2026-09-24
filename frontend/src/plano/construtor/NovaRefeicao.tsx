import { useState, type FormEvent } from 'react';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { useErrosDeFormulario } from '@/lib/useErrosDeFormulario';

const CAMPOS = ['nome', 'horario'] as const;

/** RF-04, passo 4: nova refeição no rascunho (ex.: "Café da manhã", 07:30). */
export function NovaRefeicao({
  aoAdicionar,
}: {
  aoAdicionar: (dados: { nome: string; horario: string }) => Promise<void>;
}) {
  const [nome, setNome] = useState('');
  const [horario, setHorario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha } = useErrosDeFormulario(CAMPOS);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpar();
    setEnviando(true);
    try {
      await aoAdicionar({ nome, horario });
      setNome('');
      setHorario('');
    } catch (falha) {
      tratarFalha(falha, 'Não foi possível adicionar a refeição.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      noValidate
      aria-labelledby="nova-refeicao-titulo"
      className="rounded-xl border border-dashed border-slate-300 bg-white p-4"
    >
      <h3 id="nova-refeicao-titulo" className="text-sm font-semibold text-slate-800">
        Adicionar refeição
      </h3>
      {erroGeral && (
        <div className="mt-3">
          <Alerta>{erroGeral}</Alerta>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <Campo
          ref={registrar('nome')}
          rotulo="Nome"
          name="nome"
          placeholder="Café da manhã"
          className="min-w-0 flex-1"
          erro={errosPorCampo.nome}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <Campo
          ref={registrar('horario')}
          rotulo="Horário"
          type="time"
          name="horario"
          className="w-36"
          erro={errosPorCampo.horario}
          value={horario}
          onChange={(e) => setHorario(e.target.value)}
        />
        {/* O mt compensa a altura do rótulo, alinhando o botão aos inputs. */}
        <Botao type="submit" carregando={enviando} className="sm:mt-6">
          Adicionar
        </Botao>
      </div>
    </form>
  );
}
