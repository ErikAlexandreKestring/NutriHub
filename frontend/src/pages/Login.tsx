import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { AuthShell } from '@/layouts/AuthShell';
import { ErroDaApi, ErroDeRede } from '@/lib/api';
import { INICIO_POR_PAPEL } from '@/auth/rotas';
import { useSessao } from '@/auth/useSessao';

/** RF-02: login único — o backend decide o papel pelo e-mail e pela senha. */
export function Login() {
  const { sessao, entrar, expirou } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Quem já está autenticado não tem o que fazer aqui.
  if (sessao) {
    return <Navigate to={INICIO_POR_PAPEL[sessao.papel]} replace />;
  }

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const nova = await entrar(email, senha);
      const de = (local.state as { de?: string } | null)?.de;
      navegar(de ?? INICIO_POR_PAPEL[nova.papel], { replace: true });
    } catch (falha) {
      // A mensagem do backend em E-04 é deliberadamente genérica ("e-mail ou
      // senha inválidos") para não revelar quais e-mails existem; repassá-la
      // como veio preserva essa decisão.
      if (falha instanceof ErroDaApi || falha instanceof ErroDeRede) {
        setErro(falha.message);
      } else {
        setErro('Não foi possível entrar. Tente novamente.');
      }
      setEnviando(false);
    }
  }

  return (
    <AuthShell titulo="Entrar" descricao="Acesse com o e-mail cadastrado no seu consultório.">
      <form onSubmit={aoEnviar} noValidate className="space-y-4">
        {expirou && !erro && <Alerta tom="aviso">Sua sessão expirou. Entre novamente.</Alerta>}
        {erro && <Alerta>{erro}</Alerta>}

        <Campo
          rotulo="E-mail"
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
        />

        <Campo
          rotulo="Senha"
          type="password"
          name="senha"
          autoComplete="current-password"
          required
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
