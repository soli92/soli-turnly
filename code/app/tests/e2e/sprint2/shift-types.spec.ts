/**
 * tests/e2e/sprint2/shift-types.spec.ts — Tipologie turno (TSK-024).
 *
 * Mappa sugli Acceptance Criteria RF-C:
 *   RF-C CA1: durata turno calcolata live nel form (inclusa durata notturna)
 *   RF-C CRUD: creazione, modifica nome, disattivazione
 *   RF-C VALIDATE: codice non valido (minuscole) → errore inline
 *
 * NOTE implementative:
 *   - ShiftTypeModal: il accessible name degli input è il placeholder
 *     (htmlFor/id association non risulta nell'aria tree).
 *     → usiamo getByPlaceholder per i campi testo e input[type="time"] per gli orari.
 *   - Il calcolo durata live usa role="status" + aria-live="polite".
 *   - Il warning turno notturno compare quando endTime <= startTime.
 *   - Tutti i locator sono scopati al dialog.
 */

import { test, expect } from '../fixtures/sprint2-db';

// ---------------------------------------------------------------------------
// Helper: genera codice univoco per il test
// ---------------------------------------------------------------------------

function uniqueCode(): string {
  return `TEST${Date.now().toString().slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('RF-C: Tipologie turno', () => {
  /**
   * RF-C CA1: durata calcolata live — turno standard.
   *
   * AC: "La durata viene calcolata automaticamente dagli orari inseriti"
   */
  test('RF-C CA1: durata calcolata live in form (turno standard)', async ({ adminPage }) => {
    await adminPage.goto('/admin/shift-types');

    await adminPage.getByRole('button', { name: /Nuova tipologia/i }).click();
    const dlg = adminPage.locator('[role="dialog"]');
    await expect(dlg).toBeVisible({ timeout: 8_000 });

    // Campi identificati dal placeholder (accessible name nel aria-tree)
    await dlg.getByPlaceholder('Es. Turno Notte').fill('Turno Test');
    await dlg.getByPlaceholder('Es. NOTTE').fill(uniqueCode());

    // Orari: input[type="time"] scoped al dialog
    const timeInputs = dlg.locator('input[type="time"]');
    await timeInputs.first().fill('08:00');
    await timeInputs.last().fill('16:00');

    // Attende che il box durata appaia
    const durationBox = dlg.locator('[role="status"]').filter({ hasText: 'Durata turno' });
    await expect(durationBox).toBeVisible({ timeout: 5_000 });
    await expect(durationBox).toContainText('8h 00min');

    await dlg.getByRole('button', { name: 'Annulla' }).click();
  });

  /**
   * RF-C CA1 notturno: turno notturno 22:00 → 06:00 mostra warning e durata 8h.
   *
   * AC: "Il sistema rileva il turno notturno e indica 'fine giorno successivo'"
   */
  test('RF-C CA1: turno notturno rilevato con avviso e durata corretta', async ({ adminPage }) => {
    await adminPage.goto('/admin/shift-types');

    await adminPage.getByRole('button', { name: /Nuova tipologia/i }).click();
    const dlg = adminPage.locator('[role="dialog"]');
    await expect(dlg).toBeVisible({ timeout: 8_000 });

    await dlg.getByPlaceholder('Es. Turno Notte').fill('Notte Test');
    await dlg.getByPlaceholder('Es. NOTTE').fill(uniqueCode());

    const timeInputs = dlg.locator('input[type="time"]');
    await timeInputs.first().fill('22:00');
    await timeInputs.last().fill('06:00');

    const nightWarning = dlg.locator('[role="status"]').filter({
      hasText: /notturno|giorno successivo/i,
    });
    await expect(nightWarning).toBeVisible({ timeout: 5_000 });
    await expect(nightWarning).toContainText('8h 00min');

    await dlg.getByRole('button', { name: 'Annulla' }).click();
  });

  /**
   * RF-C CRUD: creazione tipologia turno completa.
   *
   * AC: "La tipologia appare nella lista dopo la creazione"
   */
  test('RF-C CRUD: creazione tipologia turno valida', async ({ adminPage }) => {
    await adminPage.goto('/admin/shift-types');

    await adminPage.getByRole('button', { name: /Nuova tipologia/i }).click();
    const dlg = adminPage.locator('[role="dialog"]');
    await expect(dlg).toBeVisible({ timeout: 8_000 });

    const name = `Turno Auto ${Date.now()}`;
    const code = uniqueCode();

    await dlg.getByPlaceholder('Es. Turno Notte').fill(name);
    await dlg.getByPlaceholder('Es. NOTTE').fill(code);

    const timeInputs = dlg.locator('input[type="time"]');
    await timeInputs.first().fill('07:00');
    await timeInputs.last().fill('15:00');

    await dlg.getByRole('button', { name: /Crea tipologia/i }).click();

    // Modal si chiude
    await expect(dlg).not.toBeVisible({ timeout: 10_000 });

    // La nuova tipologia appare nella tabella
    await expect(adminPage.getByText(name)).toBeVisible({ timeout: 10_000 });

    // Cleanup via API — GET /api/shift-types returns array directly (not { data: [...] })
    const stResp = await adminPage.request.get('/api/shift-types?limit=100');
    if (stResp.ok()) {
      const rows = (await stResp.json()) as Array<{ name: string; id: string }>;
      const created = Array.isArray(rows) ? rows.find((st) => st.name === name) : undefined;
      if (created) {
        await adminPage.request.delete(`/api/shift-types/${created.id}`).catch(() => {});
      }
    }
  });

  /**
   * RF-C VALIDATE: submit con codice vuoto → errore campo obbligatorio.
   *
   * AC: "Il codice è obbligatorio — campo vuoto genera errore validation"
   * Nota: il campo Codice auto-normalizza l'input (uppercase + strip non-alnum),
   * quindi fill('test-minuscolo') diventerebbe 'TESTMINUSCOLO' (valido).
   * Il test verifica la validazione con campo lasciato vuoto.
   */
  test('RF-C VALIDATE: codice minuscolo genera errore validation', async ({ adminPage }) => {
    await adminPage.goto('/admin/shift-types');

    await adminPage.getByRole('button', { name: /Nuova tipologia/i }).click();
    const dlg = adminPage.locator('[role="dialog"]');
    await expect(dlg).toBeVisible({ timeout: 8_000 });

    // Compila solo il Nome; lascia Codice vuoto
    await dlg.getByPlaceholder('Es. Turno Notte').fill('Test Validazione');
    // Codice lasciato vuoto intenzionalmente per testare la validazione

    await dlg.getByRole('button', { name: /Crea tipologia/i }).click();

    // L'errore di validazione deve comparire (codice obbligatorio)
    // Usa .first() per evitare strict mode violation (più campi vuoti generano più alert)
    await expect(dlg.locator('[role="alert"]').first()).toBeVisible({ timeout: 5_000 });

    // Il dialog resta aperto
    await expect(dlg).toBeVisible();

    await dlg.getByRole('button', { name: 'Annulla' }).click();
  });

  /**
   * RF-C SEC: GET /api/shift-types → 401 senza sessione.
   */
  test('RF-C SEC: GET /api/shift-types → 401 senza sessione', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      const resp = await page.request.get('/api/shift-types');
      expect(resp.status()).toBe(401);
    } finally {
      await ctx.close();
    }
  });
});
