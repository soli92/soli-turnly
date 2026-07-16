# Turnly — Report sessione E2E: debug e fix test Playwright

> **Data sessione:** 2026-07-15
> **Scope:** Risoluzione completa dei test E2E falliti dopo le modifiche UI di CQRL iter-3.
> **Risultato finale:** 111/111 test passati (5 skip attesi), exit code 0.

---

## Contesto

Al termine della sessione precedente il progetto aveva 18–19 test E2E Playwright falliti su un
totale di circa 62 test E2E (esclusi visual). Le cause erano miste: infrastruttura, selettori
obsoleti, architettura delle pagine fraintesa nei test.

---

## Problemi riscontrati e soluzioni

### 1. API `POST /api/requests` — status `'draft'` invece di `'sent'`

**File:** `code/app/app/api/requests/route.ts`

**Problema:** Le richieste create via API finivano in stato `'draft'`. Il componente
`ApprovalQueueClient` filtra per `status='sent'`, quindi le richieste non apparivano mai
nella coda admin.

**Fix:**

```typescript
// Prima:
status: 'draft',
// Dopo:
status: 'sent',
```

---

### 2. Playwright config — workers con spread condizionale

**File:** `code/app/playwright.config.ts`

**Problema:** `...(process.env.CI ? { workers: 1 } : {})` non veniva riconosciuto
correttamente in alcuni ambienti.

**Fix:**

```typescript
workers: process.env.CI ? 1 : 3,
```

---

### 3. shadcn/ui `FormLabel`/`FormControl` — accessible name non associato

**Scope:** Decine di campi in tutta la suite.

**Problema:** shadcn/ui usa `FormLabel` + `FormControl` ma **non genera l'associazione
`htmlFor`/`id`** che Playwright richiede per `getByLabel()`. Il campo non ha accessible name
derivante dalla label; il fallback è il placeholder.

**Pattern di fix (due varianti):**

```typescript
// Variante A — placeholder visibile nel form
await dlg.getByPlaceholder('Es. Turno Notte').fill('Turno Test');

// Variante B — attributo name spread da react-hook-form {…field}
await adminPage.locator('input[name="startDate"]').fill('2030-07-01');
```

**File coinvolti:** `shift-types.spec.ts`, `absences.spec.ts`, `employee-requests.spec.ts`,
`domain/requests.spec.ts`.

---

### 4. `shift-types.spec.ts` — tre root cause distinte

**File:** `code/app/tests/e2e/sprint2/shift-types.spec.ts`

| Root cause | Fix |
|---|---|
| `getByLabel('Nome')` fallisce | `getByPlaceholder('Es. Turno Notte')` scoped al dialog |
| `/api/shift-types` restituisce array diretto, non `{ data: [] }` | `const rows = (await resp.json()) as Array<{…}>` |
| Campo Codice auto-normalizza minuscole → maiuscolo (sempre valido) | Il test lascia il campo vuoto per triggerare la validazione `required` |
| `locator('[role="alert"]').or(…)` → strict mode: 3 elementi | Aggiunto `.first()` |

---

### 5. `requests-admin.spec.ts` — architettura pagina fraintesa

**File:** `code/app/tests/e2e/sprint2/requests-admin.spec.ts`

**Problema:** Il test cercava `testid="approval-panel"` nella pagina lista
(`/admin/requests`). La pagina lista usa `RequestQueue` (tabella con link "Apri dettaglio").
Il pannello di approvazione (`ApprovalActions`, `testid="approval-actions"`) è sulla pagina di
**dettaglio** (`/admin/requests/{id}`).

**Fix:** Tutti i test che richiedono approvazione ora:
1. Creano la richiesta via `POST /api/requests`
2. Estraggono l'`id` dalla response
3. Navigano direttamente a `/admin/requests/{id}`
4. Interagiscono con `approval-actions`, `approve-btn`, `reject-btn`

**Fix correlato:** `waitForLoadState('networkidle')` rimosso — la connessione SSE mantiene
la rete perennemente attiva; sostituito con `waitForLoadState('domcontentloaded')`.

---

### 6. `employee-calendar.spec.ts` — classe CSS React Big Calendar assente

**File:** `code/app/tests/e2e/sprint2/employee-calendar.spec.ts`

**Problema:** Il test cercava `.rbc-toolbar-label` (classe di default RBC). La toolbar
usa un componente custom (`CalendarToolbar`) che non usa quella classe.

**Fix:**

```typescript
// Prima:
const monthLabel = employeePage.locator('.rbc-toolbar-label');
// Dopo:
const monthLabel = employeePage.locator('[aria-live="polite"][aria-atomic="true"]').first();
```

**Riferimento componente:** `CalendarToolbar.tsx` espone il periodo con
`<span aria-live="polite" aria-atomic="true">`.

---

### 7. `coverage.spec.ts` — due selettori non affidabili

**File:** `code/app/tests/e2e/sprint2/coverage.spec.ts`

| Problema | Fix |
|---|---|
| `getByLabel(/Minimo/i)` nel dialog non trova il campo | `locator('[role="dialog"] input[name="minimumCount"]')` |
| `[class*="text-sm"][class*="font-medium"]` troppo generico per il periodo | `getByRole('grid', { name: /Monitor copertura/i })` → `getAttribute('aria-label')` per leggere il periodo |

---

### 8. `recurrence.spec.ts` — tre problemi distinti

**File:** `code/app/tests/e2e/sprint2/recurrence.spec.ts`

**Problema A — testo bottone dinamico:**  
Il bottone "Genera" in `RecurrencePreviewStep` ha testo dinamico:
```typescript
`Genera ${turniDaGenerare} turno${turniDaGenerare !== 1 ? 'i' : ''}`
```
Il test cercava `/Genera turni/i` che non matcha "Genera 5 turni".

**Fix:** `/^Genera/i`

**Problema B — bottone assente durante caricamento:**  
`RecurrencePreviewStep` restituisce un early return durante il caricamento della preview API
(solo spinner, nessun bottone). Il bottone "Genera" appare solo quando `isPreviewLoading === false`.

**Fix:** Timeout esteso a 30s per il bottone Genera; heading step 3 cercato con
`getByRole('heading', { name: /Passo 3/i })` (timeout 20s) invece di `getByText`.

**Problema C — selezione dipendente non registrata in React:**  
La lista dipendenti nel wizard step 2 è caricata via API (asincrona). Il test tentava la
selezione prima che la lista fosse disponibile. Inoltre, `check()` su checkbox controllato
React non garantisce che il `onChange` handler venga invocato correttamente.

**Fix:**
```typescript
// Attende caricamento lista
await expect(firstEmployeeCheckbox).toBeVisible({ timeout: 10_000 });
// Usa click() invece di check() per garantire l'invocazione di onChange
await firstEmployeeCheckbox.click();
await expect(firstEmployeeCheckbox).toBeChecked({ timeout: 3_000 });
```

**Navigazione step 2→3:** Usa il nome esatto `'Avanti: Anteprima'` invece del generico
`/Avanti/i` per evitare ambiguità.

---

### 9. `employee-requests.spec.ts` — strict mode violation sul successo

**File:** `code/app/tests/e2e/sprint2/employee-requests.spec.ts`

**Problema:** Dopo l'invio della richiesta, `router.push('/requests')` reindirizza alla lista.
Il testo di controllo `/inviata/i` matchava 20 card ("Inviata: 15 lug" in ciascuna) →
strict mode violation.

**Fix:**
```typescript
// Prima:
await expect(employeePage.getByText(/inviata|successo/i)).toBeVisible({ timeout: 10_000 });
// Dopo:
await employeePage.waitForURL('**/requests', { timeout: 10_000 });
await expect(employeePage.getByRole('heading', { name: /Le mie richieste/i })).toBeVisible();
```

**Problema correlato:** `waitForLoadState('networkidle')` per pagine con SSE → timeout.
**Fix:** `waitForLoadState('domcontentloaded')`.

---

### 10. `domain/requests.spec.ts` T-REQ-01 — stessi problemi #3 e #9

**File:** `code/app/tests/e2e/domain/requests.spec.ts`

- Date fields: `getByLabel('Data inizio')` → `locator('input[name="startDate"]')`
- Success check: `waitForURL('**/requests', { timeout: 10_000 })`
- Flusso approvazione: ora naviga a `/admin/requests/{id}` via API, usa `approval-actions`

---

## Pattern generali scoperti

### A — shadcn/ui e Playwright: accessible name non si propaga

In shadcn/ui, `FormLabel` e `FormControl` **non creano l'associazione `htmlFor`/`id`**
che Playwright usa per `getByLabel()`. L'accessible name dell'input è il **placeholder**
(se esiste) o nulla.

**Regola pratica:** Per input shadcn/ui in react-hook-form, usare:
- `getByPlaceholder(…)` per i campi con placeholder visibile
- `locator('input[name="…"]')` sfruttando lo spread `{…field}` di react-hook-form

### B — SSE e `waitForLoadState('networkidle')`

Le pagine con connessione SSE attiva non raggiungono mai `'networkidle'` perché il canale
SSE mantiene una connessione HTTP aperta. Usare sempre `'domcontentloaded'` o
`'load'` per queste pagine.

### C — Strict mode in Playwright con `.or()`

`locatorA.or(locatorB).toBeVisible()` lancia strict mode violation se entrambi i locator
matchano elementi visibili simultaneamente. Aggiungere `.first()` per risolvere.

### D — Bottoni React Big Calendar vs toolbar custom

I selettori basati su classi CSS di default RBC (`.rbc-toolbar-label`, `.rbc-btn-group`)
non funzionano con toolbar custom. Usare attributi semantici: `aria-live`, `aria-label`,
`role`.

### E — Check controllato React con Playwright

Su `input[type="checkbox"]` controllato (React): preferire `.click()` a `.check()`.
Il metodo `check()` potrebbe non triggerare il synthetic event `onChange` che React ascolta.
Dopo il click, verificare lo stato con `expect(el).toBeChecked()` per attendere il re-render.

---

## Struttura delle pagine admin (note per test futuri)

| Pagina | Componente principale | Note per test |
|---|---|---|
| `/admin/requests` | `RequestQueue` | Tabella con link "Apri dettaglio"; nessun pannello approvazione |
| `/admin/requests/{id}` | `RequestDetailClient` + `ApprovalActions` | `testid="approval-actions"`, `approve-btn`, `reject-btn` |
| `/admin/recurrence/new` | `RecurrenceWizard` | 3 step; step 2 carica utenti via API (attesa necessaria) |
| `/calendar` | `EmployeeCalendar` | `section[aria-label="Calendario turni personali"]`; toolbar custom |
| `/admin/coverage` | Tab Setup + Tab Monitor | Monitor: `getByRole('grid', { name: /Monitor copertura/i })` |

---

## Risultato finale

```
Tests:       111 passed, 5 skipped, 0 failed
Exit code:   0
Duration:    ~14 min (Chromium + Firefox + visual-desktop + visual-mobile)
Commit:      031fb66  fix(e2e): fix all failing E2E tests — 111/111 pass
```
