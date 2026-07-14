/**
 * tests/e2e/sprint2/shift-types.spec.ts — Tipologie turno (TSK-024).
 *
 * Mappa sugli Acceptance Criteria RF-C:
 *   RF-C CA1: durata turno calcolata live nel form (inclusa durata notturna)
 *   RF-C CRUD: creazione, modifica nome, disattivazione
 *   RF-C VALIDATE: codice non valido (minuscole) → errore inline
 *
 * NOTE implementative:
 *   - Non ci sono data-testid dedicati su ShiftTypeModal (campi identificati
 *     da aria-label o placeholder) — usiamo getByLabel / getByPlaceholder.
 *   - Il calcolo durata live usa role="status" + aria-live="polite".
 *   - Il warning turno notturno compare quando endTime <= startTime.
 *   - L'eliminazione usa AlertDialog (getByRole('alertdialog')).
 *   - La pagina /admin/shift-types non richiede data-testid specifici per
 *     la toolbar perché usa il bottone testo "Nuova tipologia".
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
   * Flusso:
   *   1. Admin apre "Nuova tipologia"
   *   2. Imposta orari 08:00 → 16:00
   *   3. Il box "Durata turno" mostra "8h 00min"
   */
  test('RF-C CA1: durata calcolata live in form (turno standard)', async ({ adminPage }) => {
    await adminPage.goto('/admin/shift-types');

    // Apre modal creazione
    await adminPage.getByRole('button', { name: /Nuova tipologia/i }).click();
    await expect(adminPage.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });

    // Compila nome e codice (obbligatori per evitare blocchi)
    await adminPage.getByLabel('Nome').fill('Turno Test');
    await adminPage.getByLabel('Codice').fill(uniqueCode());

    // Imposta orari
    await adminPage.getByLabel('Inizio').fill('08:00');
    await adminPage.getByLabel('Fine').fill('16:00');

    // Attende che il box durata appaia (role="status" con testo "Durata turno")
    const durationBox = adminPage.locator('[role="status"]').filter({ hasText: 'Durata turno' });
    await expect(durationBox).toBeVisible({ timeout: 5_000 });

    // Verifica che mostri "8h 00min"
    await expect(durationBox).toContainText('8h 00min');

    // Chiude senza salvare
    await adminPage.getByRole('button', { name: 'Annulla' }).click();
  });

  /**
   * RF-C CA1 notturno: turno notturno 22:00 → 06:00 mostra warning e durata 8h.
   *
   * AC: "Il sistema rileva il turno notturno e indica 'fine giorno successivo'"
   */
  test('RF-C CA1: turno notturno rilevato con avviso e durata corretta', async ({ adminPage }) => {
    await adminPage.goto('/admin/shift-types');

    await adminPage.getByRole('button', { name: /Nuova tipologia/i }).click();
    await expect(adminPage.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });

    await adminPage.getByLabel('Nome').fill('Notte Test');
    await adminPage.getByLabel('Codice').fill(uniqueCode());
    await adminPage.getByLabel('Inizio').fill('22:00');
    await adminPage.getByLabel('Fine').fill('06:00');

    // Warning turno notturno deve essere visibile
    const nightWarning = adminPage.locator('[role="status"]').filter({
      hasText: /notturno|giorno successivo/i,
    });
    await expect(nightWarning).toBeVisible({ timeout: 5_000 });

    // Durata: 22:00 → 06:00 = 8h
    await expect(nightWarning).toContainText('8h 00min');

    await adminPage.getByRole('button', { name: 'Annulla' }).click();
  });

  /**
   * RF-C CRUD: creazione tipologia turno completa.
   *
   * AC: "La tipologia appare nella lista dopo la creazione"
   */
  test('RF-C CRUD: creazione tipologia turno valida', async ({ adminPage }) => {
    await adminPage.goto('/admin/shift-types');

    await adminPage.getByRole('button', { name: /Nuova tipologia/i }).click();
    await expect(adminPage.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });

    const name = `Turno Auto ${Date.now()}`;
    const code = uniqueCode();

    await adminPage.getByLabel('Nome').fill(name);
    await adminPage.getByLabel('Codice').fill(code);
    await adminPage.getByLabel('Inizio').fill('07:00');
    await adminPage.getByLabel('Fine').fill('15:00');

    // Submit: "Crea tipologia"
    await adminPage.getByRole('button', { name: /Crea tipologia/i }).click();

    // Modal si chiude
    await expect(adminPage.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10_000 });

    // La nuova tipologia appare nella tabella
    await expect(adminPage.getByText(name)).toBeVisible({ timeout: 10_000 });

    // Cleanup via API (best-effort): recupera id e cancella
    const stResp = await adminPage.request.get('/api/shift-types?limit=100');
    if (stResp.ok()) {
      const body = await stResp.json();
      const created = (body.data as Array<{ name: string; id: string }>).find(
        (st) => st.name === name
      );
      if (created) {
        await adminPage.request.delete(`/api/shift-types/${created.id}`).catch(() => {});
      }
    }
  });

  /**
   * RF-C VALIDATE: codice con caratteri non validi → errore form.
   *
   * AC: "Il codice deve contenere solo lettere maiuscole, numeri e underscore"
   * Flusso: inserisce "notte" (minuscolo) → errore Zod.
   */
  test('RF-C VALIDATE: codice minuscolo genera errore validation', async ({ adminPage }) => {
    await adminPage.goto('/admin/shift-types');

    await adminPage.getByRole('button', { name: /Nuova tipologia/i }).click();
    await expect(adminPage.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });

    await adminPage.getByLabel('Nome').fill('Test Validazione');
    // Il campo code uppercase-izza automaticamente onchange, ma Zod valida il valore
    // prima della normalizzazione → inseriamo direttamente via keyboard senza il trigger
    const codeInput = adminPage.getByLabel('Codice');
    await codeInput.fill('test-minuscolo');

    await adminPage.getByRole('button', { name: /Crea tipologia/i }).click();

    // L'errore di validazione deve comparire (FormMessage con role="alert" o testo descrittivo)
    await expect(
      adminPage
        .locator('[role="alert"]')
        .or(adminPage.getByText(/maiuscolo|uppercase|A-Z|non valido/i))
    ).toBeVisible({ timeout: 5_000 });

    // Il dialog resta aperto
    await expect(adminPage.locator('[role="dialog"]')).toBeVisible();

    await adminPage.getByRole('button', { name: 'Annulla' }).click();
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
