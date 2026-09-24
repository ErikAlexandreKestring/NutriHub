import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { AuthShell } from '@/layouts/AuthShell';
import { useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import { INICIO_POR_PAPEL } from '@/auth/rotas';
import { useSessao } from '@/auth/useSessao';

const CAMPOS = ['senha', 'confirmacao'] as const;

/**
 * O link gerado pelo nutricionista traz o token no fragmento (#) — ver
 * `linkDePrimeiroAcesso`. Leitura pura: o StrictMode chama o inicializador do
 * useState duas vezes, e apagar o fragmento aqui fazia a segunda chamada não
 * achar mais o token.
 */
function lerTokenDoLink(): string {
  return window.location.hash.replace(/^#/, '');
}

/** RF-02: o paciente define a própria senha a partir do link do nutricionista. */
export function PrimeiroAcesso() {
  const { sessao, definirSenhaInicial, sair } = useSessao();
  const navegar = useNavigate();
  const [token] = useState(lerTokenDoLink);

  // Tira o token da barra de endereço para não ficar no histórico do navegador.
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  }, []);
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha, definirErrosDeCampo } =
    useErrosDeFormulario(CAMPOS);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpar();

    // A única regra checada aqui: o backend nunca vê a confirmação.
    if (senha !== confirmacao) {
      definirErrosDeCampo({ confirmacao: 'As senhas não conferem.' });
      return;
    }

    setEnviando(true);
    try {
      const nova = await definirSenhaInicial(token, senha);
      navegar(INICIO_POR_PAPEL[nova.papel], { replace: true });
    } catch (falha) {
      tratarFalha(falha, 'Não foi possível definir a senha. Tente novamente.');
      setEnviando(false);
    }
  }

  const rodape = (
    <>
      Já definiu sua senha?{' '}
      <Link to="/entrar" className="font-semibold text-marca-700 underline">
        Entrar
      </Link>
    </>
  );

  if (!token) {
    return (
      <AuthShell
        titulo="Link incompleto"
        descricao="Não encontramos o código de acesso neste endereço."
        rodape={rodape}
      >
        <p className="text-sm text-slate-700">
          Abra o link exatamente como seu nutricionista enviou. Se não funcionar, peça um novo link a ele.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Crie sua senha"
      descricao="Este é seu primeiro acesso. Escolha a senha que você vai usar para entrar no app."
      rodape={rodape}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        {/* Num aparelho compartilhado, seguir aqui troca a sessão aberta pela do
            paciente; avisar evita que alguém perca a sessão sem entender. */}
        {sessao && (
          <Alerta tom="aviso">
            Você está conectado como {sessao.nome}. Ao criar a senha, essa sessão será encerrada.{' '}
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
          dica="Pelo menos 8 caracteres."
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
          {enviando ? 'Salvando…' : 'Criar senha e entrar'}
        </Botao>
      </form>
    </AuthShell>
  );
}
