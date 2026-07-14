/**
 * tests/visual/fixtures/visual-db.ts — Fixture visual regression (TSK-030).
 *
 * Estende le fixture Playwright con tre contesti autenticati (admin, employee,
 * colleague) e con un helper `setTheme` per commutare il tema data-attribute
 * sull'elemento <html> prima dello screenshot.
 *
 * Seed minimale garantito per screenshot "con dati":
 *   - almeno 3 dipendenti (mario.rossi, luca.verdi, lucia.neri nel seed base)
 *   - almeno 5 tipologie turno (M, P, N, R, H dal seed base)
 *   - almeno 1 richiesta in stato "pending"
 *   - almeno 1 notifica non letta
 *   - almeno 1 voce disponibilità (availability window)
 *
 * Il seed viene garantito dai file db/seed.ts Sprint 2 e Sprint 3.
 * Se il seed non è stato eseguito, i test visual saltano con un messaggio esplicativo.
 *
 * Utilizzo:
 *   import { test, expect } from '../fixtures/visual-db';
 *
 *   test('dashboard desktop light', async ({ adminPage, setTheme }) => {
 *     await adminPage.goto('/admin/dashboard');
 *     await setTheme(adminPage, 'light');
 *     await adminPage.waitForLoadState('networkidle');
 *     await expect(adminPage).toHaveScreenshot('dashboard-desktop-light.png', { maxDiffPixels: 50 });
 *   });
 */

import path from 'path';
import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

type Theme = 'light' | 'dark';

type VisualFixtures = {
  adminPage: Page;
  employeePage: Page;
  colleaguePage: Page;
  /** Imposta il tema sull'elemento <html> via data-theme attribute */
  setTheme: (page: Page, theme: Theme) => Promise<void>;
};

const authDir = path.join(__dirname, '../../e2e/.auth');

// ---------------------------------------------------------------------------
// Helper: imposta tema
// ---------------------------------------------------------------------------

async function applyTheme(page: Page, theme: Theme): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    // Supporto per sistemi che usano la classe invece dell'attributo
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, theme);
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

export const test = base.extend<VisualFixtures>({
  // Pagina admin (usa auth già salvata da global-setup)
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(authDir, 'admin.json'),
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // Pagina dipendente (mario.rossi)
  employeePage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(authDir, 'employee.json'),
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // Pagina collega (luca.verdi) — generato on-demand se non esiste
  colleaguePage: async ({ browser }, use) => {
    const colleagueAuthPath = path.join(authDir, 'colleague.json');
    const fs = await import('fs');

    if (!fs.existsSync(colleagueAuthPath)) {
      const setupCtx = await browser.newContext();
      const setupPage = await setupCtx.newPage();
      const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

      await setupPage.goto(`${baseURL}/login`);
      await setupPage.fill('[name="email"]', 'luca.verdi@turnly.dev');
      await setupPage.fill('[name="password"]', 'Employee123!');
      await setupPage.click('[type="submit"]');
      await setupPage.waitForURL('**/calendar', { timeout: 15_000 });
      await setupCtx.storageState({ path: colleagueAuthPath });
      await setupCtx.close();
    }

    const ctx = await browser.newContext({
      storageState: colleagueAuthPath,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // Helper per impostare il tema
  setTheme: async ({}, use) => {
    await use(applyTheme);
  },
});

export { expect } from '@playwright/test';
