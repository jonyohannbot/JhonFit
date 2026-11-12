// ESLint: pega erros de digitação e variáveis inexistentes antes de irem para produção.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'app/vendor/**', 'app/exercises.js', 'playwright-report/**', 'test-results/**', '_site/**'] },
  js.configs.recommended,
  {
    files: ['app/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser, ...globals.serviceworker } },
    rules: { 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }], 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  {
    files: ['tests/**/*.js', 'playwright.config.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
  },
  { files: ['scripts/**/*.mjs'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node } },
];
