import { Icone } from '@/components/Icone';
import { useRecurso } from '@/lib/useRecurso';
import { buscarContatoDoNutricionista, linkDoWhatsApp } from './contatoApi';

interface FalarNoWhatsAppProps {
  patientId: string;
  /** Texto já digitado na conversa, para o nutricionista saber de onde veio. */
  mensagem: string;
}

/**
 * RF-07: atalho do paciente para a conversa com o nutricionista no WhatsApp.
 *
 * É um complemento da tela, não o conteúdo dela: enquanto carrega, se a
 * requisição falhar ou se o nutricionista não tiver celular cadastrado, o
 * componente simplesmente não aparece — o paciente continua com o feedback
 * (RF-06) para falar com ele.
 */
export function FalarNoWhatsApp({ patientId, mensagem }: FalarNoWhatsAppProps) {
  const { estado } = useRecurso(`contato-do-nutricionista:${patientId}`, (sinal) =>
    buscarContatoDoNutricionista(patientId, sinal),
  );

  if (estado.situacao !== 'pronto' || !estado.dados.whatsapp) return null;
  const contato = { nome: estado.dados.nome, whatsapp: estado.dados.whatsapp };

  return (
    <a
      href={linkDoWhatsApp(contato.whatsapp, mensagem)}
      // Fora da PWA: no celular o sistema entrega o link ao app do WhatsApp.
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-toque items-center justify-between gap-3 rounded-2xl bg-white px-4 py-4 font-medium text-marca-700 ring-1 ring-inset ring-marca-200 hover:bg-marca-50"
    >
      <span className="flex items-center gap-3">
        <Icone nome="balao" className="h-5 w-5 shrink-0" />
        <span>
          Falar com {contato.nome} no WhatsApp
          <span className="sr-only"> (abre o WhatsApp)</span>
        </span>
      </span>
      <Icone nome="seta" className="h-5 w-5 shrink-0" />
    </a>
  );
}
