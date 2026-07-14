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
  /** Naviga e aspetta che tutte le richieste /api/* siano completate */
  gotoAndWait: (page: Page, url: string) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Helper: aspetta che non ci siano richieste /api/* attive per 600ms.
// Registra i listener PRIMA della navigate (chiama prima di page.goto).
// ---------------------------------------------------------------------------

export function waitForApiQuiet(page: Page, quietMs = 600, timeoutMs = 10_000): Promise<void> {
  let pending = 0;
  let quietTimer: ReturnType<typeof setTimeout> | undefined;
  let done = false;

  return new Promise<void>((resolve) => {
    const cleanup = () => {
      if (done) return;
      done = true;
      if (quietTimer) clearTimeout(quietTimer);
      clearTimeout(fallbackTimer);
      page.off('request', onRequest);
      page.off('requestfinished', onDone);
      page.off('requestfailed', onDone);
      resolve();
    };

    const scheduleQuiet = () => {
      if (quietTimer) clearTimeout(quietTimer);
      if (pending === 0 && !done) quietTimer = setTimeout(cleanup, quietMs);
    };

    const isDataApi = (url: string) =>
      url.includes('/api/') && !url.includes('/api/auth/') && !url.includes('/_next/');

    const onRequest = (req: { url: () => string }) => {
      if (isDataApi(req.url())) {
        pending++;
        if (quietTimer) clearTimeout(quietTimer);
      }
    };
    const onDone = (req: { url: () => string }) => {
      if (isDataApi(req.url())) {
        pending = Math.max(0, pending - 1);
        scheduleQuiet();
      }
    };

    const fallbackTimer = setTimeout(cleanup, timeoutMs);

    page.on('request', onRequest);
    page.on('requestfinished', onDone);
    page.on('requestfailed', onDone);

    // Se non ci sono richieste in volo ora, schedula quiet subito
    scheduleQuiet();
  });
}

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
  // Override page.goto per iniettare waitForApiQuiet automaticamente.
  // waitForApiQuiet parte DOPO waitForLoadState('load') perché React/TanStack
  // Query iniziano i fetch client-side solo dopo il load event.
  page: async ({ page }, use) => {
    const origGoto = page.goto.bind(page) as typeof page.goto;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (page as any).goto = async (url: string, opts?: Parameters<typeof page.goto>[1]) => {
      const resp = await origGoto(url, opts);
      await page.waitForLoadState('load').catch(() => {});
      await waitForApiQuiet(page);
      return resp;
    };
    await use(page);
  },

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

  // Helper navigazione + wait API quiet
  gotoAndWait: async ({}, use) => {
    await use(async (page: Page, url: string) => {
      await page.goto(url);
      await page.waitForLoadState('load');
      await waitForApiQuiet(page);
    });
  },
});

export { expect } from '@playwright/test';
