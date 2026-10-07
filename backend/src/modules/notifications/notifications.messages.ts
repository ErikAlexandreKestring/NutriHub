import { formatZonedDateTime } from '../../shared/utils/timezone';

/**
 * Textos das notificações. Funções puras: recebem os dados já carregados e
 * devolvem o conteúdo pronto para a fila.
 *
 * WhatsApp (RN-04): cada `template` abaixo precisa existir e estar aprovado na
 * conta do WhatsApp Business, com o mesmo nome, idioma pt_BR e a mesma
 * quantidade de variáveis ({{1}}, {{2}}, ...) na ordem de `parametros`. O texto
 * sugerido para cadastrar cada um está no comentário ao lado.
 */
export interface EmailContent {
  assunto: string;
  texto: string;
}

export interface WhatsAppContent {
  template: string;
  parametros: string[];
}

export type NotificationEvent =
  | 'FEEDBACK_REGISTRADO'
  | 'FEEDBACK_RESOLVIDO'
  | 'PLANO_PUBLICADO'
  | 'CONSULTA_AGENDADA'
  | 'CONSULTA_CANCELADA'
  | 'CONSULTA_REMARCADA';

const ASSINATURA = '\n\n— Nutri-Hub';
const MAX_PARAMETRO = 200;

/**
 * A Meta recusa variável de template com quebra de linha, tabulação ou mais
 * de quatro espaços seguidos — e o relato do paciente é texto livre.
 */
function parametro(texto: string): string {
  const plano = texto.replace(/\s+/g, ' ').trim();
  return plano.length > MAX_PARAMETRO ? `${plano.slice(0, MAX_PARAMETRO - 1)}…` : plano;
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0];
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// --- RF-06, fluxo 3.5 passo 4: alerta de feedback ao nutricionista ---------

export interface FeedbackRegistradoDados {
  appUrl: string;
  pacienteId: string;
  pacienteNome: string;
  refeicao: string | null;
  descricao: string;
}

export function feedbackRegistradoEmail(dados: FeedbackRegistradoDados): EmailContent {
  const onde = dados.refeicao ? ` sobre a refeição "${dados.refeicao}"` : '';
  return {
    assunto: `Novo feedback de ${dados.pacienteNome}`,
    texto:
      `${dados.pacienteNome} relatou uma dificuldade com o plano alimentar${onde}:\n\n` +
      `"${dados.descricao}"\n\n` +
      `Veja o paciente no Nutri-Hub: ${dados.appUrl}/pacientes/${dados.pacienteId}` +
      ASSINATURA,
  };
}

// Template feedback_registrado:
// "{{1}} relatou uma dificuldade com o plano alimentar ({{2}}): {{3}}. Acesse o Nutri-Hub para ajustar o plano."
export function feedbackRegistradoWhatsApp(dados: FeedbackRegistradoDados): WhatsAppContent {
  return {
    template: 'feedback_registrado',
    parametros: [
      parametro(dados.pacienteNome),
      parametro(dados.refeicao ?? 'plano em geral'),
      parametro(dados.descricao),
    ],
  };
}

// --- Fluxo 3.5 passo 6: feedback resolvido, aviso ao paciente ---------------

export interface FeedbackResolvidoDados {
  appUrl: string;
  pacienteNome: string;
  nutricionistaNome: string;
  resposta: string | null;
}

export function feedbackResolvidoEmail(dados: FeedbackResolvidoDados): EmailContent {
  const resposta = dados.resposta
    ? `Resposta do(a) nutricionista:\n\n"${dados.resposta}"\n\n`
    : '';
  return {
    assunto: 'Seu relato foi respondido',
    texto:
      `Olá, ${primeiroNome(dados.pacienteNome)}!\n\n` +
      `${dados.nutricionistaNome} analisou a dificuldade que você relatou.\n\n` +
      resposta +
      `Confira o seu plano: ${dados.appUrl}/meu-plano` +
      ASSINATURA,
  };
}

// Template feedback_resolvido:
// "Olá, {{1}}! {{2}} analisou a dificuldade que você relatou: {{3}}"
export function feedbackResolvidoWhatsApp(dados: FeedbackResolvidoDados): WhatsAppContent {
  return {
    template: 'feedback_resolvido',
    parametros: [
      parametro(primeiroNome(dados.pacienteNome)),
      parametro(dados.nutricionistaNome),
      parametro(dados.resposta ?? 'confira o seu plano no Nutri-Hub'),
    ],
  };
}

// --- RF-07 / fluxo 3.3 passo 8: novo plano disponível (UC-06) ---------------

export interface PlanoPublicadoDados {
  appUrl: string;
  pacienteNome: string;
  nutricionistaNome: string;
}

export function planoPublicadoEmail(dados: PlanoPublicadoDados): EmailContent {
  return {
    assunto: 'Seu novo plano alimentar está disponível',
    texto:
      `Olá, ${primeiroNome(dados.pacienteNome)}!\n\n` +
      `${dados.nutricionistaNome} publicou um novo plano alimentar para você.\n\n` +
      `Acesse: ${dados.appUrl}/meu-plano` +
      ASSINATURA,
  };
}

// Template novo_plano_disponivel:
// "Olá, {{1}}! {{2}} publicou o seu novo plano alimentar. Acesse: {{3}}"
export function planoPublicadoWhatsApp(dados: PlanoPublicadoDados): WhatsAppContent {
  return {
    template: 'novo_plano_disponivel',
    parametros: [
      parametro(primeiroNome(dados.pacienteNome)),
      parametro(dados.nutricionistaNome),
      `${dados.appUrl}/meu-plano`,
    ],
  };
}

/** E-09: canal alternativo quando o WhatsApp do novo plano falha. */
export function planoPublicadoFalhaWhatsAppEmail(dados: PlanoPublicadoDados): EmailContent {
  return {
    assunto: `Não foi possível avisar ${dados.pacienteNome} pelo WhatsApp`,
    texto:
      `O aviso de novo plano alimentar para ${dados.pacienteNome} não pôde ser entregue pelo WhatsApp. ` +
      'O paciente também foi avisado por e-mail, e o WhatsApp será tentado novamente em alguns minutos.\n\n' +
      'Se o problema continuar, confira o telefone cadastrado do paciente.' +
      ASSINATURA,
  };
}

// --- RF-08 / RF-11 / RF-12: agenda ------------------------------------------

export type Destinatario = 'nutricionista' | 'paciente';

export interface ConsultaDados {
  appUrl: string;
  pacienteNome: string;
  nutricionistaNome: string;
  dataHora: Date;
}

function linkDaAgenda(appUrl: string, para: Destinatario): string {
  return para === 'nutricionista' ? `${appUrl}/agenda` : `${appUrl}/minhas-consultas`;
}

function saudacao(dados: ConsultaDados, para: Destinatario): string {
  return para === 'nutricionista' ? 'Olá!' : `Olá, ${primeiroNome(dados.pacienteNome)}!`;
}

/** "a consulta de Maria" para o nutricionista, "sua consulta com Eridiane" para o paciente. */
function qualConsulta(dados: ConsultaDados, para: Destinatario): string {
  return para === 'nutricionista'
    ? `a consulta de ${dados.pacienteNome}`
    : `sua consulta com ${dados.nutricionistaNome}`;
}

export function consultaAgendadaEmail(dados: ConsultaDados, para: Destinatario): EmailContent {
  const quando = formatZonedDateTime(dados.dataHora);
  return {
    assunto: para === 'nutricionista' ? `Nova consulta: ${dados.pacienteNome}` : 'Consulta confirmada',
    texto:
      `${saudacao(dados, para)}\n\n` +
      `${capitalizar(qualConsulta(dados, para))} está confirmada para ${quando}.\n\n` +
      `Veja a agenda: ${linkDaAgenda(dados.appUrl, para)}` +
      ASSINATURA,
  };
}

// Template consulta_confirmada:
// "Olá, {{1}}! Sua consulta com {{2}} está confirmada para {{3}}."
export function consultaAgendadaWhatsApp(dados: ConsultaDados): WhatsAppContent {
  return {
    template: 'consulta_confirmada',
    parametros: [
      parametro(primeiroNome(dados.pacienteNome)),
      parametro(dados.nutricionistaNome),
      formatZonedDateTime(dados.dataHora),
    ],
  };
}

export function consultaCanceladaEmail(dados: ConsultaDados, para: Destinatario): EmailContent {
  const quando = formatZonedDateTime(dados.dataHora);
  const quem = para === 'nutricionista' ? dados.pacienteNome : dados.nutricionistaNome;
  return {
    assunto: para === 'nutricionista' ? `Consulta cancelada: ${dados.pacienteNome}` : 'Consulta cancelada',
    texto:
      `${saudacao(dados, para)}\n\n` +
      `${quem} cancelou ${para === 'nutricionista' ? 'a consulta' : 'a sua consulta'} de ${quando}. ` +
      'O horário foi liberado na agenda.\n\n' +
      `Veja a agenda: ${linkDaAgenda(dados.appUrl, para)}` +
      ASSINATURA,
  };
}

// Template consulta_cancelada:
// "Olá, {{1}}! {{2}} cancelou a sua consulta de {{3}}. Para remarcar, acesse o Nutri-Hub."
export function consultaCanceladaWhatsApp(dados: ConsultaDados): WhatsAppContent {
  return {
    template: 'consulta_cancelada',
    parametros: [
      parametro(primeiroNome(dados.pacienteNome)),
      parametro(dados.nutricionistaNome),
      formatZonedDateTime(dados.dataHora),
    ],
  };
}

export interface ConsultaRemarcadaDados extends ConsultaDados {
  dataHoraAnterior: Date;
}

export function consultaRemarcadaEmail(dados: ConsultaRemarcadaDados, para: Destinatario): EmailContent {
  const antes = formatZonedDateTime(dados.dataHoraAnterior);
  const depois = formatZonedDateTime(dados.dataHora);
  return {
    assunto: para === 'nutricionista' ? `Consulta remarcada: ${dados.pacienteNome}` : 'Consulta remarcada',
    texto:
      `${saudacao(dados, para)}\n\n` +
      `${capitalizar(qualConsulta(dados, para))} foi remarcada.\n\n` +
      `Antes: ${antes}\nAgora: ${depois}\n\n` +
      `Veja a agenda: ${linkDaAgenda(dados.appUrl, para)}` +
      ASSINATURA,
  };
}

// Template consulta_remarcada:
// "Olá, {{1}}! {{2}} foi remarcada de {{3}} para {{4}}."
// Serve aos dois lados: {{1}} é quem recebe, {{2}} diz de qual consulta se trata.
export function consultaRemarcadaWhatsApp(dados: ConsultaRemarcadaDados, para: Destinatario): WhatsAppContent {
  return {
    template: 'consulta_remarcada',
    parametros: [
      parametro(primeiroNome(para === 'nutricionista' ? dados.nutricionistaNome : dados.pacienteNome)),
      parametro(capitalizar(qualConsulta(dados, para))),
      formatZonedDateTime(dados.dataHoraAnterior),
      formatZonedDateTime(dados.dataHora),
    ],
  };
}
