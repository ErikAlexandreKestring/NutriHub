import { formatZonedDateTime } from '../../shared/utils/timezone';

/**
 * Textos das notificações por e-mail. Funções puras: recebem os dados já
 * carregados e devolvem o conteúdo pronto para a fila.
 */
export interface EmailContent {
  assunto: string;
  texto: string;
}

export type NotificationEvent =
  | 'FEEDBACK_REGISTRADO'
  | 'FEEDBACK_RESOLVIDO'
  | 'PLANO_PUBLICADO'
  | 'CONSULTA_AGENDADA'
  | 'CONSULTA_CANCELADA'
  | 'CONSULTA_REMARCADA'
  | 'NPS_SOLICITADO'
  | 'LEMBRETE_REFEICOES';

const ASSINATURA = '\n\n— Nutri-Hub';

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

// --- RF-09 / UC-07: pesquisa NPS ao fim de um ciclo de plano ---------------

export interface NpsSolicitadoDados {
  appUrl: string;
  pacienteNome: string;
  nutricionistaNome: string;
}

export function npsSolicitadoEmail(dados: NpsSolicitadoDados): EmailContent {
  return {
    assunto: `Como foi o seu acompanhamento com ${dados.nutricionistaNome}?`,
    texto:
      `Olá, ${primeiroNome(dados.pacienteNome)}!\n\n` +
      `Um ciclo do seu plano alimentar chegou ao fim. De 0 a 10, quanto você ` +
      `recomendaria ${dados.nutricionistaNome} a um amigo ou familiar?\n\n` +
      `Responder leva menos de um minuto: ${dados.appUrl}/avaliar` +
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


// --- RF-07: lembrete diário das refeições ainda não marcadas como feitas ----

export interface LembreteRefeicoesDados {
  appUrl: string;
  pacienteNome: string;
  /** Em ordem de horário; `horario` como o banco devolve (HH:MM ou HH:MM:SS). */
  refeicoes: { nome: string; horario: string }[];
}

export function lembreteRefeicoesEmail(dados: LembreteRefeicoesDados): EmailContent {
  const lista = dados.refeicoes.map((refeicao) => `• ${refeicao.horario.slice(0, 5)} — ${refeicao.nome}`).join('\n');
  const umaSo = dados.refeicoes.length === 1;
  return {
    assunto: umaSo ? 'Uma refeição de hoje ainda não foi marcada' : 'Refeições de hoje ainda não marcadas',
    texto:
      `Olá, ${primeiroNome(dados.pacienteNome)}!\n\n` +
      `${umaSo ? 'Esta refeição de hoje ainda não foi marcada' : 'Estas refeições de hoje ainda não foram marcadas'} como feita${umaSo ? '' : 's'}:\n\n` +
      `${lista}\n\n` +
      'Se você já comeu, marque no app para o seu nutricionista acompanhar o seu dia: ' +
      `${dados.appUrl}/meu-plano\n\n` +
      'Não quer mais receber este lembrete? Desligue em "Lembrete diário por e-mail", no fim da tela Meu plano.' +
      ASSINATURA,
  };
}
