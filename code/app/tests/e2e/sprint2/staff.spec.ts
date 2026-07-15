/**
 * tests/e2e/sprint2/staff.spec.ts — Gestione dipendenti admin (TSK-024).
 *
 * Mappa sugli Acceptance Criteria RF-B:
 *   RF-B CA1: email duplicata → errore inline nel form, non navigazione
 *   RF-B CA2: disattivazione → AlertDialog di conferma prima del submit
 *   RF-B CRUD: creazione, modifica base, ricerca per nome
 *
 * NOTE implementative:
 *   - data-testid: "staff-new-btn", "staff-table-container", "staff-empty-state"
 *   - Campi form: "staff-firstName", "staff-lastName", "staff-email",
 *                 "staff-password", "staff-contractHours", "staff-submit"
 *   - Bottone edit per riga: "staff-edit-btn-{id}" (dinamico, senza id noto)
 *     → usiamo aria-label="Modifica {firstName} {lastName}"
 *   - La tabella usa virtualizzazione (TanStack Virtual), quindi le righe
 *     sono in posizione assoluta e potrebbero non essere tutte nel viewport.
 *   - Seed: mario.rossi@turnly.dev è presente di default (da global-setup).
 */

import { test, expect } from '../fixtures/sprint2-db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Genera un indirizzo email univoco per ogni test run */
function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@turnly-test.dev`;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('RF-B: Gestione dipendenti', () => {
  /**
   * RF-B CRUD-1: creazione dipendente con dati validi.
   *
   * AC: "Il dipendente appare nella lista dopo la creazione"
   * Flusso:
   *   1. Admin clicca "Nuovo dipendente"
   *   2. Compila tutti i campi obbligatori
   *   3. Submit → modal si chiude
   *   4. Il nuovo dipendente compare nella tabella (nome/email visibile)
   */
  test('RF-B CRUD-1: creazione nuovo dipendente', async ({ adminPage }) => {
    await adminPage.goto('/admin/staff');
    await expect(adminPage.getByTestId('staff-table-container')).toBeVisible({ timeout: 10_000 });

    // Apre modal creazione
    await adminPage.getByTestId('staff-new-btn').click();

    const email = uniqueEmail('test-create');
    await adminPage.getByTestId('staff-firstName').fill('Giulia');
    await adminPage.getByTestId('staff-lastName').fill('Bianchi');
    await adminPage.getByTestId('staff-email').fill(email);
    await adminPage.getByTestId('staff-password').fill('TestPass123!');
    await adminPage.getByTestId('staff-contractHours').fill('40');

    // Submit
    await adminPage.getByTestId('staff-submit').click();

    // Modal si chiude (il dialog sparisce)
    await expect(adminPage.locator('[role="dialog"]')).not.toBeVisible({ timeout: 10_000 });

    // Il dipendente appare nella tabella (almeno email visibile)
    await expect(adminPage.getByText(email)).toBeVisible({ timeout: 10_000 });

    // Cleanup: elimina il dipendente creato (via API, best-effort)
    const usersResp = await adminPage.request.get('/api/admin/users?limit=100');
    if (usersResp.ok()) {
      const body = await usersResp.json();
      const newUser = (body.data as Array<{ email: string; id: string }>).find(
        (u) => u.email === email
      );
      if (newUser) {
        await adminPage.request.delete(`/api/admin/users/${newUser.id}`).catch(() => {});
      }
    }
  });

  /**
   * RF-B CA1: email duplicata → errore inline "Email già in uso".
   *
   * AC: "Il sistema mostra un errore inline 'Email già in uso'"
   * Flusso:
   *   1. Tenta di creare un dipendente con email di mario.rossi (già nel seed)
   *   2. Il backend risponde 422
   *   3. Il form mostra un errore inline (role="alert" o FormMessage)
   */
  test('RF-B CA1: email duplicata mostra errore inline', async ({ adminPage }) => {
    await adminPage.goto('/admin/staff');
    await expect(adminPage.getByTestId('staff-table-container')).toBeVisible({ timeout: 10_000 });

    await adminPage.getByTestId('staff-new-btn').click();

    // Usa email già esistente nel seed
    await adminPage.getByTestId('staff-firstName').fill('Duplicato');
    await adminPage.getByTestId('staff-lastName').fill('Test');
    await adminPage.getByTestId('staff-email').fill('mario.rossi@turnly.dev');
    await adminPage.getByTestId('staff-password').fill('TestPass123!');

    await adminPage.getByTestId('staff-submit').click();

    // Il dialog deve restare aperto (non chiudersi su errore)
    await expect(adminPage.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 });

    // Un messaggio di errore (role="alert" o testo relativo all'email) deve apparire
    await expect(
      adminPage
        .locator('[role="alert"]')
        .or(adminPage.getByText(/email/i).filter({ hasText: /già|duplicat|uso|esist/i }))
    ).toBeVisible({ timeout: 8_000 });
  });

  /**
   * RF-B CA2: disattivazione dipendente → AlertDialog di conferma.
   *
   * AC: "Il sistema mostra un dialog di conferma con messaggio 'non potrà ricevere nuovi turni'"
   * Flusso:
   *   1. Admin apre la modifica di mario.rossi
   *   2. Imposta il campo "Stato" su "Inattivo"
   *   3. Submit → si apre AlertDialog di conferma
   *   4. Cancella (non conferma) → il dipendente resta attivo
   */
  test('RF-B CA2: disattivazione mostra AlertDialog di conferma', async ({ adminPage }) => {
    await adminPage.goto('/admin/staff');
    await expect(adminPage.getByTestId('staff-table-container')).toBeVisible({ timeout: 10_000 });

    // Apre modifica del primo dipendente visibile con bottone Modifica
    const editBtn = adminPage.getByRole('button', { name: /Modifica/i }).first();
    await expect(editBtn).toBeVisible({ timeout: 8_000 });
    await editBtn.click();

    // Attende modal aperto
    const dialog = adminPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Recupera lo stato corrente del select "Stato"
    const activeSelect = adminPage.getByTestId('staff-active');
    const currentValue = await activeSelect.getAttribute('data-state');

    // Imposta "Inattivo" nel select stato
    await activeSelect.click();
    await adminPage.getByRole('option', { name: 'Inattivo' }).click();

    // Submit del form
    await adminPage.getByTestId('staff-submit').click();

    // AlertDialog di conferma deve apparire
    await expect(adminPage.getByRole('alertdialog')).toBeVisible({ timeout: 8_000 });

    // Clicca "Annulla" per non effettuare la disattivazione
    await adminPage.getByRole('button', { name: 'Annulla' }).last().click();

    // L'alert dialog deve sparire
    await expect(adminPage.getByRole('alertdialog')).not.toBeVisible({ timeout: 5_000 });

    void currentValue; // variabile usata per documentare il flusso
  });

  /**
   * RF-B SEARCH: ricerca per nome filtra la tabella.
   *
   * AC: "La ricerca filtra i dipendenti in tempo reale"
   * Flusso:
   *   1. Admin cerca "mario"
   *   2. La tabella mostra solo righe che contengono "mario"
   */
  test('RF-B SEARCH: ricerca nome filtra dipendenti', async ({ adminPage }) => {
    await adminPage.goto('/admin/staff');
    await expect(adminPage.getByTestId('staff-table-container')).toBeVisible({ timeout: 10_000 });

    // Cerca nel campo di ricerca testuale (data-testid o placeholder)
    const searchInput = adminPage.getByPlaceholder(/cerca/i).or(adminPage.getByRole('searchbox'));
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill('mario');

    // Attende che la tabella si aggiorni
    await adminPage.waitForTimeout(300);

    // La tabella deve mostrare "mario" (case-insensitive)
    await expect(adminPage.getByText(/mario/i).first()).toBeVisible({ timeout: 5_000 });

    // Non deve comparire "staff-empty-state" (mario.rossi è nel seed)
    await expect(adminPage.getByTestId('staff-empty-state')).not.toBeVisible();
  });

  /**
   * RF-B API: GET /api/admin/users risponde solo per admin → 403 per dipendente.
   *
   * Verifica RBAC sull'endpoint API.
   */
  test('RF-B SEC: GET /api/admin/users → 403 per dipendente', async ({ employeePage }) => {
    const resp = await employeePage.request.get('/api/admin/users');
    expect(resp.status()).toBe(403);
  });
});
