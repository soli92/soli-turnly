/**
 * tests/e2e/fixtures/sprint3-db.ts — Fixture Sprint 3 (TSK-031).
 *
 * Estende le fixture base (TSK-010) con:
 *   - otherUserShiftId: UUID di un turno appartenente a lucia.verdi (altro dipendente),
 *     usato per il test T-SEC-01 dell'export .ics (verifica che il file non esponga
 *     turni di altri utenti).
 *
 * La fixture è deterministica: se lucia.verdi non ha turni nel DB, ne crea uno
 * nel futuro remoto (2099-01-15) e lo cancella nel teardown — nessun auto-skip.
 *
 * Utilizzo:
 *   import { test, expect } from '../fixtures/sprint3-db';
 *   test('...', async ({ employeePage, otherUserShiftId }) => { ... });
 */

import path from 'path';
import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Tipi fixture
// ---------------------------------------------------------------------------

type Sprint3Fixtures = {
  adminPage: Page;
  employeePage: Page;
  /**
   * UUID di un turno appartenente a un dipendente diverso da mario.rossi.
   * Presente nel file .ics esportato SOLO se filtro T-SEC-01 è rotto.
   */
  otherUserShiftId: string;
};

const authDir = path.join(__dirname, '../.auth');

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

export const test = base.extend<Sprint3Fixtures>({
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

  /**
   * Restituisce l'ID di un turno appartenente a lucia.verdi (dipendente diverso da
   * mario.rossi). Usato in T-SEC-01 per verificare che il file .ics di mario.rossi
   * non esponga turni altrui.
   *
   * Strategia deterministica (no auto-skip silenzioso):
   *   1. GET /api/admin/users → trova lucia.verdi@turnly.dev.
   *   2. GET /api/shifts?userId=<luciaId>&limit=1 → usa il turno se esiste.
   *   3. Se non esiste, GET /api/shift-types per un shiftTypeId valido, poi
   *      POST /api/shifts con una data nel futuro remoto (2099-01-15).
   *   4. Teardown: DELETE /api/shifts/:id se il turno è stato creato qui.
   *
   * In caso di errori di setup irrecuperabili il test viene marcato fixme
   * (non skip silenzioso) con diagnostica chiara.
   */
  otherUserShiftId: async ({ browser }, use, testInfo) => {
    const ctx = await browser.newContext({
      storageState: path.join(authDir, 'admin.json'),
    });
    const adminPage = await ctx.newPage();

    let createdShiftId: string | null = null;

    try {
      // 1. Trova lucia.verdi
      const usersResp = await adminPage.request.get('/api/admin/users?limit=20');
      if (!usersResp.ok()) {
        testInfo.fixme(
          true,
          `[T-SEC-01] GET /api/admin/users ha risposto ${usersResp.status()} — setup fixture fallito`
        );
        await use('__fixture_unavailable__');
        return;
      }

      const usersData = (await usersResp.json()) as { data: Array<{ id: string; email: string }> };
      const lucia = usersData.data.find((u) => u.email === 'lucia.verdi@turnly.dev');

      if (!lucia) {
        testInfo.fixme(
          true,
          '[T-SEC-01] lucia.verdi@turnly.dev non trovata — eseguire il seed DB prima dei test'
        );
        await use('__fixture_unavailable__');
        return;
      }

      // 2. Prova a usare un turno già esistente di lucia
      const shiftsResp = await adminPage.request.get(`/api/shifts?userId=${lucia.id}&limit=1`);
      if (shiftsResp.ok()) {
        const shiftsData = (await shiftsResp.json()) as { data: Array<{ id: string }> };
        if (shiftsData.data && shiftsData.data.length > 0) {
          await use(shiftsData.data[0]!.id);
          return;
        }
      }

      // 3. Nessun turno esistente: crea un turno fixture nel futuro remoto
      const shiftTypesResp = await adminPage.request.get('/api/shift-types');
      if (!shiftTypesResp.ok()) {
        testInfo.fixme(
          true,
          `[T-SEC-01] GET /api/shift-types ha risposto ${shiftTypesResp.status()} — impossibile creare turno fixture`
        );
        await use('__fixture_unavailable__');
        return;
      }

      const shiftTypesList = (await shiftTypesResp.json()) as Array<{ id: string }>;
      if (!shiftTypesList.length) {
        testInfo.fixme(
          true,
          '[T-SEC-01] Nessun shift-type nel DB — eseguire il seed prima dei test'
        );
        await use('__fixture_unavailable__');
        return;
      }

      const createResp = await adminPage.request.post('/api/shifts', {
        data: {
          userId: lucia.id,
          shiftTypeId: shiftTypesList[0]!.id,
          date: '2099-01-15',
          startDt: '2099-01-15T07:00:00.000Z',
          endDt: '2099-01-15T15:00:00.000Z',
          status: 'planned',
        },
      });

      if (!createResp.ok()) {
        testInfo.fixme(
          true,
          `[T-SEC-01] POST /api/shifts ha risposto ${createResp.status()} — impossibile creare turno fixture`
        );
        await use('__fixture_unavailable__');
        return;
      }

      const created = (await createResp.json()) as { id: string };
      createdShiftId = created.id;

      await use(createdShiftId);
    } finally {
      // 4. Teardown: elimina il turno creato dalla fixture (best-effort)
      if (createdShiftId) {
        await adminPage.request.delete(`/api/shifts/${createdShiftId}`).catch(() => {
          console.warn(`[sprint3-db] cleanup DELETE /api/shifts/${createdShiftId} fallito`);
        });
      }
      await ctx.close();
    }
  },
});

export { expect } from '@playwright/test';
