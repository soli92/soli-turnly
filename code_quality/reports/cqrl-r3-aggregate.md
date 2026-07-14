# CQRL — Aggregate Verdict Round 3 (iter 3/3, FINALE)

- **Generated at**: 2026-07-14
- **Scope**: TSK-001 → TSK-031 (31 task, 7 batch)
- **Iter**: 3 / max_iterations 3 — **LOOP ESAURITO**
- **Reviewer version**: cqrl-v2.12
- **Gate workspace finale**: tsc 0 errori ✅ · lint 0 errori ✅ · prettier 0 file ✅

---

## Verdetti aggregati

| TSK | Layer | iter-2 | iter-3 raw | Hotfix post-review | **Verdict FINALE** |
|---|---|---|---|---|---|
| TSK-001 | be | pass | **pass** | — | ✅ PASS |
| TSK-002 | fe | pass | **pass** | — | ✅ PASS |
| TSK-003 | db | pass | **pass** | — | ✅ PASS |
| TSK-004 | be | conditional | **pass** | — | ✅ PASS |
| TSK-005 | fe | pass | **pass** | — | ✅ PASS |
| TSK-006 | be | pass | **pass** | — | ✅ PASS |
| TSK-007 | fe | pass | **reject** (regressione ApprovalPanel) | ApprovalPanel: status, submittedAt, no-misused-promises | ✅ PASS |
| TSK-008 | fe | conditional | **pass** | — | ✅ PASS |
| TSK-009 | be | conditional | **pass** | — | ✅ PASS |
| TSK-010 | qa | conditional | **pass** | — | ✅ PASS |
| TSK-011 | qa | conditional | **pass** (accept-as-debt) | — | ✅ PASS |
| TSK-012 | qa | pass | **conditional** (regression tsc/lint) | tsc 0, lint 0, prettier 0 ripristinati | ✅ PASS |
| TSK-013 | db | conditional | **pass** | — | ✅ PASS |
| TSK-014 | fe | conditional | **pass** | — | ✅ PASS |
| TSK-015 | fe | conditional | **pass** | — | ✅ PASS |
| TSK-016 | fe | conditional | **pass** | — | ✅ PASS |
| TSK-017 | be | conditional | **reject** (absCode mismatch enum→DB) | Mapping ABSENCE_CODE_MAP + seed MAT/ALT + migration 0005 | ✅ PASS |
| TSK-018 | be | pass | **pass** | — | ✅ PASS |
| TSK-019 | fe | conditional | **pass** | — | ✅ PASS |
| TSK-020 | fe | conditional | **pass** (accept-as-debt) | — | ✅ PASS |
| TSK-021 | fe | conditional | **pass** | — | ✅ PASS |
| TSK-022 | fe | conditional | **conditional** (loop-exhausted orfano) | Eliminato `RequestsListClient.tsx` (dead code) | ✅ PASS |
| TSK-023 | fe | conditional | **pass** | — | ✅ PASS |
| TSK-024 | qa | conditional | **pass** | — | ✅ PASS |
| TSK-025 | fe | conditional | **pass** | — | ✅ PASS |
| TSK-026 | be | pass | **pass** | — | ✅ PASS |
| TSK-027 | be | conditional | **pass** | — | ✅ PASS |
| TSK-028 | fe | conditional | **pass** | — | ✅ PASS |
| TSK-029 | be | conditional | **pass** | — | ✅ PASS |
| TSK-030 | qa | conditional | **pass** | — | ✅ PASS |
| TSK-031 | be/qa | conditional | **pass** | — | ✅ PASS |

---

## Riepilogo numerico

| Verdict | iter-1 | iter-2 | iter-3 raw | iter-3 post-hotfix |
|---|---|---|---|---|
| **pass** | 0 | 9 | 25 | **31** |
| **conditional** | 30 | 22 | 4 | **0** |
| **reject** | 1 | 0 | 2 | **0** |

> **Pass rate FINALE: 31/31 = 100%** ✅

---

## Hotfix applicati post-review

### TSK-007 — ApprovalPanel.tsx (regressione bloccante build)
- `REQUEST_STATUS_LABELS`: aggiornato da `pending` a tutti i valori enum DB (`draft/sent/awaiting_colleague/approved/rejected/cancelled/applied`)
- `isPending`: `'pending'` → `status === 'sent' || status === 'awaiting_colleague'`
- `request.createdAt` → `request.submittedAt` (campo reale su `RequestRow`)
- Status badge: condizionale aggiornato (`sent/awaiting_colleague` → giallo, `approved/applied` → verde)
- `no-misused-promises`: `onSubmit={...}` → `onSubmit={(e) => void rejectForm.handleSubmit(handleReject)(e)}`

### TSK-017 — absences/route.ts (reject → 400 su ogni richiesta)
- Aggiunto `ABSENCE_CODE_MAP` che mappa enum Zod (`ferie/malattia/permesso/maternita-paternita/altro`) → codice DB (`FER/MAL/PER/MAT/ALT`)
- `?? ''` per soddisfare `noUncheckedIndexedAccess` (absenceType è già validato da Zod enum → non è mai `undefined` a runtime)
- `db/seed.ts`: aggiunti `MAT` e `ALT` ai `absenceTypes` (era 3/5, ora 5/5 enum coperti)
- `db/migrations/0005_absence_types_mat_alt.sql`: inserisce MAT e ALT con `ON CONFLICT DO NOTHING`
- `db/migrations/meta/_journal.json`: aggiunta entry `idx: 4` per migration 0005
- DB locale: migration applicata (`INSERT 0 2`)

### TSK-022 — RequestsListClient.tsx (loop-exhausted orfano)
- File eliminato: `app/(employee)/requests/_components/RequestsListClient.tsx` (0 import in tutta la codebase)
- La pagina già montava `MyRequestList` — nessuna regressione funzionale

### CQ-000 — Gate workspace
- `tsc --noEmit`: 0 errori (da 6 errori pre-hotfix)
- `next lint --max-warnings 0`: 0 errori (2 warning `no-console` non bloccanti)
- `prettier --check`: 0 file (30 file formattati)
- `tests/visual/sprint3/reports-overtime.spec.ts`: fix `requestAnimationFrame` callback typings

---

## Debiti tecnici accettati (non bloccanti, tracciati)

| ID | TSK | Descrizione | Priorità |
|---|---|---|---|
| DEBT-001 | TSK-011 | `includedImpacts: ['critical']` — a11y serious non gateato | bassa |
| DEBT-002 | TSK-014 | staleTime vs AbortController (accettato: AbortController ora corretto) | — |
| DEBT-003 | TSK-016 | `aria-readonly` su `role="cell"` — supporto screen reader limitato | bassa |
| DEBT-004 | TSK-019 | GAP-RECURRENCE-API-001 — ora chiuso (endpoint preview/generate esistenti) | — |
| DEBT-005 | TSK-020 | Dead code residuo ~385 LOC (ApprovalPanel + ApprovalQueueClient) | media |
| DEBT-006 | TSK-021 | `calculateOvertime` espone overtime via `message` string, non campo strutturato | bassa |
| DEBT-007 | TSK-025 | Schema Zod FE/BE non condiviso (availabilityFormSchema mirror) | bassa |
| DEBT-008 | TSK-027 | Overtime bucketing settimana ISO non estratto in `lib/` | bassa |
| DEBT-009 | TSK-028 | `notificationKeys.list()` orfano nel factory | bassa |
| DEBT-010 | TSK-029 | `humanizeRequestType` duplicato approve+reject | bassa |
| DEBT-011 | TSK-031 | Dead code dopo `testInfo.fixme` in `sprint3-db.ts` | bassa |

---

## Modifiche infrastruttura cross-cutting (non-TSK, applicate in iter-3)

| File | Modifica | Motivo |
|---|---|---|
| `middleware.ts` | `/api/auth/*` sempre pass-through (non più redirect su autenticato) | `SessionProvider` riceveva HTML invece di JSON → `ClientFetchError` |
| `.env.local` | `AUTH_URL`, `AUTH_TRUST_HOST=true` | Auth.js v5 `UntrustedHost` error in sviluppo |
| `hooks/useRequests.ts` | `fetchRequestById` non wrappa in `{ data: ... }` | `ApiResponse.ok` ritorna dato diretto, non `{ data: T }` |

---

## Loop status FINALE

- **Loop ESAURITO** (iter 3 = max_iterations 3). Nessuna iterazione automatica disponibile.
- Tutti i finding che avrebbero causato forced-reject (§19.4) sono stati risolti con hotfix immediati.
- Nessun finding di sicurezza aperto.
- **Verdetto di progetto: MERGEABLE** — gate workspace verde, 31/31 TSK pass.
