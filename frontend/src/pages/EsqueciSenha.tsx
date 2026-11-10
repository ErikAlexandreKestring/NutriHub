import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { AuthShell } from '@/layouts/AuthShell';
import { useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import { pedirRedefinicaoDeSenha } from '@/auth/contaApi';

const CAMPOS = ['email'] as const;

/**
 * "Esqueci minha senha" do nutricionista. O paciente não redefine por aqui:
 * quem gera o acesso dele é o nutricionista, com um novo link de acesso.
 */
export function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha } = useErrosDeFormulario(CAMPOS);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpar();
    setEnviando(true);
    try {
      const { mensagem } = await pedirRedefinicaoDeSenha(email.trim());
      setEnviado(mensagem);
    } catch (falha) {
      tratarFalha(falha, 'Não foi possível enviar o link. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthShell
      titulo="Esqueci minha senha"
      descricao="Informe o e-mail da sua conta de nutricionista e enviamos um link para criar uma senha nova."
      rodape={
        <>
          Lembrou a senha?{' '}
          <Link to="/entrar" className="link-texto">
            Entrar
          </Link>
        </>
      }
    >
      {enviado ? (
        <div className="space-y-4 text-sm text-slate-700">
          <Alerta tom="sucesso">{enviado}</Alerta>
          <p>O link vale por 1 hora. Se não encontrar o e-mail, confira a caixa de spam.</p>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate className="space-y-4">
          {erroGeral && <Alerta>{erroGeral}</Alerta>}
          <Campo
            ref={registrar('email')}
            rotulo="E-mail"
            type="email"
            autoCapitalize="none"
            spellCheck={false}
            name="email"
            autoComplete="username"
            required
            erro={errosPorCampo.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Botao type="submit" carregando={enviando} className="w-full">
            {enviando ? 'Enviando…' : 'Enviar link'}
          </Botao>
        </form>
      )}
      <p className="mt-6 text-sm text-slate-600">
        É paciente? Peça ao seu nutricionista um novo link de acesso: com ele você cria uma senha nova.
      </p>
    </AuthShell>
  );
}
