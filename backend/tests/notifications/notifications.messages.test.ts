import {
  consultaCanceladaEmail,
  consultaRemarcadaEmail,
  feedbackRegistradoEmail,
  lembreteRefeicoesEmail,
} from '../../src/modules/notifications/notifications.messages';

describe('notifications.messages', () => {
  const feedback = {
    appUrl: 'https://app.nutrihub.com',
    pacienteId: 'patient-1',
    pacienteNome: 'Maria da Silva',
    refeicao: null,
    descricao: 'Tenho alergia a amendoim.\n\nO lanche da tarde tem pasta de amendoim.',
  };

  it('o e-mail mantém o relato como foi escrito e leva o link do paciente', () => {
    const { texto } = feedbackRegistradoEmail(feedback);

    expect(texto).toContain(feedback.descricao);
    expect(texto).toContain('https://app.nutrihub.com/pacientes/patient-1');
  });

  const consulta = {
    appUrl: 'https://app.nutrihub.com',
    pacienteNome: 'Maria da Silva',
    nutricionistaNome: 'Eridiane Kestring',
    dataHora: new Date('2026-10-14T12:00:00Z'),
  };

  it('fala com cada parte do seu ponto de vista', () => {
    // Cancelamento: quem recebe é sempre a outra parte (RF-11).
    expect(consultaCanceladaEmail(consulta, 'nutricionista').texto).toContain(
      'Maria da Silva cancelou a consulta de quarta-feira, 14/10 às 09:00.',
    );
    expect(consultaCanceladaEmail(consulta, 'paciente').texto).toContain(
      'Eridiane Kestring cancelou a sua consulta de quarta-feira, 14/10 às 09:00.',
    );
  });

  it('a remarcação mostra o horário antigo e o novo, com link para a agenda de cada um', () => {
    const dados = { ...consulta, dataHoraAnterior: new Date('2026-10-13T13:00:00Z') };

    const paraPaciente = consultaRemarcadaEmail(dados, 'paciente').texto;
    expect(paraPaciente).toContain('Sua consulta com Eridiane Kestring foi remarcada');
    expect(paraPaciente).toContain('Antes: terça-feira, 13/10 às 10:00');
    expect(paraPaciente).toContain('Agora: quarta-feira, 14/10 às 09:00');
    expect(paraPaciente).toContain('https://app.nutrihub.com/minhas-consultas');

    expect(consultaRemarcadaEmail(dados, 'nutricionista').texto).toContain('https://app.nutrihub.com/agenda');
  });

  describe('lembrete diário de refeições (RF-07)', () => {
    it('lista as refeições pendentes com a hora, o link do plano e como desligar', () => {
      const email = lembreteRefeicoesEmail({
        appUrl: 'https://app.nutrihub.com',
        pacienteNome: 'Maria da Silva',
        refeicoes: [
          { nome: 'Café da manhã', horario: '07:30:00' },
          { nome: 'Almoço', horario: '12:00:00' },
        ],
      });

      expect(email.assunto).toBe('Refeições de hoje ainda não marcadas');
      expect(email.texto).toContain('Olá, Maria!');
      expect(email.texto).toContain('• 07:30 — Café da manhã\n• 12:00 — Almoço');
      expect(email.texto).toContain('https://app.nutrihub.com/meu-plano');
      expect(email.texto).toContain('Lembrete diário por e-mail');
    });

    it('usa o singular quando só uma refeição está pendente', () => {
      const email = lembreteRefeicoesEmail({
        appUrl: 'https://app.nutrihub.com',
        pacienteNome: 'Maria',
        refeicoes: [{ nome: 'Lanche', horario: '15:00' }],
      });

      expect(email.assunto).toBe('Uma refeição de hoje ainda não foi marcada');
      expect(email.texto).toContain('Esta refeição de hoje ainda não foi marcada como feita:');
    });
  });
});
