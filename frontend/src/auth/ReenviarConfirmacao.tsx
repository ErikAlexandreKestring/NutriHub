import { useState } from 'react';
import { Botao } from '@/components/Botao';
import { mensagemDeFalha } from '@/lib/useErrosDeFormulario';
import { reenviarConfirmacao } from './contaApi';

/**
 * Botão "Reenviar e-mail de confirmação". Usado depois do cadastro e quando o
 * login esbarra num e-mail ainda não confirmado (E-25).
 */
export function ReenviarConfirmacao({ email }: { email: string }) {
  const [situacao, setSituacao] = useState<'parado' | 'enviando' | 'enviado'>('parado');
  const [erro, setErro] = useState<string | null>(null);

  async function reenviar() {
    setErro(null);
    setSituacao('enviando');
    try {
      await reenviarConfirmacao(email);
      setSituacao('enviado');
    } catch (falha) {
      setErro(mensagemDeFalha(falha, 'Não foi possível reenviar o e-mail. Tente novamente.'));
      setSituacao('parado');
    }
  }

  return (
    <div className="space-y-2">
      <Botao
        type="button"
        variante="secundario"
        className="w-full"
        onClick={reenviar}
        carregando={situacao === 'enviando'}
        disabled={situacao === 'enviado'}
      >
        {situacao === 'enviado' ? 'E-mail reenviado' : 'Reenviar e-mail de confirmação'}
      </Botao>
      {situacao === 'enviado' && (
        <p role="status" className="text-sm text-slate-600">
          Enviamos um novo link para {email}. Ele vale por 24 horas.
        </p>
      )}
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
    </div>
  );
}
