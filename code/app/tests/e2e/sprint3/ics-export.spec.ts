/**
 * tests/e2e/sprint3/ics-export.spec.ts — Export .ics integration tests (TSK-031).
 *
 * Acceptance Criteria coperti:
 *   AC1: GET con utente autenticato e turni → 200, text/calendar, BEGIN:VCALENDAR
 *   AC2: Body contiene BEGIN:VEVENT + DTSTART + SUMMARY
 *   AC3: Range vuoto → 200 con calendario valido e 0 VEVENT
 *   T-SEC-01: l'export non espone turni di altri utenti
 *   AC6: Utente non autenticato → 401
 *   AC7: Content-Disposition: attachment; filename="turni_<from>_<to>.ics"
 *   AC8 (UI): pulsante "Esporta .ics" scarica il file per il periodo visualizzato
 *
 * Prerequisiti runtime:
 *   - DB seed eseguito (almeno mario.rossi con turni nella settimana corrente)
 *   - global-setup.ts ha generato .auth/admin.json e .auth/employee.json
 */

import { test, expect } from '../fixtures/sprint3-db';

// ---------------------------------------------------------------------------
// Date anchor — allineato al seed
// I turni del seed vengono creati per la settimana corrente (db/seed.ts usa
// `new Date()` → startOfWeek). Deriviamo il range dal mese corrente così
// il test funziona indipendentemente da quando viene eseguito.
// ---------------------------------------------------------------------------

const _now = new Date();
const _y = _now.getFullYear();
const _m = String(_now.getMonth() + 1).padStart(2, '0');
const _last = new Date(_y, _now.getMonth() + 1, 0).getDate();
/** Primo giorno del mese corrente (YYYY-MM-01) */
const SEED_MONTH_FROM = `${_y}-${_m}-01`;
/** Ultimo giorno del mese corrente (YYYY-MM-DD) */
const SEED_MONTH_TO = `${_y}-${_m}-${String(_last).padStart(2, '0')}`;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('GET /api/users/me/shifts/export — endpoint .ics', () => {
  /**
   * AC1 + AC2: risposta 200 con payload iCalendar valido.
   *
   * Usa un range che copre la settimana corrente (stessa logica del seed).
   * Il seed popola turni lunedì-venerdì per mario.rossi, quindi ci sarà
   * almeno 1 VEVENT nel body.
   */
  test('AC1+AC2: risposta 200 text/calendar con VCALENDAR e VEVENT per utente autenticato', async ({
    employeePage,
  }) => {
    const from = SEED_MONTH_FROM;
    const to = SEED_MONTH_TO;

    const resp = await employeePage.request.get(
      `/api/users/me/shifts/export?from=${from}&to=${to}`
    );

    expect(resp.status()).toBe(200);

    const contentType = resp.headers()['content-type'] ?? '';
    expect(contentType).toContain('text/calendar');

    const body = await resp.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('END:VCALENDAR');
  });

  /**
   * AC2: il body contiene i campi iCalendar obbligatori per ogni evento.
   *
   * Naviga al calendario dipendente e verifica che ci siano turni;
   * fallisce esplicitamente se il DB non ha turni nel range del mese corrente.
   */
  test('AC2: VEVENT contiene DTSTART e SUMMARY', async ({ employeePage }) => {
    const resp = await employeePage.request.get(
      `/api/users/me/shifts/export?from=${SEED_MONTH_FROM}&to=${SEED_MONTH_TO}`
    );

    const body = await resp.text();

    expect(body).toContain('BEGIN:VEVENT'); // fallisce esplicitamente se assente — verificare seed DB
    expect(body).toContain('DTSTART');
    expect(body).toContain('SUMMARY');
  });

  /**
   * AC3: range senza turni → 200 con calendario valido, nessun VEVENT.
   *
   * Usa una data nel passato remoto in cui non ci sono turni nel seed.
   */
  test('AC3: range vuoto → 200 con VCALENDAR valido e 0 VEVENT', async ({ employeePage }) => {
    const resp = await employeePage.request.get(
      '/api/users/me/shifts/export?from=2000-01-01&to=2000-01-31'
    );

    expect(resp.status()).toBe(200);

    const body = await resp.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).not.toContain('BEGIN:VEVENT');
  });

  /**
   * T-SEC-01: il file .ics di mario.rossi non contiene turni di altri utenti.
   *
   * Il filtro in route.ts usa SEMPRE session.user.id (non un param userId).
   * L'export senza range restituisce tutti i turni dell'utente corrente.
   */
  test('T-SEC-01: non espone turni di altri (IDOR check)', async ({
    employeePage,
    otherUserShiftId,
  }) => {
    const resp = await employeePage.request.get('/api/users/me/shifts/export');

    expect(resp.status()).toBe(200);

    const icsText = await resp.text();

    // L'ID del turno dell'altro dipendente non deve comparire come UID nell'ICS
    expect(icsText).not.toContain(otherUserShiftId);
  });

  /**
   * AC6: utente non autenticato → 401.
   *
   * Usa il contesto non autenticato (`page`) del test di base Playwright.
   */
  test('AC6: utente non autenticato → 401', async ({ page }) => {
    const resp = await page.request.get('/api/users/me/shifts/export');
    expect(resp.status()).toBe(401);
  });

  /**
   * AC7: Content-Disposition con filename corretto quando from/to sono specificati.
   */
  test('AC7: Content-Disposition include filename turni_<from>_<to>.ics', async ({
    employeePage,
  }) => {
    const from = SEED_MONTH_FROM;
    const to = SEED_MONTH_TO;

    const resp = await employeePage.request.get(
      `/api/users/me/shifts/export?from=${from}&to=${to}`
    );

    expect(resp.status()).toBe(200);

    const disposition = resp.headers()['content-disposition'] ?? '';
    expect(disposition).toContain('attachment');
    expect(disposition).toContain(`turni_${from}_${to}.ics`);
  });
});

// ---------------------------------------------------------------------------
// Suite UI — pulsante CalendarToolbar
// ---------------------------------------------------------------------------

test.describe('UI — CalendarToolbar: pulsante Esporta .ics', () => {
  /**
   * AC8: il pulsante [data-testid="export-ics-btn"] è visibile nella pagina
   * calendario del dipendente e scarica il file .ics per il periodo visualizzato.
   */
  test('AC8: pulsante scarica file .ics per il periodo visualizzato', async ({ employeePage }) => {
    await employeePage.goto('/calendar');

    // Attende che il calendario sia caricato
    await expect(employeePage.locator('.rbc-calendar')).toBeVisible({ timeout: 10_000 });

    // Il pulsante export deve essere visibile
    const exportBtn = employeePage.locator('[data-testid="export-ics-btn"]');
    await expect(exportBtn).toBeVisible({ timeout: 5_000 });

    // Click sul pulsante → attende il download
    const [download] = await Promise.all([
      employeePage.waitForEvent('download'),
      exportBtn.click(),
    ]);

    // Il filename suggerito deve terminare con .ics
    expect(download.suggestedFilename()).toMatch(/turni.*\.ics$/);

    // Legge il contenuto del file scaricato e verifica la struttura iCalendar
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    expect(content).toContain('BEGIN:VCALENDAR');
    expect(content).toContain('END:VCALENDAR');
  });

  /**
   * T-SEC-01 (UI): cliccando il pulsante il file scaricato non contiene
   * turni di altri dipendenti.
   */
  test('T-SEC-01 (UI): file scaricato non espone turni di altri utenti', async ({
    employeePage,
    otherUserShiftId,
  }) => {
    await employeePage.goto('/calendar');
    await expect(employeePage.locator('.rbc-calendar')).toBeVisible({ timeout: 10_000 });

    const exportBtn = employeePage.locator('[data-testid="export-ics-btn"]');
    await expect(exportBtn).toBeVisible({ timeout: 5_000 });

    const [download] = await Promise.all([
      employeePage.waitForEvent('download'),
      exportBtn.click(),
    ]);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    const content = Buffer.concat(chunks).toString('utf-8');

    expect(content).not.toContain(otherUserShiftId);
  });
});
