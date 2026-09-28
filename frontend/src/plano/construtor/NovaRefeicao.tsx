import { useState, type FormEvent } from 'react';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { CampoDeHorario } from '@/components/CampoDeHorario';
import { useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import { iconeDaRefeicao, TIPOS_DE_REFEICAO } from '../iconeDaRefeicao';

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
      className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-4"
    >
      <h3 id="nova-refeicao-titulo" className="font-titulo text-2xl text-slate-900">
        Adicionar refeição
      </h3>
      {erroGeral && (
        <div className="mt-3">
          <Alerta>{erroGeral}</Alerta>
        </div>
      )}

      {/* Atalhos do mockup "Tipo de refeição": um toque preenche nome e um
          horário típico, que continuam editáveis nos campos abaixo. */}
      <fieldset className="mt-4">
        <legend className="rotulo-campo">Tipo de refeição</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TIPOS_DE_REFEICAO.map((tipo) => {
            const escolhido = nome === tipo.nome;
            return (
              <button
                key={tipo.nome}
                type="button"
                aria-pressed={escolhido}
                onClick={() => {
                  setNome(tipo.nome);
                  setHorario(tipo.horario);
                }}
                className={`flex min-h-toque items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium ring-1 ring-inset transition ${
                  escolhido
                    ? 'bg-marca-50 text-marca-800 ring-marca-500'
                    : 'bg-white text-slate-800 ring-black/10 hover:bg-marca-50/60'
                }`}
              >
                <span aria-hidden="true" className="text-lg">
                  {iconeDaRefeicao(tipo.nome)}
                </span>
                {tipo.nome}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-start gap-3">
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
        <CampoDeHorario
          ref={registrar('horario')}
          rotulo="Horário"
          name="horario"
          className="w-36"
          erro={errosPorCampo.horario}
          value={horario}
          onChange={setHorario}
        />
        {/* O mt compensa a altura do rótulo, alinhando o botão aos inputs. */}
        <Botao type="submit" carregando={enviando} className="sm:mt-6">
          Adicionar
        </Botao>
      </div>
    </form>
  );
}
