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
 *   PLAYWRIGHT_BASE_URL — override URL base (default: http://localhost:3001)
 *   CI                  — riduces timeout, abilita retries, forbidOnly
 */

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  webServer: {
    command: 'npm run dev',
    url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Limit parallelism: CI=1 for stability, local=3 to avoid "page closed" under load.
  workers: process.env.CI ? 1 : 3,
  globalSetup: require.resolve('./tests/e2e/global-setup'),
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001',
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
      timeout: 60_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
      snapshotDir: './tests/visual/__snapshots__/desktop',
      // OS-agnostic baselines: omit {-snapshotSuffix} so the same .png works
      // on darwin (local) and linux (CI) without separate per-platform files.
      snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{ext}',
      dependencies: ['setup'],
    },
    // -----------------------------------------------------------------------
    // Visual regression — mobile (375px) — TSK-030
    // -----------------------------------------------------------------------
    {
      name: 'visual-mobile',
      testDir: './tests/visual',
      timeout: 60_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
      },
      snapshotDir: './tests/visual/__snapshots__/mobile',
      // OS-agnostic baselines: same rationale as visual-desktop.
      snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{ext}',
      dependencies: ['setup'],
    },
  ],
});
