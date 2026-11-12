// Testes de navegador: abrem o app de verdade (Chromium, tela de celular) e clicam como um usuário.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8080',
    ...devices['Pixel 7'],
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    // Opcional: usar um Chromium já instalado na máquina (PW_CHROMIUM=/caminho/do/chrome)
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: { command: 'npx http-server app -p 8080 -c-1 --silent', url: 'http://127.0.0.1:8080', reuseExistingServer: !process.env.CI },
});
