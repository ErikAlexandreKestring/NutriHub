import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  db: {
    host: required('DB_HOST', 'localhost'),
    port: Number(process.env.DB_PORT ?? 5432),
    user: required('DB_USER', 'postgres'),
    password: required('DB_PASSWORD', 'postgres'),
    database: required('DB_NAME', 'nutrihub'),
    ssl: process.env.DB_SSL === 'true',
    // Papel sem privilégio de superusuário, usado pela aplicação em tempo de
    // execução — necessário para o RLS (RN-01) ser de fato aplicado (ver
    // migration create_app_role e db/connection.ts).
    appUser: required('DB_APP_USER', 'nutrihub_app'),
    appPassword: required('DB_APP_PASSWORD', 'nutrihub_app_dev_password'),
  },

  jwt: {
    secret: required('JWT_SECRET', 'dev-secret-nao-use-em-producao'),
    expiresInNutricionista: process.env.JWT_EXPIRES_IN_NUTRICIONISTA ?? '8h',
    expiresInPaciente: process.env.JWT_EXPIRES_IN_PACIENTE ?? '24h',
  },

  bcrypt: {
    saltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),
  },

  // RF-06 / RF-07: módulo de notificações (ver modules/notifications).
  notifications: {
    // O worker roda no mesmo processo da API (Monolito Modular, RFC seção 5).
    // `off` desliga — útil para subir uma instância só de API.
    workerEnabled: process.env.NOTIFICATIONS_WORKER !== 'off',
    // RF-06 pede o alerta em até 30 s: o worker varre a fila bem abaixo disso.
    pollIntervalMs: Number(process.env.NOTIFICATIONS_POLL_MS ?? 5000),
    // Endereço do PWA, usado nos links das mensagens.
    appUrl: (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
  },

  // `console` só escreve a mensagem no log — padrão fora de produção, para o
  // desenvolvimento não depender de SMTP nem da Meta.
  email: {
    transport: process.env.EMAIL_TRANSPORT ?? (process.env.NODE_ENV === 'production' ? 'smtp' : 'console'),
    from: process.env.EMAIL_FROM ?? 'Nutri-Hub <nao-responda@nutrihub.local>',
    smtp: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
    },
  },

  // `desativado` em produção até as credenciais da Meta existirem: o risco 7.3
  // do RFC prevê o e-mail como fallback enquanto o WhatsApp não estiver pronto.
  whatsapp: {
    transport:
      process.env.WHATSAPP_TRANSPORT ?? (process.env.NODE_ENV === 'production' ? 'desativado' : 'console'),
    apiVersion: process.env.WHATSAPP_API_VERSION ?? 'v21.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'pt_BR',
  },
};
