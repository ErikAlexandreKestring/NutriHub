module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  env: {
    browser: true,
    es2020: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  // Os arquivos de configuração da raiz rodam no Node, não no browser; sem
  // este override o lint acusaria `module`/`process` como indefinidos.
  overrides: [
    {
      files: ['*.cjs', '*.js', 'vite.config.ts'],
      env: { node: true, browser: false },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', 'dev-dist', 'coverage'],
};
