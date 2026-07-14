# CQRL Code Review — Batch 2, Iterazione 2 (TSK-005 … TSK-009)

- **Reviewer**: code-reviewer (CQRL v2.12) — passate: idiomaticità → design → robustezza
- **Repo**: soli-turnly · `code/app`
- **Generato**: 2026-07-14T15:27+0200
- **Iterazione**: 2 di `max_iterations: 3` (loop non esaurito)
- **Report round 1**: `code_quality/reports/cqrl-batch-2-TSK005-009.md`
- **Stack rilevato**: Next.js 15 App Router · TypeScript 5 (`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`) · Drizzle · Zod v3 · TanStack Table/Query/Virtual · date-fns v3 · Inngest v3 · SSE nativo
- **Modalità**: stack-aware (sopra `confidence_min`).
- **Nota di processo**: `rules/canonical` e `rules/team-specific` restano vuote; alcuni `rule_id` citati sono identificatori canonici *convenzionali proposti* (gate umano per seminarli). Le regole in `rules/emergent/` esistono e sono citate come tali.

---

## Verdict sintetico (round 2)

| TSK | Titolo | Round 1 | **Round 2** | Delta |
|---|---|---|---|---|
| TSK-005 | Matrice Admin TanStack Table | conditional | **pass** | Blocker inline-validation + `cellViolations` + type errors RISOLTI. 1 nuovo finding medium (rumore RB-09 in griglia). |
| TSK-006 | Business Rules Engine RB-01..17 | conditional | **pass** | Test RB-09 + `process.env` + type error `validateNoOverlap` RISOLTI. Solo residui low. |
| TSK-007 | Frontend Forms + Zod | conditional | **pass (advisory)** | Zod compile + `ApprovalPanel` + `SelectItem value=""` RISOLTI. Residuo medium: T-INT-01 schema-duplication su `ShiftEditor`. |
| TSK-008 | Notifications SSE | conditional | **conditional** | Reconnection SSE **ancora disabilitata** (high) + `ORDER BY` **ancora assente** (medium) — fuori dallo scope del fix set applicato. |
| TSK-009 | Audit + Inngest jobs | conditional | **conditional** | Inngest compile RISOLTO. Generazione ricorrenze **ancora DST-naive** (high) — fuori scope del fix set. |

> **Verdict di batch: `conditional`.** Progresso sostanziale e verificato (typecheck e test ora verdi), ma TSK-008 e TSK-009 conservano finding `high` di round 1 che **questa iterazione non ha toccato**. Nessun `reject`: nessun problema di sicurezza, loop non esaurito.

---

## CQ-000 (trasversale) — RISOLTO ✅

Precondizione minima ora soddisfatta:

- `npx tsc --noEmit` → **0 errori** (era **126**). Verificato in questa iterazione.
- `npx vitest run` → **36/36 test pass, 6 file** (erano 34 file falliti + 1 unit fail). Verificato.
- `vitest.config.ts` ora restringe la raccolta: `include: ['src/**/*.{test,spec}.ts','lib/**/*.{test,spec}.ts']`, `exclude: ['tests/e2e/**','tests/a11y/**','tests/visual/**','node_modules/**']` → gli spec Playwright non vengono più raccolti da Vitest. `[^rule: qa.testing.suite-must-pass]`
- Dipendenze pinnate (B1): `zod@^3.25.76` (installato `3.25.76`), `inngest@^3.54.2` (`3.54.2`), `date-fns@^3` (`3.6.0`). Nessuna dep critica su `"latest"` per il code path in review. `[^rule: deps.stability.no-latest-pinning §Rationale]`

---

## Verifica puntuale dei fix richiesti

### B6 — ShiftGrid cablato (RB-01/08 ora scattano) ✅
- `existingShifts`/`absences` ora passati a `ShiftEditor` tramite due memo dedicate `editorExistingShifts`/`editorAbsences`, filtrate per `editorState.userId` e mappate a `ExistingShift`/`Absence` `[^src5: code/app/components/matrix/ShiftGrid.tsx:458]` `[^src5: code/app/components/matrix/ShiftGrid.tsx:655]`. Default `[]` eliminato.
- `ShiftEditor.runLocalValidation` ora riceve i dati e invoca `validateShift({ userId, startDt, endDt, id: editingId }, { existingShifts, absences })` `[^src5: code/app/components/matrix/ShiftEditor.tsx:116]`. RB-01 (overlap) e RB-08 (assenza) hanno finalmente contesto → scattano a runtime. AC T-DOM-02/03 sbloccati.

### B6 — `cellViolations` non più `[]` hardcoded ✅
- Nuova memo `violationMap` (`Map<"userId:date", RuleViolation[]>`) pre-calcola RB-01..09 per ogni turno raggruppando per utente `[^src5: code/app/components/matrix/ShiftGrid.tsx:234]`. La cella legge `violationMap.get(...) ?? []` `[^src5: code/app/components/matrix/ShiftGrid.tsx:369]`.
- Il `TODO TSK-006` e il letterale `const cellViolations: RuleViolation[] = []` sono spariti (grep: nessun match). `[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Detection]`
- **Correttezza self-overlap verificata**: `validateNoOverlap` filtra `s.id !== input.id` `[^src5: code/app/lib/rules/validateNoOverlap.ts:22]`; nella `violationMap` viene passato `shiftEx` (con `id`), quindi un turno non si sovrappone a se stesso. Anche `ShiftEditor` passa `shift?.id` come `editingId`. ✅

### B6 — 9× `SelectItem value=""` → `__none__` ✅
- Grep `SelectItem value=""` su `components/` → **nessun match**. Tutte le occorrenze usano il sentinella `__none__` con normalizzazione in `onValueChange`/`value` (es. `ShiftEditor.tsx:293`, `RequestForm.tsx:287`, `UserForm.tsx:297`, `StaffModal.tsx:406`, `CoverageRuleModal.tsx`, `RequestFormModifyShift.tsx`, ecc.). `[^rule: code_quality/rules/emergent/fe.react.radix-select-empty-value.md §Remediation]`

### B7 — `process.env` rimosso dalle pure function ✅
- `validateMinRest`, `validatePastShift`, `validateLeaveNotice` non leggono più `process.env` a runtime: config iniettata via parametro `options` `[^src5: code/app/lib/rules/validateMinRest.ts:23]` `[^src5: code/app/lib/rules/validatePastShift.ts:22]` `[^src5: code/app/lib/rules/validateLeaveNotice.ts:26]`. Le uniche occorrenze di `process.env` restanti in `lib/rules/` sono **esempi nei docstring** per il chiamante BE. `[^rule: ts.purity.no-env-read-in-pure-fn §Rationale]`
- **RB-09 `strict=true` di default** confermato: `validatePastShift` usa `options?.strict ?? true` → severity `blocking` `[^src5: code/app/lib/rules/validatePastShift.ts:31]`. Il test unitario "RB-09 → blocking" ora passa (36/36).
- Type error round 1 su `validateNoOverlap` risolto: `overlapping[0]!` con guard esplicita e commento `[^src5: code/app/lib/rules/validateNoOverlap.ts:34]`.
- Import morto `validateCoverage` in `validateSwap` rimosso (commentato). ✅

### B7 — Inngest jobs compilano con Zod v3 ✅
- Tutti e 3 i job usano la firma corretta v3 `inngest.createFunction({ id, name, retries }, { event }, handler)` con campo `name`:
  - `generateRecurringShifts` — `name: 'Generate Recurring Shifts'` `[^src5: code/app/lib/jobs/generateRecurringShifts.ts:145]`
  - `sendNotificationEmail` — `name: 'Send Notification Email'` `[^src5: code/app/lib/jobs/sendNotificationEmail.ts:145]`
  - `cleanExpiredSessions` → esporta `cleanOldNotifications` — `name: 'Clean Old Notifications'` `[^src5: code/app/lib/jobs/cleanExpiredSessions.ts:25]`
- `event`/`step` non più `implicit any`; typecheck globale 0 errori → i job compilano. Il pinning di Zod/Inngest a v3 ha ricomposto anche `lib/zod/index.ts` (`z.record(z.unknown())` e `errorMap` sono validi in Zod v3). ✅

### B1 — Zod ^3 / Inngest ^3 pinnati ✅
- Verificato in `package.json` + `node_modules` (vedi CQ-000).

---

## Finding aperti (portati da round 1, NON toccati dal fix set)

### TSK-008 · SSE reconnection ANCORA disabilitata — high
- `useNotifications.es.onerror` chiama incondizionatamente `es.close()` `[^src5: code/app/hooks/useNotifications.ts:114]`. Identico a round 1: nessuna distinzione tra 401 (chiudi) e blip transitorio (lascia riconnettere). `close()` porta a `CLOSED` e impedisce il recovery automatico → contraddice l'obiettivo TSK "recovery su disconnessione". Il commento (righe 111-113) continua ad affermare, erroneamente, che "il browser riapre automaticamente". `[^rule: sse.reconnect.preserve-recovery §Rationale]` **(proposto canonical)**
- **Remediation**: nel gestore `onerror`, non chiudere sui transitori; distinguere il caso sessione-scaduta (es. via `es.readyState === EventSource.CLOSED` o un contatore di retry con backoff) dal blip transitorio in cui l'`EventSource` deve poter riconnettere.

### TSK-008 · `GET /api/notifications` senza `ORDER BY` — medium
- Il docstring promette "ORDER BY readAt NULLS FIRST, createdAt DESC" ma la query non ha `.orderBy()` `[^src5: code/app/app/api/notifications/route.ts:32]` → paginazione non deterministica e "non lette per prime" non implementato. `[^rule: api.pagination.deterministic-order-by]` **(proposto canonical)** · anche `[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md]`

### TSK-009 · Generazione ricorrenze ANCORA DST-naive — high
- `generateRecurringShifts` costruisce `new Date("${dateStr}T${HH}:${mm}:00Z")` (UTC naive) mantenendo la nota "in produzione usare fromZoned" `[^src5: code/app/lib/jobs/generateRecurringShifts.ts:261]`. Un turno "08:00 Europe/Rome" viene salvato come 08:00Z → offset 1-2h sui turni generati, in contrasto con RB-12/T-DOM-08 (AC T-REC-01). Il fix di round 2 ha risolto solo la *compilazione* del job, non la correttezza timezone. `[^rule: domain.tz.explicit-timezone §Rationale]` **(proposto canonical)**

### TSK-007 · Parità T-INT-01 sul form turno principale — medium (era high; mitigato)
- `ShiftEditor` continua a definire uno `shiftFormSchema` locale (`startTime`/`endTime` HH:MM) invece di importare `shiftCreateSchema` da `@/lib/zod` `[^src5: code/app/components/matrix/ShiftEditor.tsx:77]`. L'AC #1 "stesso file Zod importato da FE e BE" resta formalmente non soddisfatto per il form più critico.
- **Downgrade a medium**: la parità delle *regole di business* RB-01..09 è ora garantita (il form invoca la pure function condivisa `validateShift` da `@/lib/rules`), quindi il rischio di divergenza sostanziale FE↔BE è mitigato; resta la duplicazione del solo schema di input UI. `[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale]`

---

## Finding NUOVO (regression review — introdotto dal fix B6)

### TSK-005 · La `violationMap` marca tutti i turni passati come blocking RB-09 — medium
- La `violationMap` valida ogni turno con `validateShift(...)` senza iniettare `now` e senza escludere RB-09 dal pre-calcolo di griglia `[^src5: code/app/components/matrix/ShiftGrid.tsx:271]`. Poiché `validatePastShift` è `blocking` di default, **ogni cella con turno nel passato viene renderizzata come violazione bloccante (bordo rosso)** — non è una violazione reale, solo un turno storico. Navigando settimane passate l'intera griglia appare "rossa".
- Impatto: rumore visivo/UX e possibile confusione sullo stato reale. Non blocca il salvataggio (la griglia è read-through), ma inquina la semantica dei badge.
- **Remediation** (scope-limited): nel pre-calcolo della griglia escludere RB-09 (rilevante solo in editing) — es. costruire un set di regole per il display che non includa `validatePastShift` — oppure iniettare una policy che tratti i turni passati come informativi in vista matrice. `[^rule: ux.grid.violation-display-scope]` **(proposto candidate — bozza da seminare in emergent/, gate umano)**

---

## Residui minori (low — advisory, non bloccanti)

- **TSK-006** — `differenceInHours` tronca (es. "10h" per 10h30m) in `validateMinRest`/`validateLeaveNotice`: usare `differenceInMinutes/60`. `[^rule: domain.time.precision]` (low)
- **TSK-005/006** — confini giorno/settimana e `buildISODatetime` in fuso di sistema (non `@date-fns/tz`): fragile su runtime non-UTC. `[^rule: domain.tz.explicit-timezone]` (medium latente, coerente col deploy UTC)
- **TSK-007** — `requestCreateSchema.payload = z.record(z.unknown())`: i campi dinamici non hanno validazione Zod per-tipo (serve discriminated union su `type`). `[^rule: validation.request-payload-typed]` (medium, pre-esistente, fuori scope fix)
- **TSK-009** — RB-11 festivi sempre `[]` (Q_001 aperta) e file `cleanExpiredSessions.ts` esporta `cleanOldNotifications` (naming mismatch documentato). (low)
- **TSK-005** — commento stale in `ShiftEditor` header ("validateShiftLocal() — stub TSK-005, sostituito in TSK-006"): allineare al codice attuale. `[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md]` (low)

---

## Loop status

- **Iterazione**: 2 / 3. Loop **non esaurito**.
- **Progresso**: netto e verificato. Set di finding di round 1 largamente chiuso (typecheck 126→0, test 1 fail→0 fail, tutti i blocker critical/high di TSK-005/006/007 risolti). **No-progress detection: NON attivata** (finding set cambiato e ridotto).
- **Regression detection**: 1 nuovo finding medium introdotto dal fix B6 (RB-09 in griglia). Nessuna regressione in file non dichiarati dal fix set.
- **Sicurezza**: nessun finding (fuori scope CQRL, nessun secret/CVE emerso).

## Prossimo step consigliato (per il dev-agent, scope-limited, `max_diff_lines: 80`)

Per portare il batch a `pass` completo servirebbe una iterazione 3 mirata:
1. **TSK-008 (high)**: `useNotifications.onerror` — non chiudere l'`EventSource` sui transitori; distinguere il 401. + aggiungere `.orderBy(NULLS FIRST readAt, createdAt DESC)` a `GET /api/notifications`.
2. **TSK-009 (high)**: introdurre `fromZoned`/`@date-fns/tz` nella costruzione `startDt/endDt` di `generateRecurringShifts` (RB-12/T-REC-01).
3. **TSK-005 (medium, regressione)**: escludere RB-09 dal pre-calcolo `violationMap` di griglia (o iniettare policy display).
4. **TSK-007 (medium)**: derivare lo schema di input di `ShiftEditor` dal contratto condiviso `@/lib/zod` (o documentare esplicitamente lo scarto UI↔wire come scelta di design accettata).

> I gap di test (payload richieste, ecc.) restano `severity: medium` con `rule_id: qa.*` e vanno completati da **qa-dev**, non dal code-reviewer.
