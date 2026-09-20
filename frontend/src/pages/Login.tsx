import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { AuthShell } from '@/layouts/AuthShell';
import { ErroDaApi, ErroDeRede, type ProblemaDeCampo } from '@/lib/api';
import { INICIO_POR_PAPEL } from '@/auth/rotas';
import { useSessao } from '@/auth/useSessao';

/** Campos do formulário, na ordem em que aparecem — define quem recebe o foco. */
const CAMPOS = ['email', 'senha'] as const;
type NomeDeCampo = (typeof CAMPOS)[number];

type ErrosPorCampo = Partial<Record<NomeDeCampo, string>>;

function ehCampoConhecido(campo: string): campo is NomeDeCampo {
  return (CAMPOS as readonly string[]).includes(campo);
}

/**
 * O backend responde `issues: [{ path, message }]` e o `api.ts` já traduz isso
 * para `problemas`. Um `path` que não corresponde a nenhum input (ou um campo
 * que o backend venha a acrescentar) não pode sumir da tela, então o que sobra
 * continua indo para a faixa de erro geral.
 */
function separarProblemas(problemas: ProblemaDeCampo[]): { porCampo: ErrosPorCampo; restantes: string[] } {
  const porCampo: ErrosPorCampo = {};
  const restantes: string[] = [];

  for (const problema of problemas) {
    if (ehCampoConhecido(problema.campo) && !porCampo[problema.campo]) {
      porCampo[problema.campo] = problema.mensagem;
    } else {
      restantes.push(problema.mensagem);
    }
  }

  return { porCampo, restantes };
}

/** RF-02: login único — o backend decide o papel pelo e-mail e pela senha. */
export function Login() {
  const { sessao, entrar, expirou } = useSessao();
  const navegar = useNavigate();
  const local = useLocation();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [errosPorCampo, setErrosPorCampo] = useState<ErrosPorCampo>({});
  const [enviando, setEnviando] = useState(false);

  const referencias: Record<NomeDeCampo, React.RefObject<HTMLInputElement>> = {
    email: useRef<HTMLInputElement>(null),
    senha: useRef<HTMLInputElement>(null),
  };

  // Quem já está autenticado não tem o que fazer aqui.
  if (sessao) {
    return <Navigate to={INICIO_POR_PAPEL[sessao.papel]} replace />;
  }

  function tratarFalha(falha: unknown) {
    if (falha instanceof ErroDaApi) {
      // RNF-08: erro de validação pertence ao campo que o causou — só a faixa
      // genérica no topo deixaria o usuário caçando qual input corrigir.
      if (falha.problemas?.length) {
        const { porCampo, restantes } = separarProblemas(falha.problemas);
        setErrosPorCampo(porCampo);
        setErro(restantes.length > 0 ? restantes.join(' ') : null);

        const primeiro = CAMPOS.find((campo) => porCampo[campo]);
        if (primeiro) {
          referencias[primeiro].current?.focus();
        }

        // Sai aqui mesmo quando nenhum problema casou com um campo da tela:
        // cair no `falha.message` abaixo trocaria "CRN inválido" pelo
        // "Dados inválidos" genérico do backend.
        return;
      }

      // A mensagem do backend em E-04 é deliberadamente genérica ("e-mail ou
      // senha inválidos") para não revelar quais e-mails existem; repassá-la
      // como veio preserva essa decisão.
      setErro(falha.message);
      return;
    }

    if (falha instanceof ErroDeRede) {
      setErro(falha.message);
      return;
    }

    setErro('Não foi possível entrar. Tente novamente.');
  }

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setErrosPorCampo({});
    setEnviando(true);

    try {
      const nova = await entrar(email, senha);
      const de = (local.state as { de?: string } | null)?.de;
      navegar(de ?? INICIO_POR_PAPEL[nova.papel], { replace: true });
    } catch (falha) {
      tratarFalha(falha);
    } finally {
      // No `catch` apenas, o sucesso dependia de `navegar()` desmontar a tela
      // para destravar o botão; uma rota que devolvesse o usuário para cá
      // deixaria o formulário preso em "Entrando…" sem erro visível.
      setEnviando(false);
    }
  }

  return (
    <AuthShell titulo="Entrar" descricao="Acesse com o e-mail cadastrado no seu consultório.">
      <form onSubmit={aoEnviar} noValidate className="space-y-4">
        {expirou && !erro && <Alerta tom="aviso">Sua sessão expirou. Entre novamente.</Alerta>}
        {erro && <Alerta>{erro}</Alerta>}

        <Campo
          ref={referencias.email}
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
          ref={referencias.senha}
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
