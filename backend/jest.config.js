/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Os testes de integração precisam de PostgreSQL: rodam em `npm run test:integration`.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/integration/'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/db/migrations/**',
    '!src/db/seeds/**',
    '!src/types/**',
    '!src/db/knexfile.ts',
  ],
  coverageDirectory: 'coverage',
  // Meta do Portfólio (Web Apps): 75% de cobertura no backend, conferida na prova
  // de autoria em 30/11/2026 — ainda não é obrigada aqui porque só existe um
  // módulo (auth). O gate de cobertura entra quando houver mais código para
  // medir de forma significativa; ver README para o plano dos próximos módulos.
};
