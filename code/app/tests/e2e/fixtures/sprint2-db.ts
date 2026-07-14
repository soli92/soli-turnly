/**
 * tests/e2e/fixtures/sprint2-db.ts — Fixture Sprint 2 (TSK-024).
 *
 * Estende le fixture base (TSK-010) con:
 *   - Una terza sessione autenticata: "colleaguePage" (lucia.verdi@turnly.dev)
 *     usata per il test T-REQ-03 (flusso scambio a 3 attori).
 *
 * Seed Sprint 2 aggiuntivo (oltre al seed TSK-002):
 *   - 3 coverage_requirements (notte Infermieri ×3, pomeriggio OSS ×2, mattina Medico ×1)
 *   - 2 finestre availability (indisponibilità Luca venerdì mattina)
 *   - 1 swap_operation esistente per test T-SWP-*
 *
 * Credenziali collega (da db/seed.ts Sprint 2):
 *   Colleague: lucia.verdi@turnly.dev / Employee123!
 *
 * Utilizzo:
 *   import { test, expect } from '../fixtures/sprint2-db';
 *   test('...', async ({ adminPage, employeePage, colleaguePage }) => { ... });
 */

import path from 'path';
import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Tipi fixture
// ---------------------------------------------------------------------------

type Sprint2Fixtures = {
  adminPage: Page;
  employeePage: Page;
  /** Sessione del collega (lucia.verdi) — usata per T-REQ-03 flusso scambio */
  colleaguePage: Page;
};

const authDir = path.join(__dirname, '../.auth');

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

export const test = base.extend<Sprint2Fixtures>({
  // Pagina admin (usa auth già salvata da global-setup)
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(authDir, 'admin.json'),
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // Pagina dipendente principale (mario.rossi)
  employeePage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(authDir, 'employee.json'),
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // Pagina collega (lucia.verdi) — nuovo contesto isolato
  // Nota: il file colleague.json viene generato da global-setup se presente,
  // oppure qui viene creato on-demand al primo utilizzo.
  colleaguePage: async ({ browser }, use) => {
    const colleagueAuthPath = path.join(authDir, 'colleague.json');
    const fs = await import('fs');

    // Se l'auth del collega non esiste ancora, esegui il login al volo
    if (!fs.existsSync(colleagueAuthPath)) {
      const setupCtx = await browser.newContext();
      const setupPage = await setupCtx.newPage();
      const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

      await setupPage.goto(`${baseURL}/login`);
      await setupPage.fill('[name="email"]', 'lucia.verdi@turnly.dev');
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
});

export { expect } from '@playwright/test';
