/**
 * tests/e2e/sprint2/employee-calendar.spec.ts — Calendario dipendente (TSK-024).
 *
 * Mappa sugli Acceptance Criteria RF-J e T-SEC-01:
 *   RF-J CA1: il calendario mostra i turni del dipendente (section visibile)
 *   RF-J CA2: nessun elemento di editing (sola lettura) — assenza di CUD controls
 *   RF-J CA3: riepilogo ore (HoursSummaryBar) visibile
 *   T-SEC-01: dipendente non vede turni altrui via API (già in rbac.spec.ts, ribadito qui)
 *   RF-J EXPORT: pulsante export .ics (se presente nel CalendarToolbar)
 *
 * NOTE implementative:
 *   - EmployeeCalendar è dentro <section aria-label="Calendario turni personali">
 *   - HoursSummaryBar è il riepilogo ore sopra al calendario
 *   - CalendarToolbar usa React Big Calendar toolbar (classe .rbc-toolbar)
 *   - Il calendario usa React Big Calendar: eventi con role="button" (ShiftEvent)
 *   - ShiftDetailDrawer si apre al click su un evento (role="dialog")
 *   - La toolbar custom non ha data-testid dedicati; usiamo aria-label o ruoli RBC
 *   - Il test RF-J CA2 verifica l'assenza di bottoni admin-only nella UI dipendente
 */

import { test, expect } from '../fixtures/sprint2-db';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('RF-J: Calendario dipendente', () => {
  /**
   * RF-J CA1: calendario si carica correttamente con la section landmark.
   *
   * AC: "Il dipendente vede il proprio calendario turni"
   */
  test('RF-J CA1: calendario carica la section landmark correttamente', async ({
    employeePage,
  }) => {
    await employeePage.goto('/calendar');

    // Section landmark del calendario
    await expect(
      employeePage.locator('section[aria-label="Calendario turni personali"]')
    ).toBeVisible({ timeout: 10_000 });

    // React Big Calendar è reso (classe .rbc-calendar)
    await expect(employeePage.locator('.rbc-calendar')).toBeVisible({ timeout: 10_000 });
  });

  /**
   * RF-J CA2: nessun controllo di editing admin visibile per il dipendente.
   *
   * AC: "Il calendario è in sola lettura per il dipendente"
   * Verifica: bottoni "Crea turno", "Modifica", "Elimina" (admin-only) non compaiono.
   */
  test('RF-J CA2: calendario è sola lettura — no bottoni admin', async ({ employeePage }) => {
    await employeePage.goto('/calendar');

    await expect(
      employeePage.locator('section[aria-label="Calendario turni personali"]')
    ).toBeVisible({ timeout: 10_000 });

    // Bottoni admin-only non devono essere presenti
    await expect(
      employeePage.getByRole('button', { name: /crea turno|nuovo turno|aggiungi turno/i })
    ).toHaveCount(0);

    // Non ci sono cell con role="button" editabili (ShiftGrid admin) — il RBC usa
    // eventi con role="button" per il click, ma il selectable=false disabilita il click
    // sulla griglia vuota; verifica che le celle giorno non siano cliccabili come admin
    const adminCells = employeePage.locator('[data-testid^="shift-cell-"][role="button"]');
    await expect(adminCells).toHaveCount(0);
  });

  /**
   * RF-J CA3: HoursSummaryBar con riepilogo ore è visibile.
   *
   * AC: "Il dipendente vede il riepilogo delle proprie ore (totale e straordinari)"
   */
  test('RF-J CA3: riepilogo ore visibile nel calendario', async ({ employeePage }) => {
    await employeePage.goto('/calendar');

    await expect(
      employeePage.locator('section[aria-label="Calendario turni personali"]')
    ).toBeVisible({ timeout: 10_000 });

    // HoursSummaryBar: cerca testo "ore" nel contesto del calendario
    // (il componente mostra "Totale: Xh" e "Straordinari: Xh")
    await expect(employeePage.getByText(/ore|totale/i).first()).toBeVisible({ timeout: 10_000 });
  });

  /**
   * RF-J DRAWER: click su evento turno apre il drawer di dettaglio.
   *
   * AC: "Il dipendente può vedere i dettagli di un turno cliccandoci sopra"
   * Flusso:
   *   1. Naviga al calendario
   *   2. Trova un evento (se presente) e clicca
   *   3. Il drawer di dettaglio si apre (role="dialog" da ShiftDetailDrawer)
   */
  test('RF-J DRAWER: click su turno apre drawer dettaglio', async ({ employeePage }) => {
    await employeePage.goto('/calendar');

    await expect(employeePage.locator('.rbc-calendar')).toBeVisible({ timeout: 10_000 });

    // Cerca eventi RBC nel calendario
    const events = employeePage.locator('.rbc-event');
    const eventCount = await events.count();

    if (eventCount === 0) {
      // Nessun turno nel mese corrente — naviga al mese successivo
      const nextBtn = employeePage.getByRole('button', { name: /Successivo/i });
      if ((await nextBtn.count()) > 0) {
        await nextBtn.click();
        await employeePage.waitForTimeout(1_000);
      }

      const eventsAfterNav = employeePage.locator('.rbc-event');
      if ((await eventsAfterNav.count()) === 0) {
        // Nessun turno disponibile: il test non può procedere
        test.skip(true, 'Nessun turno nel calendario del dipendente — verificare seed DB');
        return;
      }
    }

    // Clicca sul primo evento
    await events.first().click();

    // Il drawer di dettaglio deve aprirsi (role="dialog" o [data-state="open"])
    await expect(
      employeePage
        .locator('[role="dialog"]')
        .or(employeePage.locator('[data-state="open"]').filter({ hasText: /turno|orario/i }))
        .first()
    ).toBeVisible({ timeout: 8_000 });
  });

  /**
   * T-SEC-01: dipendente non può accedere a turni altrui via API.
   *
   * AC: "L'API filtra automaticamente i risultati al solo utente corrente"
   * (Coerente con T-SEC-01 in rbac.spec.ts — ribadito in questo contesto.)
   */
  test('T-SEC-01: API /api/shifts filtra per session.user.id (non mostra turni altrui)', async ({
    employeePage,
    adminPage,
  }) => {
    // Recupera ID admin
    const adminMeResp = await adminPage.request.get('/api/users/me');
    await expect(adminMeResp).toBeOK();
    const adminData = await adminMeResp.json();
    const adminId: string = adminData.id;

    // Dipendente tenta di accedere ai turni dell'admin
    const resp = await employeePage.request.get(`/api/shifts?userId=${adminId}`);
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json();
    const shifts = body.data as Array<{ userId: string }>;

    // Nessun turno deve appartenere all'admin
    const adminShifts = shifts.filter((s) => s.userId === adminId);
    expect(adminShifts).toHaveLength(0);
  });

  /**
   * RF-J NAVIGATE: navigazione mese precedente/successivo nel calendario.
   */
  test('RF-J NAVIGATE: toolbar RBC permette navigazione mesi', async ({ employeePage }) => {
    await employeePage.goto('/calendar');

    await expect(employeePage.locator('.rbc-calendar')).toBeVisible({ timeout: 10_000 });

    // Bottoni della toolbar RBC (CalendarToolbar custom)
    const prevBtn = employeePage
      .getByRole('button', { name: /Precedente/i })
      .or(employeePage.locator('.rbc-toolbar').getByRole('button').nth(0));
    await expect(prevBtn).toBeVisible({ timeout: 5_000 });

    // Legge il label del mese corrente
    const monthLabel = employeePage.locator('.rbc-toolbar-label');
    const labelBefore = await monthLabel.textContent();

    // Naviga al mese successivo
    const nextBtn = employeePage.getByRole('button', { name: /Successivo/i });
    await nextBtn.click();
    await employeePage.waitForTimeout(500);

    const labelAfter = await monthLabel.textContent();
    expect(labelAfter).not.toBe(labelBefore);
  });
});
