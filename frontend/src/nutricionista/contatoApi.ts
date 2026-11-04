import { chamarApi } from '@/lib/api';

/** RF-07: o que o paciente precisa para abrir a conversa com o nutricionista. */
export interface ContatoDoNutricionista {
  nome: string;
  /** Só dígitos, com DDI. null em conta anterior ao celular obrigatório no cadastro. */
  whatsapp: string | null;
}

export function buscarContatoDoNutricionista(patientId: string, sinal?: AbortSignal): Promise<ContatoDoNutricionista> {
  return chamarApi<ContatoDoNutricionista>(`/patients/${patientId}/nutricionista`, { sinal });
}

/**
 * Link direto do WhatsApp (wa.me): abre a conversa no app do celular ou no
 * WhatsApp Web, já com a mensagem digitada, sem WhatsApp Business API nem
 * aprovação da Meta.
 */
export function linkDoWhatsApp(numero: string, mensagem: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
