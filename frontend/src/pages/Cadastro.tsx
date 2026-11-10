import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { AuthShell } from '@/layouts/AuthShell';
import { useErrosDeFormulario } from '@/lib/useErrosDeFormulario';
import { INICIO_POR_PAPEL } from '@/auth/rotas';
import { useSessao } from '@/auth/useSessao';
import { mascararCelular, normalizarCrn, VALIDAR, type CampoDoCadastro } from '@/auth/validacaoCadastro';
import { ReenviarConfirmacao } from '@/auth/ReenviarConfirmacao';

const CAMPOS = ['nome', 'email', 'crn', 'telefone', 'senha'] as const satisfies readonly CampoDoCadastro[];

/** RF-01 / UC-00: cadastro do nutricionista. O tenant nasce junto (RN-06). */
export function Cadastro() {
  const { sessao, cadastrar } = useSessao();
  // Preenchido depois do cadastro: a conta existe, mas só entra quando o
  // nutricionista abrir o link enviado para este e-mail.
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [dados, setDados] = useState({ nome: '', email: '', crn: '', telefone: '', senha: '' });
  const [enviando, setEnviando] = useState(false);
  const { erroGeral, errosPorCampo, registrar, limpar, tratarFalha, definirErrosDeCampo, definirErroDoCampo } =
    useErrosDeFormulario(CAMPOS);

  if (sessao) {
    return <Navigate to={INICIO_POR_PAPEL[sessao.papel]} replace />;
  }

  if (enviadoPara) {
    return (
      <AuthShell
        titulo="Confirme seu e-mail"
        descricao="Sua conta foi criada. Falta só confirmar que o e-mail é seu."
        rodape={
          <>
            Já confirmou?{' '}
            <Link to="/entrar" className="link-texto">
              Entrar
            </Link>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            Enviamos um link para <strong className="text-slate-900">{enviadoPara}</strong>. Abra o e-mail e toque no
            link para ativar sua conta. Ele vale por 24 horas.
          </p>
          <p>Não chegou? Confira a caixa de spam ou peça outro link.</p>
          <ReenviarConfirmacao email={enviadoPara} />
        </div>
      </AuthShell>
    );
  }

  function alterar(campo: CampoDoCadastro, bruto: string) {
    const valor = campo === 'telefone' ? mascararCelular(bruto) : bruto;
    setDados((atual) => ({ ...atual, [campo]: valor }));
    // Com o erro na tela, ele some assim que o valor fica certo, sem esperar
    // o usuário sair do campo.
    if (errosPorCampo[campo]) definirErroDoCampo(campo, VALIDAR[campo](valor));
  }

  // Ao sair do campo. Vazio não acusa nada aqui: quem só passou pelo campo com
  // o Tab ainda vai preenchê-lo — o "Informe…" fica para o envio.
  function conferir(campo: CampoDoCadastro) {
    const valor = dados[campo];
    if (!valor.trim()) return;
    if (campo === 'crn') {
      const crn = normalizarCrn(valor);
      if (crn) setDados((atual) => ({ ...atual, crn }));
    }
    definirErroDoCampo(campo, VALIDAR[campo](valor));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    limpar();

    const erros = Object.fromEntries(
      CAMPOS.map((campo) => [campo, VALIDAR[campo](dados[campo])]).filter(([, erro]) => erro),
    ) as Partial<Record<CampoDoCadastro, string>>;
    if (Object.keys(erros).length > 0) {
      definirErrosDeCampo(erros);
      return;
    }

    setEnviando(true);
    try {
      const { email } = await cadastrar({
        ...dados,
        nome: dados.nome.trim().replace(/\s+/g, ' '),
        email: dados.email.trim(),
        crn: normalizarCrn(dados.crn) ?? dados.crn,
      });
      setEnviadoPara(email);
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
          <Link to="/entrar" className="link-texto">
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
          onBlur={() => conferir('nome')}
        />
        <Campo
          ref={registrar('email')}
          rotulo="E-mail"
          type="email"
          autoCapitalize="none"
          spellCheck={false}
          name="email"
          autoComplete="email"
          required
          erro={errosPorCampo.email}
          value={dados.email}
          onChange={(e) => alterar('email', e.target.value)}
          onBlur={() => conferir('email')}
        />
        <Campo
          ref={registrar('crn')}
          rotulo="CRN"
          name="crn"
          placeholder="CRN-10 12345"
          autoCapitalize="characters"
          required
          dica="Região e número do seu registro, ex.: CRN-10 12345."
          erro={errosPorCampo.crn}
          value={dados.crn}
          onChange={(e) => alterar('crn', e.target.value)}
          onBlur={() => conferir('crn')}
        />
        <Campo
          ref={registrar('telefone')}
          rotulo="Celular com WhatsApp"
          type="tel"
          name="telefone"
          autoComplete="tel"
          inputMode="tel"
          placeholder="(47) 99999-0000"
          required
          dica="Seus pacientes vão falar com você por este número, direto pelo app."
          erro={errosPorCampo.telefone}
          value={dados.telefone}
          onChange={(e) => alterar('telefone', e.target.value)}
          onBlur={() => conferir('telefone')}
        />
        <Campo
          ref={registrar('senha')}
          rotulo="Senha"
          type="password"
          name="senha"
          autoComplete="new-password"
          required
          dica="Pelo menos 8 caracteres, com letras e números."
          erro={errosPorCampo.senha}
          value={dados.senha}
          onChange={(e) => alterar('senha', e.target.value)}
          onBlur={() => conferir('senha')}
        />

        <Botao type="submit" carregando={enviando} className="w-full">
          {enviando ? 'Criando conta…' : 'Criar conta'}
        </Botao>
      </form>
    </AuthShell>
  );
}
