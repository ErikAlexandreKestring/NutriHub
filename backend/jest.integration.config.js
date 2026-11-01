/**
 * Testes de integração: rodam contra um PostgreSQL de verdade (o banco
 * `<DB_NAME>_test`, criado e migrado pelo globalSetup). Ficam fora do
 * `npm test` para a suíte unitária continuar rodando sem banco.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.test.ts'],
  globalSetup: '<rootDir>/tests/integration/globalSetup.ts',
  testTimeout: 30000,
};
