import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { AuthShell } from '@/layouts/AuthShell';
import { useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import { INICIO_POR_PAPEL } from '@/auth/rotas';
import { apagarTokenDaBarra, lerTokenDoLink } from '@/auth/tokenDoLink';
import { useSessao } from '@/auth/useSessao';
import { validarSenha } from '@/auth/validacaoCadastro';

const CAMPOS = ['senha', 'confirmacao'] as const;

/** Link do e-mail de "esqueci minha senha": o nutricionista cria a senha nova e já entra. */
export function RedefinirSenha() {
  const { sessao, redefinirSenha, sair } = useSessao();
  const navegar = useNavigate();
  const [token] = useState(lerTokenDoLink);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha, definirErrosDeCampo } =
    useErrosDeFormulario(CAMPOS);

  useEffect(apagarTokenDaBarra, []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpar();

    // Mesma regra do cadastro; a confirmação o backend nunca vê.
    const erroDaSenha = validarSenha(senha);
    if (erroDaSenha || senha !== confirmacao) {
      definirErrosDeCampo(
        erroDaSenha ? { senha: erroDaSenha } : { confirmacao: 'As senhas não conferem.' },
      );
      return;
    }

    setEnviando(true);
    try {
      const nova = await redefinirSenha(token, senha);
      navegar(INICIO_POR_PAPEL[nova.papel], { replace: true });
    } catch (falha) {
      tratarFalha(falha, 'Não foi possível salvar a senha. Tente novamente.');
      setEnviando(false);
    }
  }

  const rodape = (
    <>
      O link venceu?{' '}
      <Link to="/esqueci-senha" className="link-texto">
        Pedir outro
      </Link>
    </>
  );

  if (!token) {
    return (
      <AuthShell titulo="Link incompleto" descricao="Não encontramos o código de redefinição neste endereço." rodape={rodape}>
        <p className="text-sm text-slate-700">Abra o link exatamente como chegou no seu e-mail, ou peça outro.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell titulo="Crie uma senha nova" descricao="Escolha a senha que você vai usar para entrar." rodape={rodape}>
      <form onSubmit={enviar} noValidate className="space-y-4">
        {sessao && (
          <Alerta tom="aviso">
            Você está conectado como {sessao.nome}. Ao salvar a senha, essa sessão será encerrada.{' '}
            <button type="button" className="font-semibold underline" onClick={sair}>
              Sair agora
            </button>
          </Alerta>
        )}
        {erroGeral && <Alerta>{erroGeral}</Alerta>}

        <Campo
          ref={registrar('senha')}
          rotulo="Nova senha"
          type="password"
          name="senha"
          autoComplete="new-password"
          required
          dica="Pelo menos 8 caracteres, com letras e números."
          erro={errosPorCampo.senha}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <Campo
          ref={registrar('confirmacao')}
          rotulo="Repita a senha"
          type="password"
          name="confirmacao"
          autoComplete="new-password"
          required
          erro={errosPorCampo.confirmacao}
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
        />

        <Botao type="submit" carregando={enviando} className="w-full">
          {enviando ? 'Salvando…' : 'Salvar senha e entrar'}
        </Botao>
      </form>
    </AuthShell>
  );
}
