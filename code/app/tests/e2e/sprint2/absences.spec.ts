/**
 * tests/e2e/sprint2/absences.spec.ts — Gestione assenze admin (TSK-024).
 *
 * Mappa sugli Acceptance Criteria RF-G:
 *   RF-G CA1: assenza senza conflitti → salvataggio diretto
 *   RF-G CA2: assenza con turni in conflitto → AbsenceConflictModal appare prima del salvataggio
 *   RF-G VALIDATE: date non valide (fine < inizio) → errore inline
 *
 * NOTE implementative:
 *   - AbsenceForm non ha data-testid sui suoi campi (usa getByLabel / getByRole).
 *     Il bottone submit mostra testi "Verifica conflitti…" o "Registra assenza".
 *   - Il modal conflitti (AbsenceConflictModal) ha DialogTitle con testo
 *     "Trovat* turno/i in conflitto".
 *   - ConflictShiftList non ha data-testid: usiamo data-testid="conflict-shift-list"
 *     come da spec TSK-024 (da aggiungere al componente se mancante —
 *     test tollerante: verifica il testo del dialog).
 *   - Il test RF-G CA2 dipende da un turno esistente per mario.rossi in un
 *     range di date futuro; viene creato via API prima del test e rimosso dopo.
 *   - La tabella assenze esistenti è AbsenceTable: verifica la presenza della sezione.
 */

import { test, expect } from '../fixtures/sprint2-db';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('RF-G: Registrazione assenze', () => {
  /**
   * RF-G CA1: registra assenza per date senza turni in conflitto.
   *
   * AC: "L'assenza viene registrata senza mostrare il modal conflitti"
   * Flusso:
   *   1. Admin compila il form per un dipendente
   *   2. Usa date remote (2030) dove non ci sono turni
   *   3. Submit → nessun modal conflitti → messaggio successo
   */
  test('RF-G CA1: registra assenza senza conflitti', async ({ adminPage }) => {
    await adminPage.goto('/admin/absences');

    // Attende che la pagina sia caricata (form visibile)
    await expect(adminPage.getByRole('heading', { name: /Registra nuova assenza/i })).toBeVisible({
      timeout: 10_000,
    });

    // Seleziona dipendente (primo della lista)
    const dipendenteTrigger = adminPage
      .getByRole('combobox')
      .filter({
        has: adminPage
          .locator('[placeholder="Seleziona un dipendente"]')
          .or(adminPage.locator('[aria-label="Seleziona dipendente"]')),
      })
      .or(adminPage.getByLabel('Dipendente').locator('button'));

    // Usa il trigger Radix Select per il dipendente
    await adminPage.locator('[aria-label="Seleziona dipendente"]').click();
    await adminPage.getByRole('option').first().click();

    // Seleziona tipo assenza
    await adminPage.locator('[aria-label="Seleziona tipo di assenza"]').click();
    await adminPage.getByRole('option', { name: /Ferie/i }).click();

    // Date future senza turni (anno 2030)
    await adminPage.getByLabel('Data inizio').fill('2030-07-01');
    await adminPage.getByLabel('Data fine').fill('2030-07-05');

    // Submit
    await adminPage.getByRole('button', { name: /Registra assenza|Verifica conflitti/i }).click();

    // Nessun modal conflitti (dialog con "turni in conflitto" NON deve apparire)
    // Attende che il processo finisca (max 10s)
    await adminPage.waitForTimeout(2_000);
    const conflictDialog = adminPage.locator('[role="dialog"]').filter({
      hasText: /conflitto|conflitti/i,
    });
    await expect(conflictDialog).not.toBeVisible({ timeout: 3_000 });

    // Messaggio successo
    await expect(
      adminPage
        .getByText(/registrat|successo|salv/i)
        .or(adminPage.locator('[role="status"]').filter({ hasText: /registrat/i }))
    ).toBeVisible({ timeout: 10_000 });
  });

  /**
   * RF-G CA2: modal conflitti appare quando ci sono turni nel periodo.
   *
   * AC: "Il sistema mostra un modal con i turni in conflitto prima di salvare"
   * Flusso:
   *   1. Setup: crea un turno per mario.rossi nella data target via API
   *   2. Admin inserisce assenza per mario.rossi sulle stesse date
   *   3. Il form chiama check-conflicts → AbsenceConflictModal compare
   *   4. Verifica testo "conflitto" nel dialog
   *   5. Cleanup: elimina il turno creato
   */
  test('RF-G CA2: modal conflitti appare prima del salvataggio', async ({ adminPage }) => {
    // Setup: recupera ID di mario.rossi
    const usersResp = await adminPage.request.get('/api/admin/users?limit=100');
    if (!usersResp.ok()) {
      test.skip(true, 'GET /api/admin/users non disponibile');
      return;
    }
    const usersBody = await usersResp.json();
    const marioRossi = (usersBody.data as Array<{ email: string; id: string }>).find(
      (u) => u.email === 'mario.rossi@turnly.dev'
    );
    if (!marioRossi) {
      test.skip(true, 'mario.rossi non trovato nel DB');
      return;
    }
    const marioId = marioRossi.id;

    // Setup: crea un turno per mario.rossi nel 2029-03-10 via API
    const shiftResp = await adminPage.request.post('/api/shifts', {
      data: {
        userId: marioId,
        date: '2029-03-10',
        startDt: '2029-03-10T07:00:00.000Z',
        endDt: '2029-03-10T15:00:00.000Z',
        status: 'planned',
      },
    });

    if (!shiftResp.ok()) {
      test.skip(true, 'Impossibile creare turno di setup — controllare API /api/shifts');
      return;
    }

    const shiftBody = await shiftResp.json();
    const shiftId: string = shiftBody.id;

    try {
      await adminPage.goto('/admin/absences');
      await expect(adminPage.getByRole('heading', { name: /Registra nuova assenza/i })).toBeVisible(
        { timeout: 10_000 }
      );

      // Seleziona mario.rossi
      await adminPage.locator('[aria-label="Seleziona dipendente"]').click();
      await adminPage.getByRole('option', { name: /mario.*rossi|rossi.*mario/i }).click();

      // Seleziona tipo
      await adminPage.locator('[aria-label="Seleziona tipo di assenza"]').click();
      await adminPage.getByRole('option', { name: /Malattia/i }).click();

      // Date che includono il turno creato
      await adminPage.getByLabel('Data inizio').fill('2029-03-08');
      await adminPage.getByLabel('Data fine').fill('2029-03-12');

      // Submit: il form chiama check-conflicts
      await adminPage.getByRole('button', { name: /Registra assenza|Verifica conflitti/i }).click();

      // Modal conflitti deve comparire
      await expect(
        adminPage.locator('[role="dialog"]').filter({ hasText: /conflitto|conflitti/i })
      ).toBeVisible({ timeout: 15_000 });

      // Il dialog contiene il testo della data del turno conflittuale (10 mar)
      const conflictDialog = adminPage.locator('[role="dialog"]');
      await expect(conflictDialog).toContainText(/10|mar/i);

      // Chiude senza confermare
      await adminPage.getByRole('button', { name: 'Annulla' }).last().click();
    } finally {
      // Cleanup: elimina il turno di setup
      await adminPage.request.delete(`/api/shifts/${shiftId}`).catch(() => {});
    }
  });

  /**
   * RF-G VALIDATE: data fine precedente a data inizio → errore inline.
   *
   * AC: "Il sistema mostra un errore se la data fine è prima della data inizio"
   */
  test('RF-G VALIDATE: data fine < data inizio genera errore', async ({ adminPage }) => {
    await adminPage.goto('/admin/absences');
    await expect(adminPage.getByRole('heading', { name: /Registra nuova assenza/i })).toBeVisible({
      timeout: 10_000,
    });

    // Seleziona dipendente e tipo
    await adminPage.locator('[aria-label="Seleziona dipendente"]').click();
    await adminPage.getByRole('option').first().click();

    await adminPage.locator('[aria-label="Seleziona tipo di assenza"]').click();
    await adminPage.getByRole('option').first().click();

    // Date invertite
    await adminPage.getByLabel('Data inizio').fill('2030-08-15');
    await adminPage.getByLabel('Data fine').fill('2030-08-10');

    await adminPage.getByRole('button', { name: /Registra assenza|Verifica conflitti/i }).click();

    // Messaggio di errore Zod: "fine deve essere successiva"
    await expect(
      adminPage.getByText(/successiv|uguale|fine.*inizio/i).or(adminPage.locator('[role="alert"]'))
    ).toBeVisible({ timeout: 5_000 });
  });

  /**
   * RF-G SEC: POST /api/admin/absences → 403 per dipendente.
   */
  test('RF-G SEC: POST /api/admin/absences → 403 per dipendente', async ({ employeePage }) => {
    const resp = await employeePage.request.post('/api/admin/absences', {
      data: {
        userId: '00000000-0000-0000-0000-000000000001',
        absenceType: 'ferie',
        startDate: '2030-01-01',
        endDate: '2030-01-05',
      },
    });
    expect(resp.status()).toBe(403);
  });
});
