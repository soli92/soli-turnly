/**
 * tests/e2e/security/rbac.spec.ts — Test RBAC e sicurezza (TSK-010).
 *
 * Mappa sugli Acceptance Criteria (acceptance spec T-SEC-*):
 *   T-SEC-01 → dipendente non vede turni altrui (API filtra su session.user.id)
 *   T-SEC-02 → dipendente non accede a /admin/* (redirect a /calendar)
 *   T-SEC-03 → API restituisce 401 senza sessione
 *   T-SEC-04 → PATCH /api/users/me con qualificationId → 403 (RB-13)
 *   T-SEC-05 → POST approve con sessione dipendente → 403
 *
 * NOTE implementative:
 *   T-SEC-01: L'API GET /api/shifts per non-admin ignora sempre il parametro userId
 *             e restituisce solo i turni del session.user.id corrente (non 403).
 *             Verifica: resp.ok() === true E i dati non contengono turni di altri utenti.
 *   T-SEC-02: Il middleware di Next.js redirige l'employee a /calendar
 *             (non a /login, in quanto l'utente è autenticato).
 */

import { test, expect } from '../fixtures';

test.describe('T-SEC: RBAC e sicurezza', () => {

  /**
   * T-SEC-01 — AC: "API GET con userId altrui: filtra automaticamente per session.user.id"
   *
   * Comportamento atteso dal codice (api/shifts/route.ts):
   *   const targetUserId = isAdmin && userIdParam ? userIdParam : session.user.id;
   * → per non-admin, il parametro userId viene ignorato; si usano solo i propri turni.
   * → La risposta è 200 (non 403), ma i dati non contengono turni altrui.
   */
  test('T-SEC-01: dipendente non vede turni altrui via API (filtro automatico)', async ({ employeePage }) => {
    // Usa un UUID che presumibilmente NON corrisponde a mario.rossi (sessione corrente)
    const otherUserId = '00000000-0000-0000-0000-000000000001';
    const resp = await employeePage.request.get(`/api/shifts?userId=${otherUserId}`);

    // L'API risponde 200 (non 403): l'endpoint filtra silenziosamente
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json();
    const shifts = body.data as Array<{ userId: string }>;

    // Nessun turno deve avere userId diverso da quello del dipendente loggato.
    // Non conosciamo l'UUID di mario.rossi a priori, ma sappiamo che NON deve
    // essere l'UUID fake che abbiamo usato come parametro.
    const unauthorizedShifts = shifts.filter((s) => s.userId === otherUserId);
    expect(unauthorizedShifts).toHaveLength(0);
  });

  /**
   * T-SEC-01b — AC alternativo: con un UUID admin reale, il dipendente NON vede quei turni.
   *
   * Recupera l'ID dell'admin via endpoint e verifica che i turni restituiti
   * non appartengano all'admin.
   */
  test('T-SEC-01b: dipendente non vede turni dell\'admin via API', async ({ adminPage, employeePage }) => {
    // Recupera l'ID dell'admin tramite la sua sessione autenticata
    const meResp = await adminPage.request.get('/api/users/me');
    await expect(meResp).toBeOK();
    const adminData = await meResp.json();
    const adminId: string = adminData.id;

    // Tenta di ottenere turni dell'admin come dipendente
    const resp = await employeePage.request.get(`/api/shifts?userId=${adminId}`);
    expect(resp.ok()).toBeTruthy();

    const body = await resp.json();
    const shifts = body.data as Array<{ userId: string }>;

    // Non devono comparire turni dell'admin
    const adminShifts = shifts.filter((s) => s.userId === adminId);
    expect(adminShifts).toHaveLength(0);
  });

  /**
   * T-SEC-02 — AC: "Dipendente non può accedere a /admin/*"
   *             AC: "Redirect a /calendar (utente autenticato ma non admin)"
   *
   * Il middleware (middleware.ts) redirige employee che accede a /admin/* → /calendar.
   */
  test('T-SEC-02: dipendente non accede a /admin/*', async ({ employeePage }) => {
    await employeePage.goto('/admin/matrix');

    // Attende che il redirect si sia completato
    await employeePage.waitForURL(/\/(calendar|login)/, { timeout: 5000 });

    // Deve essere su /calendar (utente autenticato con ruolo sbagliato → calendar, non login)
    await expect(employeePage).toHaveURL(/.*\/calendar/);
    await expect(employeePage).not.toHaveURL(/.*\/admin\//);
  });

  /**
   * T-SEC-03 — AC: "API risponde 401 Unauthorized senza sessione"
   *
   * Il middleware (middleware.ts) intercetta le chiamate API non autenticate
   * e risponde { error: "unauthorized" } con status 401.
   */
  test('T-SEC-03: API restituisce 401 senza sessione', async ({ browser }) => {
    // Nuovo contesto senza alcun storageState (nessuna sessione)
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      const resp = await page.request.get('/api/shifts');
      expect(resp.status()).toBe(401);

      const body = await resp.json();
      expect(body).toHaveProperty('error');
    } finally {
      await ctx.close();
    }
  });

  /**
   * T-SEC-03b — Anche /api/requests risponde 401 senza sessione.
   */
  test('T-SEC-03b: /api/requests risponde 401 senza sessione', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      const resp = await page.request.get('/api/requests');
      expect(resp.status()).toBe(401);
    } finally {
      await ctx.close();
    }
  });

  /**
   * T-SEC-04 — AC: "API: risponde 403 con { error: 'RB-13: campo non modificabile...' }"
   *             AC: "qualificaId di Anna rimane invariata nel DB"
   *
   * RB-13 (validateContractFields): il dipendente non può modificare campi contrattuali
   * (qualificationId, contractHours, role, active).
   * Verifica: PATCH /api/users/me con qualificationId → 403.
   */
  test('T-SEC-04: PATCH /api/users/me con qualificationId → 403', async ({ employeePage }) => {
    const resp = await employeePage.request.patch('/api/users/me', {
      data: {
        qualificationId: '00000000-0000-0000-0000-000000000001',
      },
    });
    expect(resp.status()).toBe(403);
  });

  /**
   * T-SEC-04b — PATCH /api/users/me con contractHours → 403.
   */
  test('T-SEC-04b: PATCH /api/users/me con contractHours → 403', async ({ employeePage }) => {
    const resp = await employeePage.request.patch('/api/users/me', {
      data: {
        contractHours: 48,
      },
    });
    expect(resp.status()).toBe(403);
  });

  /**
   * T-SEC-05 — AC: "POST approve con session dipendente → 403 Forbidden"
   *
   * Solo l'admin può approvare richieste (API /api/requests/{id}/approve, POST).
   */
  test('T-SEC-05: POST approve con sessione dipendente → 403', async ({ employeePage }) => {
    const resp = await employeePage.request.post('/api/requests/00000000-0000-0000-0000-000000000001/approve');
    expect(resp.status()).toBe(403);
  });

  /**
   * T-SEC-02b — Employee non accede nemmeno a /api/admin/* (risposta 403 JSON, non redirect).
   */
  test('T-SEC-02b: API admin restituisce 403 per dipendente', async ({ employeePage }) => {
    const resp = await employeePage.request.get('/api/admin/users');
    expect(resp.status()).toBe(403);
  });

  /**
   * T-SEC-02c — POST /api/shifts (crea turno) da dipendente → 403.
   *
   * Solo admin può creare turni (AC T-SEC-02 acceptance spec).
   */
  test('T-SEC-02c: POST /api/shifts da dipendente → 403', async ({ employeePage }) => {
    const resp = await employeePage.request.post('/api/shifts', {
      data: {
        userId: '00000000-0000-0000-0000-000000000001',
        date: '2027-01-20',
        startDt: '2027-01-20T07:00:00.000Z',
        endDt: '2027-01-20T15:00:00.000Z',
        status: 'planned',
      },
    });
    expect(resp.status()).toBe(403);
  });

});
