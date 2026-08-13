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
  },

  jwt: {
    secret: required('JWT_SECRET', 'dev-secret-nao-use-em-producao'),
    expiresInNutricionista: process.env.JWT_EXPIRES_IN_NUTRICIONISTA ?? '8h',
    expiresInPaciente: process.env.JWT_EXPIRES_IN_PACIENTE ?? '24h',
  },

  bcrypt: {
    saltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),
  },
};
