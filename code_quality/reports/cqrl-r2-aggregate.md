# CQRL — Aggregate Verdict Round 2 (iter 2/3)

- **Generated at**: 2026-07-14
- **Scope**: TSK-001 → TSK-031 (31 task, 7 batch)
- **Iter**: 2 / max_iterations 3
- **Reviewer version**: cqrl-v2.12

---

## Verdetti aggregati

| TSK | Layer | iter-1 | iter-2 | Δ | Blocking aperti |
|---|---|---|---|---|---|
| TSK-001 | be | conditional | **pass** | ↑ | 0 |
| TSK-002 | fe | conditional | **pass** | ↑ | 0 |
| TSK-003 | db | conditional | **pass** | ↑ | 0 |
| TSK-004 | be | conditional | **conditional** | = | 1 (T-SEC-05) |
| TSK-005 | fe | conditional | **pass** | ↑ | 0 |
| TSK-006 | be | conditional | **pass** | ↑ | 0 |
| TSK-007 | fe | conditional | **pass** | ↑ | 0 |
| TSK-008 | fe | conditional | **conditional** | = | SSE reconnect, ORDER BY |
| TSK-009 | be | conditional | **conditional** | = | DST-unsafe recurring shifts |
| TSK-010 | qa | conditional | **conditional** | = | F-010-01, F-010-02 |
| TSK-011 | qa | conditional | **conditional** | = | 0 (M non-blocking) |
| TSK-012 | qa | **reject** | **pass** | ↑↑ | 0 |
| TSK-013 | db | conditional | **conditional** | ↑ | F-013-02 (journal) |
| TSK-014 | fe | conditional | **conditional** | = | 0 (M non-blocking) |
| TSK-015 | fe | conditional | **conditional** | = | F-015-01 (inUseMap) |
| TSK-016 | fe | conditional | **conditional** | = | 0 (M non-blocking) |
| TSK-017 | be | conditional | **conditional** | ↑ | M3 absenceTypeId label→uuid |
| TSK-018 | be | conditional | **pass** | ↑ | 0 |
| TSK-019 | fe | conditional | **conditional** | ↑ | edit route 404 |
| TSK-020 | fe | conditional | **conditional** | ↑ | dead code ~1487 LOC |
| TSK-021 | fe | conditional | **conditional** | = | overtime computeHours bug |
| TSK-022 | fe | conditional | **conditional** | = | orphan + typo |
| TSK-023 | fe | conditional | **conditional** | ↑ | (high F-023-1 risolto) |
| TSK-024 | qa | conditional | **conditional** | ↑ | F-024-3 seed mismatch |
| TSK-025 | fe | conditional | **conditional** | = | dual schema, window.confirm |
| TSK-026 | be | conditional | **pass** | ↑ | 0 |
| TSK-027 | be | conditional | **conditional** | = | overtime calc duplicata |
| TSK-028 | fe | conditional | **conditional** | = | notification key-factory |
| TSK-029 | be | conditional | **conditional** | ↑ | H2 timezone email unsafe |
| TSK-030 | qa | conditional | **conditional** | = | no_progress (baselines) |
| TSK-031 | be/qa | conditional | **conditional** | ↑ | M1(AC2) + M2 date anchor |

---

## Riepilogo numerico

| Verdict | iter-1 | iter-2 | Δ |
|---|---|---|---|
| **pass** | 0 | **9** | +9 |
| **conditional** | 30 | **22** | −8 |
| **reject** | 1 | 0 | −1 |

> **Pass rate: 9/31 = 29%** (obiettivo post-iter-2: verificare e risolvere blocking prima di iter-3)

---

## Fix verificati nel round 1→2

| Fix ID | Scope | Stato |
|---|---|---|
| B1 — pinning zod ^3 + inngest ^3 | package.json | ✅ VERIFICATO |
| B2 — route collision admin-requests | app/(admin)/admin-requests/ | ✅ VERIFICATO |
| B3 — auth edge split | auth.config.ts + middleware.ts | ✅ VERIFICATO |
| B4 — ESLint parserOptions + vitest config | eslint.config.mjs + vitest.config.ts | ✅ VERIFICATO (tsc 0, lint 0, prettier 0) |
| B5 — db.transaction swap + absences | admin/swap + admin/absences | ✅ VERIFICATO |
| B6 — SelectItem value="__none__" | 9 componenti | ✅ VERIFICATO |
| B6 — ShiftGrid existingShifts wiring | ShiftGrid.tsx | ✅ VERIFICATO |
| B7 — validateMinRest/PastShift config injection | lib/rules/*.ts | ✅ VERIFICATO |
| B7 — Inngest createFunction name field | lib/jobs/*.ts | ✅ VERIFICATO |
| B8 — @date-fns/tz TZDate in seed | db/seed.ts | ✅ VERIFICATO |
| B8 — after() serverless dispatch | 4 route handlers | ✅ VERIFICATO |
| B8 — testid wizard correction | employee-requests.spec.ts | ✅ VERIFICATO |
| B8 — IDOR fixture deterministica | fixtures/sprint3-db.ts | ✅ VERIFICATO |

---

## Blocking aperti per iter-3 (priorità)

### MUST-FIX (rischiano reject se invariati)

| # | TSK | Finding | Severity | Agente |
|---|---|---|---|---|
| 1 | TSK-010 | F-010-01: T-DOM-02 non marcato fixme | HIGH | qa-dev |
| 2 | TSK-010 | F-010-02: no webServer in playwright.config | HIGH | qa-dev |
| 3 | TSK-013 | F-013-02: journal drizzle-kit mancante | MEDIUM (blocking) | db-dev |
| 4 | TSK-015 | F-015-01: inUseMap mai popolato | HIGH | fe-dev |
| 5 | TSK-017 | M3: absenceTypeId label → uuid lookup | HIGH (500 garantito) | be-dev |
| 6 | TSK-021 | overtime computeHours non usa calculateOvertime | HIGH | fe-dev |
| 7 | TSK-029 | H2: email date/time timezone-unsafe | HIGH | be-dev |

### SHOULD-FIX (no_progress → reject forzato iter-3)

| # | TSK | Finding | Severity | Note |
|---|---|---|---|---|
| 8 | TSK-030 | baseline screenshot assenti | HIGH | decisione umana: genera o declassa |
| 9 | TSK-004 | T-SEC-05 accept-swap auth | HIGH | portato da iter-1, ora iter-3 = last |
| 10 | TSK-008 | SSE reconnect + ORDER BY | HIGH | stessa situazione |
| 11 | TSK-009 | DST-unsafe recurring shifts | HIGH | stessa situazione |
| 12 | TSK-019 | edit route /recurrence/:id/edit 404 | HIGH | route file mancante |
| 13 | TSK-031 | AC2 self-skip + date anchor | MEDIUM | vicino al pass |
| 14 | TSK-024 | seed luca/lucia mismatch + test.skip | MEDIUM | qa-dev |

### ACCEPT-AS-DEBT (decision umana, non bloccanti)

- TSK-011: F-011-* (a11y gate severità, tastiera — qa/a11y-specialist)
- TSK-014: F-014-01 staleTime vs AbortController (M)
- TSK-016: F-016-01 `any` pervasivo in StaffModal (M)
- TSK-019: GAP-RECURRENCE-API-001 — endpoint BE preview/generate assenti (gap funzionale)
- TSK-020: dead code ~1487 LOC (refactor, no bug)
- TSK-022: F-022-3 typo "richiestae" + orphan RequestsListClient
- TSK-025: M-1 dual schema, M-2 window.confirm
- TSK-027: M-1 overtime calc duplicata (±1 min, DRY)
- TSK-028: M-1 notification key-factory (fragilità, non bug)

---

## Escalation cross-cutting

**Route prefix `/admin/*` vs route group `(admin)`** (segnalato da Batch 4):
La fix B2 ha risolto la collision `/requests` ma ha scelto la direzione URL-bare (`/admin-requests`)
applicata solo a quel percorso. Il resto dell'app (`middleware.ts:39`, `page.tsx:25 redirect post-login`,
dashboard quick-actions TSK-014, `global-setup.ts:36`) usa ancora `/admin/dashboard` → **404 all'atterraggio admin**.
Non è una regressione introdotta dai fix (pre-esisteva), ma è un critical path da decidere:
- **Direzione A** (raccomandata): rinominare `app/(admin)` → `app/admin` → tutti i path tornano `/admin/*`.
- **Direzione B** (corrente): correggere tutti i link + redirect + test a path bare → scatter elevato.

Tracciare in `wiki/gaps.md` come GAP-ADMIN-ROUTE-STRATEGY prima di iter-3.

---

## Loop status

- iter-3 è l'**ultima iterazione consentita** (`max_iterations: 3`)
- Trovings con `rule_id` identico a iter-2 in iter-3 → **forced reject + escalation umana** (§19.4)
- TSK-030 ha già il marker `no_progress`: iter-3 senza fix = reject automatico
- 7 TSK hanno finding portati invariati da iter-1 → iter-2 (TSK-004/008/009/011/014/016/025): se iter-3 li riporta identici = reject; **decide umano se fixare o accettare a debito**
