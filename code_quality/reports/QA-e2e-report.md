# QA E2E Report — soli-turnly
Data: 2026-07-15

---

## Playwright Config

**File:** `code/app/playwright.config.ts`

| Parametro | Valore |
|-----------|--------|
| `testDir` | `./tests/e2e` |
| `webServer.command` | `npm run dev` |
| `webServer.url` | `http://localhost:3000` |
| `webServer.reuseExistingServer` | `true` (non-CI) |
| `globalSetup` | `./tests/e2e/global-setup.ts` |
| `fullyParallel` | `true` |
| `retries` | `0` (non-CI) |

**Progetti configurati:**

| Progetto | testDir | Browser |
|----------|---------|---------|
| `setup` | `./tests/e2e` | — (pattern `*.setup.ts`) |
| `chromium` | `./tests/e2e` | Desktop Chrome |
| `firefox` | `./tests/e2e` | Desktop Firefox |
| `a11y` | `./tests/a11y` | Desktop Chrome |
| `visual-desktop` | `./tests/visual` | Desktop Chrome 1280×800 |
| `visual-mobile` | `./tests/visual` | Desktop Chrome 375×812 |

---

## Test Execution

### Prerequisiti verificati

| Check | Esito | Dettaglio |
|-------|-------|-----------|
| Browser Playwright installati | OK | Chromium v1228, Firefox v1532, WebKit v2311 |
| PostgreSQL (localhost:5432/turnly) | OK | 13 tabelle, 7 utenti seed |
| Auth state files (`.auth/`) | OK | `admin.json`, `employee.json`, `colleague.json` presenti |
| soli-turnly dev server | RUNNING (porta 3001) | `next dev --turbopack --port 3001` (PID 94326) |

### Blocco: Port conflict e NextAuth 500

**Root cause primario — Port mismatch:**
`playwright.config.ts` ha `webServer.url: http://localhost:3000`, ma il dev server di soli-turnly e' avviato su **porta 3001** (ENV: `AUTH_URL=http://localhost:3001`, `NEXTAUTH_URL=http://localhost:3001`). La porta 3000 e' occupata da una diversa applicazione (**ACN portale-servizi**, stack Astro) che non ha nessun form `[name="email"]`.

Con `reuseExistingServer: true`, Playwright si connette al server esistente su 3000 (il portale-servizi errato) invece di avviare quello di soli-turnly.

**Root cause secondario — NextAuth 500 su porta 3001:**
Anche impostando `PLAYWRIGHT_BASE_URL=http://localhost:3001`, la pagina `/login` e tutti gli endpoint `/api/auth/*` (csrf, session, providers) restituiscono **HTTP 500 Internal Server Error**. Il middleware di auth funziona correttamente (root `/` → 307 redirect to `/login`), le API protette rispondono correttamente (401/403), ma il route handler NextAuth e la Server Component `/login` crashano a runtime. Causa esatta non determinabile senza accesso ai log del server Next.js.

### Tentativo di esecuzione

```
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e -- --reporter=list --project=chromium
```

**Risultato:**
```
TimeoutError: page.fill: Timeout 30000ms exceeded.
  - waiting for locator('[name="email"]')
  at global-setup.ts:32
```

Global setup (`tests/e2e/global-setup.ts`) non riesce a compilare la sessione admin: naviga su `/login`, attende `[name="email"]` per 30s, ma la pagina restituisce 500 e il form non viene mai renderizzato.

**0/272 test eseguiti.**

### Test totali (listing)

```
npx playwright test --list  →  272 tests in 33 files
```

| Suite | File | Test totali |
|-------|------|-------------|
| E2E (chromium + firefox) | 11 spec files | ~80 test |
| A11y | 4 spec files | ~40 test |
| Visual (desktop + mobile) | 18 spec files | ~152 test |

---

## Sprint 3 Coverage

**Sprint 3 — pagine target:** availability, swap, reports, notifications, email (ICS export), requests/new (wizard sprint 3)

**Pagine coperte da spec: 6/6**

| # | Pagina / Route | File spec | Suite | Test Sprint 3 |
|---|----------------|-----------|-------|---------------|
| 1 | `/availability` (TSK-025) | `visual/sprint3/availability.spec.ts`, `a11y/sprint3/a11y-sprint3.spec.ts` | visual (2 viewport) + a11y | 9 |
| 2 | `/admin/swap` (TSK-026) | `visual/sprint3/swap-admin.spec.ts`, `a11y/sprint3/a11y-sprint3.spec.ts` | visual (2 viewport) + a11y | 8 |
| 3 | `/admin/reports/overtime` (TSK-027) | `visual/sprint3/reports-overtime.spec.ts`, `a11y/sprint3/a11y-sprint3.spec.ts` | visual (2 viewport) + a11y | 8 |
| 4 | `/notifications` (TSK-028) | `visual/sprint3/notifications.spec.ts`, `a11y/sprint3/a11y-sprint3.spec.ts` | visual (2 viewport) + a11y | 10 |
| 5 | `/requests/new` — tipi sprint 3 (shift_swap, new_shift, modify_shift) | `a11y/sprint3/a11y-sprint3.spec.ts` | a11y | 3 |
| 6 | `/api/users/me/shifts/export` + `/calendar` ICS (TSK-031) | `e2e/sprint3/ics-export.spec.ts` | E2E API + UI (chromium + firefox) | 16 |

**Totale Sprint 3: 57 test** (inclusi chromium + firefox per gli E2E, visual-desktop + visual-mobile per i visual).

### Copertura Acceptance Spec (turnly-acceptance.yaml)

I test E2E Sprint 3 coprono esplicitamente i seguenti acceptance criteria da `turnly-acceptance.yaml`:

| AC | Covered by |
|----|-----------|
| T-SEC-01 (IDOR) | `ics-export.spec.ts` (API + UI) |
| T-SWP-01, T-SWP-02 | `visual/sprint3/swap-admin.spec.ts` (UI smoke) |
| T-DOM-06 (straordinari) | `visual/sprint3/reports-overtime.spec.ts` (UI smoke) |

I test di dominio core (T-DOM-01..08, T-REC-*, T-REQ-*, T-SEC-02..05) sono coperti dai test Sprint 1/2 in `e2e/domain/`, `e2e/security/`, `e2e/sprint2/`.

---

## Root Cause: Fix necessari per sbloccare

1. **Allineare `playwright.config.ts`**: cambiare `webServer.url` da `http://localhost:3000` a `http://localhost:3001` (o aggiungere `PORT` come variabile d'ambiente).
2. **Risolvere il NextAuth 500**: investigare i log del server Next.js su porta 3001; probabile errore nella inizializzazione del modulo `@/auth` o in una delle route `/api/auth/[...nextauth]`. Verificare se c'e' un errore di compilazione Turbopack con i Server Actions (`'use server'`) in combinazione con NextAuth v5.
3. **Stop portale-servizi su porta 3000** (o usare variabile `PLAYWRIGHT_BASE_URL` nel workflow CI) per evitare il conflitto.

---

## Summary: BLOCKED

| Metrica | Valore |
|---------|--------|
| Test totali in suite | 272 |
| Test eseguiti | 0 |
| Test passati | N/A |
| Test falliti | N/A |
| Sprint 3 spec coverage | 6/6 pagine coperte |
| Sprint 3 test count | 57 test (non eseguiti) |
| Blocco | Global setup — NextAuth 500 su /login + port mismatch (3000 vs 3001) |
| Auth state files cached | Presenti (admin.json, employee.json, colleague.json) |
| Database | OK (7 utenti, 13 tabelle) |
| Browser installati | OK (Chromium, Firefox, WebKit) |
