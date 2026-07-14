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
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // NOTE: workers: undefined non è assegnabile con exactOptionalPropertyTypes — spread condizionale.
  ...(process.env.CI ? { workers: 1 } : {}),
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
    // -----------------------------------------------------------------------
    // Visual regression — desktop (1280px) + screenshot baseline (TSK-030)
    // Run: npx playwright test --project=visual-desktop
    // Update baseline: npx playwright test --project=visual-desktop --update-snapshots
    // -----------------------------------------------------------------------
    {
      name: 'visual-desktop',
      testDir: './tests/visual',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
      snapshotDir: './tests/visual/__snapshots__/desktop',
      dependencies: ['setup'],
    },
    // -----------------------------------------------------------------------
    // Visual regression — mobile (375px) — TSK-030
    // -----------------------------------------------------------------------
    {
      name: 'visual-mobile',
      testDir: './tests/visual',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
      },
      snapshotDir: './tests/visual/__snapshots__/mobile',
      dependencies: ['setup'],
    },
  ],
});
