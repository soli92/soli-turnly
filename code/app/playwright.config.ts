import { defineConfig, devices } from '@playwright/test';

/**
 * playwright.config.ts — Configurazione suite E2E Turnly (TSK-010).
 *
 * globalSetup: salva session storageState per admin e dipendente una volta
 * prima di tutti i test (evita login UI per ogni spec).
 *
 * Progetti:
 *   - chromium (Desktop Chrome)
 *   - firefox  (Desktop Firefox)
 *
 * Variabili d'ambiente:
 *   PLAYWRIGHT_BASE_URL — override URL base (default: http://localhost:3000)
 *   CI                  — riduces timeout, abilita retries, forbidOnly
 */

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  globalSetup: require.resolve('./tests/e2e/global-setup'),
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testDir: './tests/e2e',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'a11y',
      testDir: './tests/a11y',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
