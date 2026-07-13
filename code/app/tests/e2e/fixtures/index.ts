/**
 * tests/e2e/fixtures/index.ts — Fixture Playwright per Turnly (TSK-010).
 *
 * Estende la base `test` con due fixture autenticate:
 *   - adminPage:    pagina con sessione admin    (storageState .auth/admin.json)
 *   - employeePage: pagina con sessione employee  (storageState .auth/employee.json)
 *
 * Ogni fixture crea un contesto browser isolato e lo chiude al termine del test.
 * Garantisce che le sessioni non vengano condivise tra test.
 *
 * Utilizzo:
 *   import { test, expect } from '../fixtures';
 *   test('...', async ({ adminPage, employeePage }) => { ... });
 */

import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'path';

type Fixtures = {
  adminPage: Page;
  employeePage: Page;
};

const authDir = path.join(__dirname, '../.auth');

export const test = base.extend<Fixtures>({
  // Pagina con sessione admin
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(authDir, 'admin.json'),
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // Pagina con sessione dipendente (mario.rossi)
  employeePage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: path.join(authDir, 'employee.json'),
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect } from '@playwright/test';
