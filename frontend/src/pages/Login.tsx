import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { AuthShell } from '@/layouts/AuthShell';
import { useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import { INICIO_POR_PAPEL } from '@/auth/rotas';
import { useSessao } from '@/auth/useSessao';

/** Campos do formulário, na ordem em que aparecem — define quem recebe o foco. */
const CAMPOS = ['email', 'senha'] as const;

/** RF-02: login único — o backend decide o papel pelo e-mail e pela senha. */
export function Login() {
  const { sessao, entrar, expirou } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { erroGeral: erro, errosPorCampo, registrar, limpar, tratarFalha } = useErrosDeFormulario(CAMPOS);

  // Quem já está autenticado não tem o que fazer aqui.
  if (sessao) {
    return <Navigate to={INICIO_POR_PAPEL[sessao.papel]} replace />;
  }

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpar();
    setEnviando(true);

    try {
      const nova = await entrar(email, senha);
      const de = (local.state as { de?: string } | null)?.de;
      navegar(de ?? INICIO_POR_PAPEL[nova.papel], { replace: true });
    } catch (falha) {
      // A mensagem do backend em E-04 é deliberadamente genérica ("e-mail ou
      // senha inválidos") para não revelar quais e-mails existem; o hook a
      // repassa como veio, o que preserva essa decisão.
      tratarFalha(falha, 'Não foi possível entrar. Tente novamente.');
    } finally {
      // No `catch` apenas, o sucesso dependia de `navegar()` desmontar a tela
      // para destravar o botão; uma rota que devolvesse o usuário para cá
      // deixaria o formulário preso em "Entrando…" sem erro visível.
      setEnviando(false);
    }
  }

  return (
    <AuthShell
      titulo="Entrar"
      descricao="Acesse com o e-mail cadastrado no seu consultório."
      rodape={
        <>
          É nutricionista e ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-marca-700 underline">
            Cadastre-se
          </Link>
        </>
      }
    >
      <form onSubmit={aoEnviar} noValidate className="space-y-4">
        {expirou && !erro && <Alerta tom="aviso">Sua sessão expirou. Entre novamente.</Alerta>}
        {erro && <Alerta>{erro}</Alerta>}

        <Campo
          ref={registrar('email')}
          rotulo="E-mail"
          type="email"
          name="email"
          autoComplete="username"
          required
          erro={errosPorCampo.email}
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
        />

        <Campo
          ref={registrar('senha')}
          rotulo="Senha"
          type="password"
          name="senha"
          autoComplete="current-password"
          required
          erro={errosPorCampo.senha}
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
        />

        <Botao type="submit" carregando={enviando} className="w-full">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Botao>
      </form>
    </AuthShell>
  );
}
