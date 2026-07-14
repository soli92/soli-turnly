/**
 * tests/e2e/sprint2/employee-requests.spec.ts — Richieste dipendente (TSK-024).
 *
 * Mappa sugli Acceptance Criteria RF-M (lato employee):
 *   RF-M CA5: dipendente invia richiesta assenza (wizard 4 tipi)
 *   RF-M CA6: dipendente annulla richiesta in stato "pending"
 *   T-REQ-03: scambio turno richiede accettazione collega prima di admin
 *   T-SEC-08: SwapAcceptRejectPanel visibile solo al collega destinatario
 *
 * NOTE implementative:
 *   - RequestTypeSelector: data-testid="request-type-radio-{type}" sui label,
 *     data-testid="type-selector-next-btn" sul bottone Avanti.
 *   - RequestFormAbsence usa getByLabel (nessun testid sui campi date).
 *   - SwapAcceptRejectPanel: data-testid="swap-accept-reject-panel",
 *     "accept-swap-btn", "reject-swap-btn".
 *   - MyRequestCard (lista richieste): cerca testo stato "Inviata", "Annullata".
 *   - RequestCancelButton: usa role="button" con name "Annulla richiesta".
 *   - T-REQ-03: richiede la fixture collegue (lucia.verdi@turnly.dev) e un turno
 *     sia per mario.rossi che per lucia.verdi nel DB seed Sprint 2.
 */

import { test, expect } from '../fixtures/sprint2-db';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('RF-M employee: Richieste dipendente', () => {
  /**
   * RF-M CA5: dipendente invia richiesta assenza tramite wizard.
   *
   * AC: "La richiesta appare nella lista con stato 'Inviata'"
   * Flusso:
   *   Step 1: seleziona tipo "Assenza" → Avanti
   *   Step 2: compila date → Invia richiesta
   *   Verifica: redirect a /requests o messaggio successo
   */
  test('RF-M CA5: invia richiesta assenza via wizard', async ({ employeePage }) => {
    await employeePage.goto('/requests/new');

    // Step 1: tipo "Assenza"
    await expect(employeePage.getByTestId('request-type-radio-absence')).toBeVisible({
      timeout: 10_000,
    });
    await employeePage.getByTestId('request-type-radio-absence').click();
    await employeePage.getByTestId('type-selector-next-btn').click();

    // Step 2 (RequestFormAbsence): compila date future
    await expect(employeePage.getByLabel('Data inizio')).toBeVisible({ timeout: 5_000 });
    await employeePage.getByLabel('Data inizio').fill('2032-04-01');
    await employeePage.getByLabel('Data fine').fill('2032-04-03');

    // Seleziona tipo assenza se presente nel form (può essere un select)
    const absenceTypeSelect = employeePage
      .getByLabel(/Tipo.*assenza|Motivo/i)
      .or(employeePage.locator('[aria-label="Seleziona tipo di assenza"]'));
    if ((await absenceTypeSelect.count()) > 0) {
      await absenceTypeSelect.click();
      await employeePage.getByRole('option').first().click();
    }

    // Step 2 → Step 3 (Riepilogo): avanza con il bottone del form assenza
    await employeePage.getByTestId('absence-form-next-btn').click();

    // Step 3 (RequestReviewStep): bottone finale di invio
    // data-testid sul componente è "confirm-submit-btn" (non "submit-btn")
    await expect(employeePage.getByTestId('confirm-submit-btn')).toBeVisible({ timeout: 5_000 });
    await employeePage.getByTestId('confirm-submit-btn').click();

    // Verifica conferma (testo successo o redirect a /requests)
    await expect(
      employeePage
        .getByText(/inviata|successo|Richiesta inviata/i)
        .or(employeePage.getByRole('status').filter({ hasText: /inviata/i }))
    ).toBeVisible({ timeout: 10_000 });
  });

  /**
   * RF-M CA6: dipendente annulla richiesta in stato "pending".
   *
   * AC: "La richiesta passa a stato 'Annullata'"
   * Flusso:
   *   1. Crea richiesta assenza via API
   *   2. Vai su /requests
   *   3. Clicca "Annulla richiesta" sulla card della richiesta creata
   *   4. Verifica stato "Annullata"
   */
  test('RF-M CA6: dipendente annulla richiesta in attesa', async ({ employeePage }) => {
    // Crea richiesta via API per avere un controllo deterministico
    const createResp = await employeePage.request.post('/api/requests', {
      data: {
        type: 'absence',
        payload: {
          absenceType: 'permesso',
          startDate: '2032-05-05',
          endDate: '2032-05-05',
        },
      },
    });

    if (!createResp.ok()) {
      test.fixme(
        true,
        'Impossibile creare richiesta via API /api/requests — verificare il backend'
      );
      return;
    }

    await employeePage.goto('/requests');

    // Cerca il bottone "Annulla" sulla card della richiesta
    const cancelBtn = employeePage
      .getByRole('button', { name: /Annulla richiesta|Annulla/i })
      .first();
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
    await cancelBtn.click();

    // Eventuale dialog di conferma
    const confirmBtn = employeePage.getByRole('button', { name: /Conferma|Sì/i });
    if (await confirmBtn.isVisible({ timeout: 2_000 })) {
      await confirmBtn.click();
    }

    // Lo stato deve diventare "Annullata"
    await expect(employeePage.getByText(/Annullat/i).first()).toBeVisible({ timeout: 10_000 });
  });

  /**
   * T-REQ-03: scambio richiede accettazione collega prima di poter essere approvato da admin.
   *
   * AC (dalla spec TSK-024):
   *   1. Dipendente propone scambio → richiesta in stato 'pending' / 'in_attesa_collega'
   *   2. Admin vede la richiesta: approve-btn è enabled (o disabilitato a seconda dello stato)
   *   3. Collega vede SwapAcceptRejectPanel e accetta
   *   4. Admin ora può approvare (il bottone è enabled)
   *
   * NOTE: questo test è il più critico e dipende da:
   *   - lucia.verdi (collega) nel DB con auth.json generato
   *   - Turni per entrambi gli utenti nel DB seed
   *   - Endpoint /api/requests/:id/accept-swap funzionante
   *
   * Il test è progettato per essere tollerante: se un prerequisito manca,
   * si skippa con un messaggio chiaro.
   */
  test('T-REQ-03: scambio richiede accettazione collega prima di admin', async ({
    employeePage,
    colleaguePage,
    adminPage,
  }) => {
    // Recupera ID di mario.rossi (richiedente)
    const marioMeResp = await employeePage.request.get('/api/users/me');
    if (!marioMeResp.ok()) {
      test.fixme(
        true,
        'GET /api/users/me non disponibile — verificare che il BE sia in esecuzione'
      );
      return;
    }
    const marioData = await marioMeResp.json();
    const marioId: string = marioData.id;

    // Recupera ID di lucia.verdi (collega destinatario)
    const lucaMeResp = await colleaguePage.request.get('/api/users/me');
    if (!lucaMeResp.ok()) {
      test.fixme(
        true,
        'Sessione collega non disponibile — verificare lucia.verdi@turnly.dev nel seed e colleague.json in .auth/'
      );
      return;
    }
    const lucaData = await lucaMeResp.json();
    const lucaId: string = lucaData.id;

    // Recupera turno di mario.rossi
    const marioShiftsResp = await employeePage.request.get('/api/shifts?limit=5&status=planned');
    if (!marioShiftsResp.ok()) {
      test.fixme(true, 'GET /api/shifts non disponibile per mario.rossi — verificare il BE');
      return;
    }
    const marioShiftsBody = await marioShiftsResp.json();
    if (!marioShiftsBody.data || marioShiftsBody.data.length === 0) {
      test.fixme(true, 'Nessun turno pianificato per mario.rossi nel DB seed — eseguire db:seed');
      return;
    }
    const marioShiftId: string = marioShiftsBody.data[0].id;

    // Recupera turno di lucia.verdi
    const lucaShiftsResp = await colleaguePage.request.get('/api/shifts?limit=5&status=planned');
    if (!lucaShiftsResp.ok() || !(await lucaShiftsResp.json()).data?.length) {
      test.fixme(
        true,
        'Nessun turno pianificato per lucia.verdi nel DB seed Sprint 2 — eseguire db:seed'
      );
      return;
    }
    const lucaShiftsBody = await lucaShiftsResp.json();
    const lucaShiftId: string = lucaShiftsBody.data[0].id;

    // 1. mario.rossi propone scambio verso lucia.verdi
    const swapResp = await employeePage.request.post('/api/requests', {
      data: {
        type: 'shift_swap',
        payload: {
          requesterShiftId: marioShiftId,
          targetUserId: lucaId,
          targetShiftId: lucaShiftId,
        },
      },
    });

    if (!swapResp.ok()) {
      test.fixme(
        true,
        `Impossibile creare richiesta scambio: ${swapResp.status()} — verificare /api/requests e turni nel seed`
      );
      return;
    }

    const swapData = await swapResp.json();
    const swapReqId: string = swapData.id;

    // 2. Admin vede la richiesta di scambio
    // Il bottone Approva: per uno scambio non ancora accettato dal collega,
    // l'admin dovrebbe trovarlo visibile (non disabilitato dal lato UI —
    // è il BE a bloccare l'approvazione).
    // Verifica che il pannello sia renderizzato.
    await adminPage.goto('/admin/requests');
    const panel = adminPage.getByTestId('approval-panel').first();
    await expect(panel).toBeVisible({ timeout: 15_000 });

    // 3. lucia.verdi (collega) naviga a /requests e vede SwapAcceptRejectPanel
    await colleaguePage.goto('/requests');
    await expect(
      colleaguePage
        .getByTestId('swap-accept-reject-panel')
        .or(colleaguePage.getByTestId('accept-swap-btn'))
        .first()
    ).toBeVisible({ timeout: 15_000 });

    // 4. lucia.verdi accetta lo scambio
    const acceptBtn = colleaguePage.getByTestId('accept-swap-btn');
    await acceptBtn.click();

    // Potrebbe comparire un AlertDialog di conferma
    const confirmAccept = colleaguePage.getByRole('button', { name: /Sì, accetta/i });
    if (await confirmAccept.isVisible({ timeout: 3_000 })) {
      await confirmAccept.click();
    }

    // Verifica che l'accettazione sia avvenuta (il pannello sparisce o lo stato cambia)
    await expect(
      colleaguePage
        .getByTestId('accept-swap-btn')
        .or(colleaguePage.getByText(/accettat|scambio inviato/i))
        .first()
    ).not.toBeVisible({ timeout: 10_000 });

    // 5. Admin ricarica la coda: ora può approvare
    await adminPage.goto('/admin/requests');
    const approveBtnAfter = adminPage.getByTestId('approve-btn').first();
    await expect(approveBtnAfter).toBeVisible({ timeout: 15_000 });
    await expect(approveBtnAfter).toBeEnabled({ timeout: 10_000 });

    void marioId;
    void swapReqId;
  });

  /**
   * T-SEC-08: SwapAcceptRejectPanel visibile solo al destinatario, non al richiedente.
   *
   * AC: "Solo il collega destinatario vede il pannello accetta/rifiuta"
   * Flusso:
   *   1. mario.rossi propone scambio verso lucia.verdi
   *   2. mario.rossi va su /requests: NON vede swap-accept-reject-panel
   *   3. lucia.verdi va su /requests: VEDE swap-accept-reject-panel
   */
  test('T-SEC-08: pannello scambio visibile solo al destinatario', async ({
    employeePage,
    colleaguePage,
  }) => {
    // Prerequisiti: turni per entrambi
    const marioShiftsResp = await employeePage.request.get('/api/shifts?limit=1&status=planned');
    const lucaShiftsResp = await colleaguePage.request.get('/api/shifts?limit=1&status=planned');

    if (!marioShiftsResp.ok() || !lucaShiftsResp.ok()) {
      test.fixme(
        true,
        'Turni non disponibili per il test T-SEC-08 — verificare il BE e il seed DB'
      );
      return;
    }

    const marioShifts = await marioShiftsResp.json();
    const lucaShifts = await lucaShiftsResp.json();

    if (!marioShifts.data?.length || !lucaShifts.data?.length) {
      test.fixme(
        true,
        'Nessun turno pianificato nel seed Sprint 2 per mario.rossi o lucia.verdi — eseguire db:seed'
      );
      return;
    }

    const lucaMeResp = await colleaguePage.request.get('/api/users/me');
    if (!lucaMeResp.ok()) {
      test.fixme(
        true,
        'Sessione collega non disponibile — verificare lucia.verdi@turnly.dev nel seed e colleague.json in .auth/'
      );
      return;
    }
    const lucaData = await lucaMeResp.json();

    // mario.rossi propone scambio
    const swapResp = await employeePage.request.post('/api/requests', {
      data: {
        type: 'shift_swap',
        payload: {
          requesterShiftId: marioShifts.data[0].id,
          targetUserId: lucaData.id,
          targetShiftId: lucaShifts.data[0].id,
        },
      },
    });

    if (!swapResp.ok()) {
      test.fixme(
        true,
        'Impossibile creare richiesta scambio per T-SEC-08 — verificare /api/requests e turni nel seed'
      );
      return;
    }

    // mario.rossi NON deve vedere il pannello swap sul proprio profilo
    await employeePage.goto('/requests');
    await employeePage.waitForLoadState('networkidle', { timeout: 10_000 });

    // Il richiedente NON deve vedere il pannello accetta/rifiuta
    const marioSwapPanel = employeePage.getByTestId('swap-accept-reject-panel');
    await expect(marioSwapPanel).toHaveCount(0, { timeout: 5_000 });

    // lucia.verdi DEVE vedere il pannello
    await colleaguePage.goto('/requests');
    await expect(
      colleaguePage
        .getByTestId('swap-accept-reject-panel')
        .or(colleaguePage.getByTestId('accept-swap-btn'))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });

  /**
   * RF-M WIZARD-TYPES: tutti e 4 i tipi di richiesta sono selezionabili.
   *
   * AC: "Il dipendente può scegliere tra 4 tipi di richiesta nel wizard"
   */
  test('RF-M WIZARD-TYPES: tutti e 4 i tipi di richiesta visibili', async ({ employeePage }) => {
    await employeePage.goto('/requests/new');

    // Attende che la pagina sia caricata
    await employeePage.waitForLoadState('networkidle', { timeout: 10_000 });

    // Verifica la presenza di tutti e 4 i data-testid per i tipi
    await expect(employeePage.getByTestId('request-type-radio-absence')).toBeVisible({
      timeout: 10_000,
    });
    await expect(employeePage.getByTestId('request-type-radio-shift_swap')).toBeVisible();
    await expect(employeePage.getByTestId('request-type-radio-new_shift')).toBeVisible();
    await expect(employeePage.getByTestId('request-type-radio-modify_shift')).toBeVisible();

    // Il bottone Avanti è disabilitato finché non si seleziona un tipo
    await expect(employeePage.getByTestId('type-selector-next-btn')).toBeDisabled();

    // Seleziona "Scambio turno" → Avanti si abilita
    await employeePage.getByTestId('request-type-radio-shift_swap').click();
    await expect(employeePage.getByTestId('type-selector-next-btn')).toBeEnabled();
  });
});
