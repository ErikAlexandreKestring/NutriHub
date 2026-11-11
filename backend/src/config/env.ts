import path from 'path';
import dotenv from 'dotenv';

// O `.env` do diretório atual (npm run dev/start, testes) e, como reserva, o
// da raiz do backend a partir deste arquivo: o CLI do knex muda o diretório
// para src/db antes de carregar o knexfile, e sem a reserva `npm run migrate`
// rodava sem o `.env` — caía nos padrões de conexão e falhava nas variáveis
// obrigatórias. O dotenv não sobrescreve o que já foi definido, então a ordem
// dá prioridade ao ambiente real e depois ao `.env` do diretório atual.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/** Tira as barras do final sem regex (a `/\/+$/` é quadrática com muitas barras). */
function semBarraNoFinal(url: string): string {
  let fim = url.length;
  while (fim > 0 && url[fim - 1] === '/') fim--;
  return url.slice(0, fim);
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

/** HH:MM de 00:00 a 23:59; um valor torto derruba a subida em vez de nunca enviar. */
function horarioDoLembrete(valor: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) {
    throw new Error(`MEAL_REMINDER_TIME inválido: "${valor}" (use HH:MM, por exemplo 19:00)`);
  }
  return valor;
}

/**
 * Padrão para segredos (#41): o valor de desenvolvimento só vale com NODE_ENV
 * explicitamente `development` ou `test`. Em qualquer outro caso — produção, ou
 * um deploy que esqueceu o NODE_ENV (o App Service não define sozinho) — não há
 * padrão e `required` derruba a subida. Sem isso a API subia em produção com
 * segredos que estão escritos no repositório: com o JWT_SECRET padrão, qualquer
 * um assinaria um token válido de qualquer nutricionista ou paciente.
 */
function somenteEmDesenvolvimento(valorDeDesenvolvimento: string): string | undefined {
  const nodeEnv = process.env.NODE_ENV;
  return nodeEnv === 'development' || nodeEnv === 'test' ? valorDeDesenvolvimento : undefined;
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
    appPassword: required('DB_APP_PASSWORD', somenteEmDesenvolvimento('nutrihub_app_dev_password')),
  },

  // RNF-03: chave AES-256 (32 bytes em base64) dos dados de saúde em repouso —
  // ver shared/utils/sensitiveData. Perder ou trocar a chave torna ilegível o
  // histórico já gravado. Como os outros segredos, a chave de desenvolvimento
  // só vale em development ou test: fora deles a subida falha em vez de cifrar
  // dados reais com uma chave que está no repositório.
  dataEncryptionKey: required(
    'DATA_ENCRYPTION_KEY',
    somenteEmDesenvolvimento('bnV0cmlodWItZGV2LWtleS1uYW8tdXNlLWVtLXByb2Q='),
  ),

  jwt: {
    secret: required('JWT_SECRET', somenteEmDesenvolvimento('dev-secret-nao-use-em-producao')),
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
    appUrl: semBarraNoFinal(process.env.APP_URL ?? 'http://localhost:5173'),
    // RF-07: a partir desta hora (HH:MM, fuso de America/Sao_Paulo) sai o
    // lembrete diário das refeições ainda não marcadas como feitas.
    mealReminderTime: horarioDoLembrete(process.env.MEAL_REMINDER_TIME ?? '19:00'),
  },

  // `console` só escreve a mensagem no log — padrão fora de produção, para o
  // desenvolvimento não depender de SMTP.
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
};
