import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { Carregando } from '@/components/Estado';
import { AuthShell } from '@/layouts/AuthShell';
import { mensagemDeFalha } from '@/lib/useErrosDeFormulario';
import { INICIO_POR_PAPEL } from '@/auth/rotas';
import { reenviarConfirmacao } from '@/auth/contaApi';
import { apagarTokenDaBarra, lerTokenDoLink } from '@/auth/tokenDoLink';
import { useSessao } from '@/auth/useSessao';

const RODAPE = (
  <>
    Já confirmou?{' '}
    <Link to="/entrar" className="font-semibold text-marca-700 underline">
      Entrar
    </Link>
  </>
);

/**
 * Link do e-mail de confirmação do cadastro do nutricionista. Confirma assim
 * que a página abre e já entra; se o link venceu ou já foi usado, oferece
 * mandar outro.
 */
export function ConfirmarEmail() {
  const { confirmarEmail } = useSessao();
  const navegar = useNavigate();
  const [token] = useState(lerTokenDoLink);
  const [falha, setFalha] = useState<string | null>(null);
  // O link é de uso único, e o StrictMode roda o efeito duas vezes: sem esta
  // trava, a segunda chamada achava o link já usado e mostrava erro.
  const jaEnviou = useRef(false);

  useEffect(apagarTokenDaBarra, []);

  useEffect(() => {
    if (!token || jaEnviou.current) return;
    jaEnviou.current = true;

    confirmarEmail(token)
      .then((sessao) => navegar(INICIO_POR_PAPEL[sessao.papel], { replace: true }))
      .catch((erro) => setFalha(mensagemDeFalha(erro, 'Não foi possível confirmar o e-mail. Tente novamente.')));
  }, [token, confirmarEmail, navegar]);

  if (!token) {
    return (
      <AuthShell titulo="Link incompleto" descricao="Não encontramos o código de confirmação neste endereço." rodape={RODAPE}>
        <p className="text-sm text-slate-700">Abra o link exatamente como chegou no seu e-mail, ou peça outro abaixo.</p>
        <PedirNovoLink />
      </AuthShell>
    );
  }

  if (falha) {
    return (
      <AuthShell titulo="Não deu para confirmar" descricao="Este link de confirmação não vale mais." rodape={RODAPE}>
        <div className="space-y-4">
          <Alerta>{falha}</Alerta>
          <PedirNovoLink />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell titulo="Confirmando seu e-mail" descricao="Só um instante." rodape={RODAPE}>
      <Carregando rotulo="Confirmando…" />
    </AuthShell>
  );
}

function PedirNovoLink() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setResultado(null);
    setEnviando(true);
    try {
      const { mensagem } = await reenviarConfirmacao(email.trim());
      setResultado({ tom: 'sucesso', texto: mensagem });
    } catch (erro) {
      setResultado({ tom: 'erro', texto: mensagemDeFalha(erro, 'Não foi possível enviar. Tente novamente.') });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
      {resultado && <Alerta tom={resultado.tom}>{resultado.texto}</Alerta>}
      <Campo
        rotulo="E-mail do cadastro"
        type="email"
        autoCapitalize="none"
        spellCheck={false}
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Botao type="submit" carregando={enviando} className="w-full">
        Enviar novo link
      </Botao>
    </form>
  );
}
