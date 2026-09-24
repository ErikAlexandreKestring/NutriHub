import { useState, type FormEvent } from 'react';
import { Alerta } from '@/components/Alerta';
import { AreaDeTexto } from '@/components/AreaDeTexto';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { hojeSemHora } from '@/lib/formato';
import { useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import type { DadosDoPaciente } from './tipos';

const CAMPOS = ['nome', 'email', 'data_nascimento', 'contato', 'historico'] as const;

const VAZIO: DadosDoPaciente = { nome: '', email: '', data_nascimento: '', contato: '', historico: '' };

interface Props {
  inicial?: DadosDoPaciente;
  rotuloEnviar: string;
  /** Deve lançar em caso de falha — o formulário mostra o erro no campo certo. */
  aoEnviar: (dados: DadosDoPaciente) => Promise<void>;
  aoCancelar: () => void;
}

/**
 * RF-03: "nome, data de nascimento, contato e histórico". A validação é a do
 * backend — repeti-la aqui criaria duas regras que um dia divergem; o que o
 * servidor recusar volta como erro no campo correspondente.
 */
export function FormularioDePaciente({ inicial = VAZIO, rotuloEnviar, aoEnviar, aoCancelar }: Props) {
  const [dados, setDados] = useState<DadosDoPaciente>(inicial);
  const [enviando, setEnviando] = useState(false);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha } = useErrosDeFormulario(CAMPOS);

  function alterar(campo: keyof DadosDoPaciente, valor: string) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpar();
    setEnviando(true);
    try {
      await aoEnviar(dados);
    } catch (falha) {
      tratarFalha(falha, 'Não foi possível salvar o paciente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4 rounded-xl bg-white p-6 ring-1 ring-slate-200">
      {erroGeral && <Alerta>{erroGeral}</Alerta>}

      <Campo
        ref={registrar('nome')}
        rotulo="Nome completo"
        name="nome"
        autoComplete="off"
        required
        erro={errosPorCampo.nome}
        value={dados.nome}
        onChange={(e) => alterar('nome', e.target.value)}
      />

      <Campo
        ref={registrar('email')}
        rotulo="E-mail"
        type="email"
        name="email"
        autoComplete="off"
        required
        erro={errosPorCampo.email}
        dica="É com este e-mail que o paciente vai entrar no app."
        value={dados.email}
        onChange={(e) => alterar('email', e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          ref={registrar('data_nascimento')}
          rotulo="Data de nascimento"
          type="date"
          name="data_nascimento"
          max={hojeSemHora()}
          required
          erro={errosPorCampo.data_nascimento}
          value={dados.data_nascimento}
          onChange={(e) => alterar('data_nascimento', e.target.value)}
        />

        <Campo
          ref={registrar('contato')}
          rotulo="Contato (opcional)"
          type="tel"
          name="contato"
          maxLength={20}
          placeholder="(47) 99999-9999"
          erro={errosPorCampo.contato}
          value={dados.contato}
          onChange={(e) => alterar('contato', e.target.value)}
        />
      </div>

      <AreaDeTexto
        ref={registrar('historico')}
        rotulo="Histórico (opcional)"
        name="historico"
        rows={5}
        dica="Anamnese, restrições, alergias e observações clínicas."
        erro={errosPorCampo.historico}
        value={dados.historico}
        onChange={(e) => alterar('historico', e.target.value)}
      />

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Botao type="button" variante="secundario" onClick={aoCancelar} disabled={enviando}>
          Cancelar
        </Botao>
        <Botao type="submit" carregando={enviando}>
          {rotuloEnviar}
        </Botao>
      </div>
    </form>
  );
}
