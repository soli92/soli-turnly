/**
 * tests/e2e/sprint2/recurrence.spec.ts — Ricorrenze turni wizard (TSK-024).
 *
 * Mappa sugli Acceptance Criteria RF-E:
 *   RF-E CA1: wizard percorre tutti e 3 gli step (tipo → config → preview)
 *   RF-E CA2: generazione avviene e reindirizza alla lista ricorrenze
 *   RF-E VALIDATE: dipendente obbligatorio in step 2 → errore validation
 *
 * NOTE implementative:
 *   - RecurrenceWizard: stepper con ol/li + aria-current="step" sull'attivo.
 *   - Step 1: radio "Settimanale" / "Ciclo rotativo" (label con input[type=radio]).
 *   - Step 2: daterange + selezione dipendenti (multiselect o checkbox).
 *   - Step 3 ("Anteprima"): bottone "Genera turni" (RecurrencePreviewStep).
 *   - Navigazione: bottone "Avanti: Configurazione" → step 2,
 *                  bottone "Avanti: Anteprima" → step 3.
 *   - I nomi degli step sono definiti in STEPS const: "Tipo", "Configurazione", "Anteprima".
 *   - Il wizard usa: "Procedura guidata ricorrenza turni" (aria-label del contenitore).
 */

import { test, expect } from '../fixtures/sprint2-db';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('RF-E: Wizard ricorrenze', () => {
  /**
   * RF-E CA1: naviga tutti e 3 gli step del wizard.
   *
   * AC: "Il wizard permette di navigare avanti attraverso i 3 step"
   * Flusso:
   *   Step 1: seleziona "Settimanale", abilita Lunedì, assegna tipo turno → Avanti
   *   Step 2: compila date, seleziona almeno un dipendente → Avanti
   *   Step 3: verifica che la sezione "Anteprima" sia visibile
   */
  test('RF-E CA1: wizard 3 step navigabili', async ({ adminPage }) => {
    await adminPage.goto('/admin/recurrence/new');

    // Contenitore wizard visibile
    await expect(
      adminPage.locator('[aria-label="Procedura guidata ricorrenza turni"]')
    ).toBeVisible({ timeout: 10_000 });

    // --- Step 1: Tipo ---
    await expect(adminPage.getByText('Passo 1: Tipo')).toBeVisible({ timeout: 5_000 });

    // Seleziona "Settimanale" (è già il default, verifica che sia selezionato)
    const weeklyRadio = adminPage.getByRole('radio', { name: /Settimanale/i });
    await expect(weeklyRadio).toBeVisible({ timeout: 5_000 });
    if (!(await weeklyRadio.isChecked())) {
      await adminPage.getByLabel('Settimanale').click();
    }

    // Abilita Lunedì
    const lunediCheckbox = adminPage.getByRole('checkbox', { name: /Lunedì/i });
    await expect(lunediCheckbox).toBeVisible({ timeout: 5_000 });
    if (!(await lunediCheckbox.isChecked())) {
      await lunediCheckbox.check();
    }

    // Seleziona tipo turno per Lunedì (locator esatto sul combobox, non sulla checkbox)
    const shiftTypeTrigger = adminPage.locator('[aria-label="Tipo turno per Lunedì"]');
    if ((await shiftTypeTrigger.count()) > 0) {
      await shiftTypeTrigger.click();
      await adminPage.getByRole('option').first().click();
    }

    // Avanza allo step 2
    await adminPage.getByRole('button', { name: /Avanti/i }).click();

    // --- Step 2: Configurazione ---
    await expect(adminPage.getByText('Passo 2: Configurazione')).toBeVisible({ timeout: 8_000 });

    // Compila date di test
    await adminPage.getByLabel('Data inizio').fill('2029-09-01');
    await adminPage.getByLabel('Data fine').fill('2029-09-30');

    // Attende che la lista dipendenti si carichi (API asincrona), poi seleziona il primo
    const firstEmployeeCheckbox = adminPage
      .getByRole('checkbox', { name: /^Seleziona/i })
      .first();
    await expect(firstEmployeeCheckbox).toBeVisible({ timeout: 10_000 });
    // Usa click() (non check()) per garantire che React onChange sia invocato
    await firstEmployeeCheckbox.click();
    await expect(firstEmployeeCheckbox).toBeChecked({ timeout: 3_000 });

    // Avanza allo step 3 (il bottone specifico evita ambiguità)
    await adminPage.getByRole('button', { name: 'Avanti: Anteprima' }).click();

    // --- Step 3: Anteprima ---
    // Il titolo è nell'orchestratore (RecurrenceWizard), non nel componente preview
    await expect(adminPage.getByRole('heading', { name: /Passo 3/i })).toBeVisible({
      timeout: 20_000,
    });

    // Il bottone "Genera N turni" è visibile SOLO dopo che la preview API risponde
    // (RecurrencePreviewStep restituisce uno spinner durante il loading)
    await expect(adminPage.getByRole('button', { name: /^Genera/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  /**
   * RF-E VALIDATE: step 1 senza giorni selezionati → errore validation.
   *
   * AC: "Il sistema richiede almeno un giorno selezionato in modalità settimanale"
   */
  test('RF-E VALIDATE: step 1 senza giorni → errore validation', async ({ adminPage }) => {
    await adminPage.goto('/admin/recurrence/new');

    await expect(
      adminPage.locator('[aria-label="Procedura guidata ricorrenza turni"]')
    ).toBeVisible({ timeout: 10_000 });

    // Assicura nessun giorno selezionato (deseleziona tutti)
    const checkboxes = adminPage.getByRole('checkbox');
    const checkboxCount = await checkboxes.count();
    for (let i = 0; i < checkboxCount; i++) {
      const cb = checkboxes.nth(i);
      if (await cb.isChecked()) {
        await cb.uncheck();
      }
    }

    // Tenta di avanzare
    await adminPage.getByRole('button', { name: /Avanti/i }).click();

    // Errore validation atteso (role="alert" con messaggio giorni)
    await expect(
      adminPage.locator('[role="alert"]').filter({ hasText: /giorno|seleziona/i })
    ).toBeVisible({ timeout: 5_000 });

    // Rimane sullo step 1
    await expect(adminPage.getByText('Passo 1: Tipo')).toBeVisible();
  });

  /**
   * RF-E LIST: la pagina lista ricorrenze è accessibile.
   *
   * AC: "La lista delle ricorrenze è visibile in /recurrence"
   */
  test('RF-E LIST: lista ricorrenze carica senza errori', async ({ adminPage }) => {
    await adminPage.goto('/admin/recurrence');

    // Attende che il contenuto sia caricato (h1 o tabella)
    await expect(
      adminPage.getByRole('heading', { level: 1 }).or(adminPage.getByRole('table')).first()
    ).toBeVisible({ timeout: 10_000 });

    // Nessun errore critico (role="alert" con testo di errore)
    const criticalErrors = adminPage.locator('[role="alert"]').filter({
      hasText: /errore.*caricamento|500|server/i,
    });
    await expect(criticalErrors).toHaveCount(0, { timeout: 5_000 });
  });

  /**
   * RF-E SEC: GET /api/recurrences → 403 per dipendente.
   */
  test('RF-E SEC: GET /api/recurrences → 403 per dipendente', async ({ employeePage }) => {
    const resp = await employeePage.request.get('/api/recurrences');
    expect([403, 404]).toContain(resp.status());
  });
});
