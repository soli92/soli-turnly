# CQRL Code Review — Batch 2 · ITER 3 (FINALE) — TSK-006 … TSK-010

- **reviewer_version:** cqrl-v2.12
- **repo:** soli-turnly · `code/app`
- **generated_at:** 2026-07-14T16:10+0200
- **iter:** **3 / max_iterations 3 — ULTIMA ITERAZIONE (loop-exhausted)**
- **prev_report (baseline):** `code_quality/reports/cqrl-r2-batch-2-TSK005-009.md` (iter-2) +
  `code_quality/reports/cqrl-r2-batch-3-TSK010-016.md` (iter-2, per TSK-010)
- **passes:** idiomaticity · design · robustness (+ accessibility config-active)
- **stack_descriptor:** `typescript@5 (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes) /
  next@15 (app-router, rsc) / drizzle-orm+postgres / tanstack-{query,table,virtual} /
  react-hook-form+zod@^3 / inngest@^3 / @date-fns/tz@1.5.0 / playwright + axe-core / vitest` —
  confidence **alta** (> `confidence_min` 0.6), review **stack-aware** completa.

> **Nota di scope batch.** Il round è stato richiesto sul range **TSK-006..010**; l'iter-2 li aveva
> spalmati su batch-2 (005-009) e batch-3 (010-016). I baseline usati sono quelli reali su disco.
>
> **Nota di degradazione (ruleset).** `code_quality/rules/canonical` e `team-specific` restano **vuote**;
> `emergent/` contiene 10 bozze `status: candidate`. I `rule_id` sono citati come convenzione candidate
> (promozione = gate umano, §19.5). Nessuna regola inventata come `active`.

---

## Verdict sintetico (round 3 — FINALE)

| TSK | Titolo | iter-2 | **iter-3** | Δ | Esito fix |
|---|---|---|---|---|---|
| TSK-006 | Business Rules Engine RB-01..17 | pass | **pass** | = | Nessuna regressione (`lib/rules` intatto e pulito). |
| TSK-007 | Frontend Forms + Zod | pass | **reject** | ↓↓ | **REGRESSIONE bloccante**: `ApprovalPanel.tsx` non compila (4× tsc + 1× lint). Loop-exhausted → gate umano. |
| TSK-008 | Notifications SSE | conditional | **pass** | ↑ | Reconnect SSE + `ORDER BY NULLS FIRST` RISOLTI. Residuo LOW (backoff/401, docstring stale). |
| TSK-009 | Audit + Inngest jobs | conditional | **pass** | ↑ | DST recurring shifts RISOLTO (`TZDate.tz`). Caveat gate: file non prettier-clean. |
| TSK-010 | E2E Playwright | conditional | **pass (advisory)** | ↑ | F-010-01 (`test.fixme`) + F-010-02 (`webServer`) RISOLTI. Caveat gate: spec non prettier-clean. |

> **Verdict di batch: `conditional / BLOCKED`.** 4 TSK su 5 chiudono i loro finding di iter-2 (progresso
> reale e verificato). **Ma il batch NON è mergeable**: (1) TSK-007 ha una **regressione bloccante**
> (`reject` → gate umano, R.Q3) e (2) il **gate CQ-000 è tornato ROSSO** su tutti e tre gli assi
> (tsc + lint + prettier), in parte per la regressione TSK-007, in parte per due file del fix-set di
> **questa** iterazione non formattati. Dettaglio sotto.

---

## CQ-000 (precondizione trasversale) — **REGREDITO da VERDE a ROSSO** ⚠️

In iter-2 il gate era verde su tutti gli assi. In iter-3 (verificato in review nel workspace `code/app/`):

| Gate | iter-2 | **iter-3** | Nuovi problemi |
|---|---|---|---|
| `tsc --noEmit` | 0 err | **5 err** | 4× `ApprovalPanel.tsx` (RequestStatus/RequestRow) + 1× `tests/visual/sprint3/reports-overtime.spec.ts` |
| `next lint` (error) | 0 err | **1 err** | `no-misused-promises` in `components/requests/ApprovalPanel.tsx:228` |
| `prettier --check` | 0 file | **2 file** | `lib/jobs/generateRecurringShifts.ts` + `tests/e2e/domain/shifts.spec.ts` (**fix-set di questo batch**) |

Il gate CQ-000 è un AC hard di **TSK-012** (era `passed` in iter-2). Il suo ripristino è
**precondizione di merge** dell'intero batch. Le due sorgenti sono distinte:

- **Sorgente A (cross-batch, TSK-007):** migrazione del modello richieste non propagata. Vedi finding
  F3-007-01.
- **Sorgente B (fix-set di questo round, TSK-009/010):** due file toccati dai fix iter-3 non sono
  passati da `prettier --write`. Vedi finding F3-009-02 / F3-010-02.

---

## Esito verifica fix richiesti (iter-2 → iter-3)

### TSK-008 · SSE reconnection — **RISOLTO ✅** (era HIGH aperto)
`useNotifications.connect()` ora installa un `es.onerror` che chiude e **ri-schedula** la connessione:
`es.close(); reconnectTimeout = setTimeout(connect, 5000)` `[^src5: code/app/hooks/useNotifications.ts:116]`.
Il cleanup dell'effetto azzera il timeout e chiude l'`EventSource` corrente
`[^src5: code/app/hooks/useNotifications.ts:127]`. L'obiettivo TSK «recovery su disconnessione» è
raggiunto per i blip transitori (caso dominante). Il finding di iter-2 «reconnection ancora disabilitata»
è **materialmente chiuso** (non più `es.close()` incondizionato senza recovery).
`[^rule: sse.reconnect.preserve-recovery §Rationale]` (candidate)

### TSK-008 · `GET /api/notifications` ORDER BY — **RISOLTO ✅** (era MEDIUM aperto)
Query ora ordina `.orderBy(sql\`${notifications.readAt} NULLS FIRST\`, desc(notifications.createdAt))`
`[^src5: code/app/app/api/notifications/route.ts:40]`. Il docstring (l.6 «ORDER BY readAt NULLS FIRST,
createdAt DESC») ora **coincide** con il codice → non-lette-per-prime deterministico e paginazione
stabile. `[^rule: api.pagination.deterministic-order-by §Rationale]` (candidate)

### TSK-009 · Generazione ricorrenze DST — **RISOLTO ✅** (era HIGH aperto)
`create-shifts` non costruisce più `new Date("...T..:..:00Z")` (UTC-naive). Ora:
`new Date(TZDate.tz(APP_TIMEZONE, year, month, day, start.h, start.m, 0, 0).getTime())`
`[^src5: code/app/lib/jobs/generateRecurringShifts.ts:266]`. Verifiche di correttezza:
- `APP_TIMEZONE = 'Europe/Rome'` esportato da `@/lib/date` `[^src5: code/app/lib/date/index.ts:34]`;
- `@date-fns/tz@1.5.0` presente → `TZDate.tz(tz, y, m, d, h, mi, s, ms)` interpreta il wall-clock nel
  fuso e `.getTime()` restituisce l'istante UTC corretto (gestisce il salto DST, RB-12/T-DOM-08);
- `month` correttamente 0-indexed (`parseInt(monthStr) - 1`, l.263);
- turno notturno gestito con rollover `day + 1` `[^src5: code/app/lib/jobs/generateRecurringShifts.ts:271]`.
Un turno «08:00 Europe/Rome» ora è salvato all'istante UTC corretto anche a cavallo del cambio ora.
`[^rule: domain.tz.explicit-timezone §Rationale]` (candidate)

### TSK-010 · F-010-01 T-DOM-02 `test.fixme` — **RISOLTO ✅** (era HIGH blocking)
`shifts.spec.ts` T-DOM-02 apre con `test.fixme(true, 'ShiftGrid non riceve ancora existingShifts —
wiring in TSK-005/B6…')` `[^src5: code/app/tests/e2e/domain/shifts.spec.ts:37]`. Il test che falliva
by-design è ora marcato correttamente → non contribuisce più a «playwright test: 0 failed».
`[^rule: emergent/qa.testing.hollow-acceptance.md §Rationale]` (candidate)

### TSK-010 · F-010-02 `webServer` — **RISOLTO ✅** (era HIGH blocking)
`playwright.config.ts` ha ora `webServer: { command: 'npm run dev', url: 'http://localhost:3000',
reuseExistingServer: !process.env.CI, timeout: 120_000 }` `[^src5: code/app/playwright.config.ts:21]`.
Lo script `dev` esiste (`"dev": "next dev --turbopack"`) → la suite si auto-avvia il server out-of-the-box.
`[^rule: emergent/qa.e2e.self-hosted-webserver.md §Rationale]` (candidate)
> Nota (LOW, invariata): resta il progetto `setup` con `testMatch: /.*\.setup\.ts/` + `dependencies:
> ['setup']` su a11y/visual, ma **nessun file `*.setup.ts` esiste** (0 match). Il bootstrap sessione
> passa da `globalSetup: ./tests/e2e/global-setup` (presente) → il progetto `setup` è config morta
> (F-010-05, low). Non blocking.

---

## Finding aperti / nuovi (iter-3)

### F3-007-01 · HIGH (blocking) · robustezza+design — **REGRESSIONE** — `ApprovalPanel` non compila
`components/requests/ApprovalPanel.tsx` è **live** (montato in
`app/admin/requests/_components/ApprovalQueueClient.tsx:91`) ma non compila più:

- `Record<RequestRow['status'], string>` con chiave `pending` → `error TS2353`
  `[^src5: code/app/components/requests/ApprovalPanel.tsx:48]`;
- `request.status === 'pending'` (×2) → `error TS2367` (nessun overlap con `RequestStatus`)
  `[^src5: code/app/components/requests/ApprovalPanel.tsx:87]` `[^src5: code/app/components/requests/ApprovalPanel.tsx:127]`;
- `request.createdAt` → `error TS2339` (`RequestRow` non ha `createdAt`)
  `[^src5: code/app/components/requests/ApprovalPanel.tsx:144]`;
- inoltre `no-misused-promises` (lint error) `[^src5: code/app/components/requests/ApprovalPanel.tsx:228]`.

**Causa radice — deriva del modello di dominio «stato richiesta» su TRE sorgenti divergenti:**
1. DB `requestStatusEnum` = `['draft','sent','awaiting_colleague','approved','rejected','cancelled','applied']`
   `[^src5: code/app/db/schema.ts:56]`;
2. `hooks/useRequests.ts` `RequestStatus` locale = stessa macchina a stati (NO `pending`) + `RequestRow`
   con `submittedAt` (NO `createdAt`) `[^src5: code/app/hooks/useRequests.ts:25]`;
3. `types/index.ts` `RequestStatus` = **stale** `'pending' | 'approved' | 'rejected' | 'cancelled'`
   `[^src5: code/app/types/index.ts:30]`.

`ApprovalPanel` (deliverable TSK-007, certificato RISOLTO in iter-2) è rimasto ancorato al modello
vecchio (`pending`, `createdAt`) mentre lo schema e `useRequests` sono migrati alla macchina a stati
RB-16. **Regressione introdotta tra iter-2 e iter-3** (fuori dal fix-set TSK-006..010, imputabile a una
migrazione del workflow richieste in altro batch).
`[^rule: emergent/general.dead-broken-code.md §Detection]` · `[^rule: emergent/general.doc-code-mismatch.md]`
· `[^rule: fe.domain.shared-rule-duplication §Rationale]` (candidate) **(→ proposto candidate:
`domain.status.single-source-enum` — bozza da seminare in emergent/, gate umano)**

> **Remediation (gate umano, R.Q3):** (a) allineare `ApprovalPanel` alla macchina a stati corrente
> (`draft/sent/awaiting_colleague/approved/rejected/cancelled/applied`; usare `submittedAt`/`resolvedAt`
> al posto di `createdAt`) e correggere l'`onSubmit`/handler async del reject-form (no-misused-promises);
> (b) **eliminare la terza dichiarazione stale** `types/index.ts:30` e derivare `RequestStatus` da una
> sorgente unica (enum Drizzle o schema Zod). Decisione umana: è iter-3, loop esaurito.

### F3-008-01 · LOW · robustezza — reconnect backoff senza short-circuit 401
Il reconnect è a intervallo fisso 5s senza distinzione del 401. Su **sessione scaduta** (token invalido
ma `useSession` ancora cache-valida lato client) ogni reconnect riceve 401 → chiude → ripianifica: si crea
una **tempesta di reconnect ogni 5s** finché `useSession` non aggiorna la sessione a `null` (allora il
guard `if (!session?.user?.id) return` e il cleanup fermano il loop). Migliorabile con backoff esponenziale
+ un contatore/short-circuit sul `readyState`/status 401. Netto miglioramento rispetto a iter-2 (nessun
recovery) → **non-blocking**. `[^rule: sse.reconnect.preserve-recovery §Rationale]` (candidate)

### F3-008-02 · LOW · idiomaticità — docstring header stale
Il commento di testata (l.11-15) afferma ancora «In caso di errore (EventSource gestisce il reconnect
automaticamente; qui si chiude…)». Il codice ora riconnette **esplicitamente** via `setTimeout`, non fa
affidamento sull'auto-reconnect del browser → docstring contraddittoria con l'implementazione. Il commento
inline (l.117-119) è invece corretto. `[^src5: code/app/hooks/useNotifications.ts:11]`
`[^rule: emergent/general.doc-code-mismatch.md §Rationale]` (candidate)

### F3-009-02 · MEDIUM (gate) · idiomaticità — fix-set non prettier-clean
`lib/jobs/generateRecurringShifts.ts` fallisce `prettier --check` (righe `TZDate.tz(...)` oltre il
`printWidth`, non wrappate). Introdotto **da questo round**. Concorre al CQ-000 rosso.
**Auto-fixable**: `prettier --write` sul file. **Pre-merge obbligatorio.**
`[^src5: code/app/lib/jobs/generateRecurringShifts.ts:266]`
`[^rule: code_quality/rules/emergent/... deps/format-gate]` (candidate)

### F3-010-02 · MEDIUM (gate) · idiomaticità — spec non prettier-clean
`tests/e2e/domain/shifts.spec.ts` fallisce `prettier --check` (la stringa lunga del `test.fixme(...)`
non wrappata, l.37). Introdotto **da questo round**. Concorre al CQ-000 rosso. **Auto-fixable**:
`prettier --write`. **Pre-merge obbligatorio.** `[^src5: code/app/tests/e2e/domain/shifts.spec.ts:37]`

### F3-010-03 · MEDIUM (qa.*) · robustezza — T-DOM-04 ancora soft-skip (invariato)
`shifts.spec.ts` T-DOM-04 crea l'assenza con `absenceTypeId: '00000000-0000-0000-0000-000000000000'`
(sentinella) e, su `!ok`, esegue `test.fixme(...)` + `return` `[^src5: code/app/tests/e2e/domain/shifts.spec.ts:110]`
→ il test si **auto-salta** a runtime (l'assenza non è creabile senza absenceTypes reali/endpoint
`GET /api/admin/absence-types`). L'AC è coperto in forma «hollow». **Dominio `qa-dev`**, non
code-reviewer (non implementare qui). `[^rule: emergent/qa.testing.hollow-acceptance.md §Rationale]`
(candidate, `severity: medium`)

---

## Residui minori (LOW — advisory, invariati)

- **TSK-006** — `differenceInHours` tronca (10h30m→«10h») in `validateMinRest`/`validateLeaveNotice`:
  usare `differenceInMinutes/60`. `[^rule: domain.time.precision]` (low, invariato).
- **TSK-009** — RB-11 festivi sempre `[]` (Q_001 aperta, documentato l.206-208); `cleanExpiredSessions.ts`
  esporta `cleanOldNotifications` (naming mismatch documentato). (low, invariati).
- **TSK-010** — F-010-05 progetto `setup` fantasma (0 file `*.setup.ts`) + `dependencies:['setup']`
  su a11y/visual. (low, invariato).
- **Cross-batch (fuori scope 006-010):** `tests/visual/sprint3/reports-overtime.spec.ts:40` — `error
  TS2345` su callback `requestAnimationFrame` (Promise vs `FrameRequestCallback`). Contribuisce al tsc
  rosso; appartiene alla review del batch visual/TSK-030 → **non attribuito a questo batch**, segnalato
  per completezza CQ-000.

---

## Regression detection (R.Q4-ter) — **ATTIVATA**

| # | File | Assi | Fix-set di questo round? | Attribuzione |
|---|---|---|---|---|
| 1 | `components/requests/ApprovalPanel.tsx` | tsc ×4 + lint ×1 | **NO** | TSK-007 — deriva modello RequestStatus/RequestRow (cross-batch) |
| 2 | `lib/jobs/generateRecurringShifts.ts` | prettier ×1 | **SÌ** | TSK-009 — formato del fix iter-3 |
| 3 | `tests/e2e/domain/shifts.spec.ts` | prettier ×1 | **SÌ** | TSK-010 — formato del fix iter-3 |
| 4 | `tests/visual/sprint3/reports-overtime.spec.ts` | tsc ×1 | NO | fuori batch (TSK-030) |

Nessuna regressione **funzionale** introdotta dal fix-set nei file toccati (SSE/route/job/config/spec
compilano e sono corretti); le uniche regressioni imputabili a questo round sono di **formato**
(prettier, triviali). La regressione **bloccante** (ApprovalPanel) è **esterna** al fix-set ma cade nel
perimetro TSK-007 di questo batch.

---

## Loop status (iter 3 / 3) — **TERMINALE · `loop-exhausted`**

- **max_iterations 3 raggiunto:** nessuna ulteriore iterazione automatica consentita (R.Q4, non bypassabile).
- **No-progress detection:** **NON attivata** su TSK-008/009/010 — i finding di iter-2 sono cambiati e
  chiusi (progresso reale, verificato). Nessun set di `rule_id` identico ripresentato.
- **Forced reject per finding identici a iter-2:** **NON applicabile** — nessun TSK ripresenta il
  medesimo `rule_id` di iter-2.
- **TSK-007 → `reject`:** *non* per no-progress, ma per **regressione bloccante aperta all'iterazione
  terminale** (compile+lint rossi su un deliverable live). Marker: `regression` + `loop-exhausted`.
  Verdict `reject` = **gate umano** (R.Q3): nessun auto-revert, nessun auto-close/merge, nessuna
  riapertura del Develop. Decide l'umano.
- **Batch NON mergeable finché CQ-000 non torna verde.** Pre-merge minimi:
  1. `prettier --write` su `lib/jobs/generateRecurringShifts.ts` e `tests/e2e/domain/shifts.spec.ts`
     (F3-009-02, F3-010-02) — triviale, deterministico.
  2. Ripristino `ApprovalPanel.tsx` sulla macchina a stati corrente + rimozione della terza
     dichiarazione `RequestStatus` stale (F3-007-01) — **decisione umana** (fuori dal budget diff
     automatico, iter esaurito).
- **Sicurezza:** nessun secret di produzione né CVE emersi (fuori scope CQRL). Nessun `wiki/incidents/*`
  aperto. Le credenziali fixture restano allineate al seed.

## Escalation umana (§7 r.16 + R.Q3)

1. **TSK-007 (reject, blocking):** deriva del modello «stato richiesta» su 3 sorgenti. Azione: unificare
   la sorgente dell'enum (schema Drizzle o Zod) ed eliminare `types/index.ts:30`; migrare `ApprovalPanel`
   a `submittedAt`/macchina a stati; risolvere `no-misused-promises`. Tracciare come
   `GAP-REQUEST-STATUS-MODEL` in `wiki/gaps.md`.
2. **CQ-000 (batch-blocking):** eseguire `prettier --write` sui 2 file del fix-set prima del merge.
3. **Fuori batch:** il tsc error in `tests/visual/sprint3/reports-overtime.spec.ts` va instradato alla
   review del batch visual/TSK-030.
4. **Seminare canonical/** con le regole `candidate` citate (gate umano, §19.5) per uscire dalla
   modalità degradata su questi pattern ricorrenti (`domain.tz.explicit-timezone`,
   `domain.status.single-source-enum`, `sse.reconnect.preserve-recovery`).
