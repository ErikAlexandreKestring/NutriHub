import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { AuthShell } from '@/layouts/AuthShell';
import { useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import { INICIO_POR_PAPEL } from '@/auth/rotas';
import { useSessao } from '@/auth/useSessao';

const CAMPOS = ['nome', 'email', 'crn', 'senha'] as const;

/** RF-01 / UC-00: cadastro do nutricionista. O tenant nasce junto (RN-06). */
export function Cadastro() {
  const { sessao, cadastrar } = useSessao();
  const navegar = useNavigate();
  const [dados, setDados] = useState({ nome: '', email: '', crn: '', senha: '' });
  const [enviando, setEnviando] = useState(false);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha } = useErrosDeFormulario(CAMPOS);

  if (sessao) {
    return <Navigate to={INICIO_POR_PAPEL[sessao.papel]} replace />;
  }

  function alterar(campo: keyof typeof dados, valor: string) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpar();
    setEnviando(true);
    try {
      const nova = await cadastrar(dados);
      navegar(INICIO_POR_PAPEL[nova.papel], { replace: true });
    } catch (falha) {
      tratarFalha(falha, 'Não foi possível criar a conta. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthShell
      titulo="Criar conta"
      descricao="Cadastro para nutricionistas. Seus pacientes recebem o acesso por você."
      rodape={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-semibold text-marca-700 underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        {erroGeral && <Alerta>{erroGeral}</Alerta>}

        <Campo
          ref={registrar('nome')}
          rotulo="Nome completo"
          name="nome"
          autoComplete="name"
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
          autoComplete="email"
          required
          erro={errosPorCampo.email}
          value={dados.email}
          onChange={(e) => alterar('email', e.target.value)}
        />
        <Campo
          ref={registrar('crn')}
          rotulo="CRN"
          name="crn"
          placeholder="CRN-10 12345"
          required
          erro={errosPorCampo.crn}
          value={dados.crn}
          onChange={(e) => alterar('crn', e.target.value)}
        />
        <Campo
          ref={registrar('senha')}
          rotulo="Senha"
          type="password"
          name="senha"
          autoComplete="new-password"
          required
          dica="Pelo menos 8 caracteres."
          erro={errosPorCampo.senha}
          value={dados.senha}
          onChange={(e) => alterar('senha', e.target.value)}
        />

        <Botao type="submit" carregando={enviando} className="w-full">
          {enviando ? 'Criando conta…' : 'Criar conta'}
        </Botao>
      </form>
    </AuthShell>
  );
}
