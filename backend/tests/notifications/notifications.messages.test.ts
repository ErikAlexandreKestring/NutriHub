import {
  consultaCanceladaEmail,
  consultaRemarcadaEmail,
  feedbackRegistradoEmail,
  feedbackRegistradoWhatsApp,
} from '../../src/modules/notifications/notifications.messages';

describe('notifications.messages', () => {
  const feedback = {
    appUrl: 'https://app.nutrihub.com',
    pacienteId: 'patient-1',
    pacienteNome: 'Maria da Silva',
    refeicao: null,
    descricao: 'Tenho alergia a amendoim.\n\nO lanche da tarde tem pasta de amendoim.',
  };

  it('achata quebras de linha nos parâmetros do template (a Meta recusa)', () => {
    const { parametros } = feedbackRegistradoWhatsApp(feedback);

    expect(parametros).toEqual([
      'Maria da Silva',
      'plano em geral',
      'Tenho alergia a amendoim. O lanche da tarde tem pasta de amendoim.',
    ]);
  });

  it('corta parâmetros longos em 200 caracteres', () => {
    const { parametros } = feedbackRegistradoWhatsApp({ ...feedback, descricao: 'a'.repeat(500) });

    expect(parametros[2]).toHaveLength(200);
    expect(parametros[2].endsWith('…')).toBe(true);
  });

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
});
