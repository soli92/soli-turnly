# CQRL Code Review — Batch 3 · ITER 2 (TSK-010 → TSK-016)

- **reviewer_version:** cqrl-v2.12
- **generated_at:** 2026-07-14
- **iter:** 2 / max_iterations 3
- **prev_report:** `code_quality/reports/cqrl-batch-3-TSK010-016.md` (iter 1)
- **passes:** idiomaticity, design, robustness (+ accessibility, config-active)
- **stack_descriptor:** `typescript@5 / next@15 (app-router, rsc) / drizzle-orm+postgres@16 / tanstack-{query,table,virtual} / react-hook-form+zod@^3 / playwright + axe-core / vitest` — confidence **alta** (> `confidence_min` 0.6), review **stack-aware** completa.

## Metodo iter-2

I tre gate di TSK-012 sono stati **eseguiti realmente in review** (non solo concettualmente):
`tsc --noEmit`, `next lint`, `prettier --check .` nel workspace `code/app/`. Gli altri finding
sono stati riverificati leggendo il codice corrente e confrontandolo con il report iter-1.

## Nota di degradazione (ruleset)

`code_quality/rules/canonical` e `team-specific` restano **vuote**; `emergent/` contiene ora 10
bozze (`fe.*`, `qa.*`, `general.*`) ma nessuna citata qui è in `status: active`. La review gira in
**modalità degradata evolutiva**: i `rule_id` sono citati come convenzione **candidate** (promozione =
gate umano, §19.5). Nessuna regola è stata inventata come attiva.

---

## Esito verifica fix applicati (B1 / B4 / B6 / B8)

| Fix | Target | Esito iter-2 | Evidenza |
|---|---|---|---|
| **B1** — Zod pinnato `^3.25.76` | TSK-013 `lib/zod/index.ts` | **VERIFICATO ✓** | `lib/zod/index.ts` (16 KB) compila; `tsc --noEmit` 0 errori |
| **B4** — gate di qualità | TSK-012 | **VERIFICATO ✓** | `tsc` exit 0 (0 err, era 126) · `next lint` exit 0 (0 err, solo warning) · `prettier --check` exit 0 («All matched files») |
| **B8** — seed `@date-fns/tz` | TSK-013 `db/seed.ts` | **VERIFICATO ✓** | import `TZDate`, `new TZDate(date, TIMEZONE)`; `toZonedTime/fromZonedTime` rimossi |
| **B6** — `inUseMap` | TSK-015 `ShiftTypesClient` | **NON APPLICATO ✗** | `ShiftTypeTable` montato senza prop `inUseMap` → branch ancora morto |

> B1, B4, B8 sono corretti e stabili. **B6 non è stato applicato** (come già annotato nel task:
> `inUseMap` fuori dallo scope dei fix B1–B8). Restano inoltre aperti finding blocking non toccati
> da questo batch di fix (F-010-01/02, F-013-02).

### Dettaglio esecuzione gate TSK-012 (era `reject`)

```
tsc --noEmit          → exit 0   |  0 × "error TS"      (iter-1: 126 errori)
next lint             → exit 0   |  0 errori, N warning (iter-1: crash type-aware)
prettier --check .    → exit 0   |  "All matched files use Prettier code style!" (iter-1: 242 file)
```

- `eslint.config.mjs`: presenti `languageOptions.parser: tsParser` + `parserOptions.project:
  './tsconfig.json'` + `tsconfigRootDir` → le regole type-aware (`no-floating-promises`,
  `no-misused-promises`) girano senza crash. **F-012-02 risolto.**
- `vitest.config.ts`: `include: ['src/**/*.{test,spec}.ts','lib/**/*.{test,spec}.ts']`,
  `exclude: ['tests/e2e/**','tests/a11y/**','tests/visual/**','node_modules/**']`, coverage
  `include: ['lib/rules/**','lib/zod/**']` con soglie 80/80/75/80 → **corretto**.
- I 126 errori `tsc` (incl. `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) sono azzerati:
  chiude anche **F-013-03** (seed risolto con asserzioni non-null `!` documentate).
- **N warning** residui `next lint` (non-bloccanti, non contano ai fini dell'AC «0 errori»):
  `no-console` in `lib/toast.ts`, `react-hooks/exhaustive-deps` in `StaffPageClient`/`ShiftGrid`,
  `jsx-a11y/role-supports-aria-props` in `ShiftCell`/`RequestQueue`. Vedi Osservazioni residue.

---

## Sintesi verdetti iter-2

| TSK | Area | iter-1 | **iter-2** | Δ | Blocking aperti |
|---|---|---|---|---|---|
| TSK-010 | E2E Playwright | conditional | **conditional** | = | 2 (F-010-01, F-010-02) |
| TSK-011 | A11y WCAG 2.2 AA | conditional | **conditional** | = | 0 |
| TSK-012 | Code Quality Gate | reject | **passed** ✓ | ↑↑ | 0 |
| TSK-013 | DB migration | conditional | **conditional** | ↑ (2/3) | 1 (F-013-02) |
| TSK-014 | Dashboard Admin | conditional | **conditional** | = | 0 |
| TSK-015 | Tipologie turno | conditional | **conditional** | = | 1 (F-015-01) |
| TSK-016 | Anagrafica dipendenti | conditional | **conditional** | = | 0 |

> **TSK-012 esce dal `reject`**: le tre porte sono oggettivamente verdi. Nessun auto-close/merge —
> il passaggio a `passed` è advisory per l'orchestrator (R.Q3).

---

## TSK-010 — Acceptance Spec Playwright E2E → `conditional` (invariato)

I finding di TSK-010 **non erano nello scope dei fix B1–B8**: nessuno è stato dispacciato.

### F-010-01 · HIGH (blocking) · robustezza — **APERTO** — test-gate che fallisce by-design
`shifts.spec.ts` `T-DOM-02` (l.34) asserisce ancora in modo **hard** (`.getByTestId(
'violation-badge-RB-01').or(getByRole('alert')…)` con `toBeVisible({ timeout: 5000 })`, l.60-64) +
Salva disabilitato (l.67). I commenti (l.9-11, 28, 32) confermano che ShiftGrid **non passa ancora
`existingShifts`** → il test resta rosso allo stato attuale e **non è marcato `test.fixme()`/`skip`**.
Contraddice l'AC «`npx playwright test`: 0 failed». L'aggiunta di `.or(...)` non cambia l'esito.
`[^src5: code/app/tests/e2e/domain/shifts.spec.ts:34]`
`[^rule: emergent/qa.testing.hollow-acceptance.md §Rationale]` (candidate)

### F-010-02 · HIGH (blocking) · robustezza — **APERTO** — suite E2E non self-boota il server
`playwright.config.ts` **non ha `webServer`** e `package.json` **non ha `start:test`** (verificato via
grep: 0 match). L'AC «su CI: 0 failed» + «suite < 5 min» resta non raggiungibile out-of-the-box.
`[^src5: code/app/playwright.config.ts:1]`
`[^rule: emergent/qa.e2e.self-hosted-webserver.md §Rationale]` (candidate)

### F-010-03 · MEDIUM · idiomaticità/robustezza — **APERTO** — `T-DOM-04` dead code + soft-pass
Invariato: `absenceTypesResp` (l.93) e `absTypesResp` (l.106) fetchati e mai usati (chiamate
duplicate); `absenceTypeId: 'placeholder-not-a-valid-uuid'` (l.116) + `test.skip(...)` a runtime
(l.129) → test di fatto sempre skippato.
`[^src5: code/app/tests/e2e/domain/shifts.spec.ts:93]`
`[^rule: emergent/qa.testing.hollow-acceptance.md §Rationale]` (candidate)

### F-010-04 · MEDIUM (qa.*) · design — **APERTO** — coverage AC incompleta (T-DOM-08 / T-REC / T-SWP)
Invariato. Completamento demandato a `qa-dev`, non implementare qui.
`[^src5: code/app/tests/e2e/domain/shifts.spec.ts:1]`
`[^rule: emergent/qa.testing.hollow-acceptance.md §Rationale]` (candidate, `severity: medium`)

### F-010-05 · LOW · idiomaticità — **APERTO** — dependency Playwright "morta"
Progetto `setup` con `testMatch: /.*\.setup\.ts/` + `dependencies: ['setup']` (l.34,36,50,65,78), ma
**nessun file `*.setup.ts` esiste** (find: 0 match) → dipendenza da un progetto che esegue 0 test.
`[^src5: code/app/playwright.config.ts:34]`

---

## TSK-011 — A11y WCAG 2.2 AA → `conditional` (invariato, 0 blocking)

Nessun fix dispacciato. F-011-01 (gate a11y con severità divergenti), F-011-02 (AC tastiera/nav non
coperti — `qa.*`), F-011-03 (import `expect` inutilizzato — ora **visibile** a lint dato che ESLint
non crasha più; resta warning), F-011-04 (`waitForLoadState('networkidle')`) **tutti aperti**.
Nessuno è blocking; l'unico effetto collaterale positivo di B4 è che F-011-03 non è più mascherato.
`[^src5: code/app/tests/a11y/sprint2/a11y-sprint2.spec.ts:67]`
`[^rule: emergent/a11y.gate.consistent-severity-threshold.md §Rationale]` (candidate)

---

## TSK-012 — Code Quality Gate → **`passed`** ✓ (era `reject`)

Le tre porte sono oggettivamente verdi (vedi «Dettaglio esecuzione gate» sopra). I tre finding
blocking di iter-1 sono chiusi:

- **F-012-01 · RISOLTO** — `tsc --noEmit` 0 errori (era 126). `[^src5: code/app/tsconfig.json:7]`
- **F-012-02 · RISOLTO** — `eslint.config.mjs` ora ha `parserOptions.project`+`tsconfigRootDir`;
  `next lint` non crasha, exit 0. `[^src5: code/app/eslint.config.mjs:18]`
- **F-012-03 · RISOLTO** — `prettier --check .` 0 file fuori formato (era 242).
  `[^src5: code/app/.prettierrc:1]`

> Nota (non blocking): l'esecuzione della **suite unit + coverage** (`vitest run --coverage`, soglie
> 80/80/75/80 su `lib/rules`+`lib/zod`) è correttezza → dominio `qa-dev`, non CQRL. Qui è verificata
> solo la **config** del gate, che è corretta.

---

## TSK-013 — DB migration → `conditional` (progresso 2/3)

### F-013-01 · HIGH (blocking) · **RISOLTO ✓** — seed `@date-fns/tz`
`db/seed.ts:34` importa ora `TZDate` da `@date-fns/tz`; `localDt` (l.72-75) fa
`new TZDate(date, TIMEZONE)` + `setHours/…` (API moderna corretta: `TZDate extends Date`, gli helper
operano nel fuso dichiarato). Nessun più `toZonedTime/fromZonedTime`. `tsc` 0.
`[^src5: code/app/db/seed.ts:34]`
`[^rule: emergent/general.doc-code-mismatch.md §Rationale]` (candidate)

### F-013-02 · MEDIUM (blocking) · design — **APERTO** — migrazioni non registrate nel journal Drizzle
Invariato: `db/migrations/` contiene solo `0001/0002/0003` `.sql` hand-authored; **manca
`meta/_journal.json` e gli snapshot**; nessun runner SQL custom (grep `migrate`/`readMigrationFiles`
in `db/**`: 0 match). `drizzle.config.ts` punta a `out: './db/migrations'` e `db:migrate` =
`drizzle-kit migrate` → senza journal non applica nulla. Gli AC «`drizzle-kit generate/migrate`»
restano non verificabili. **Questo finding non era nello scope dei fix B1–B8.**
`[^src5: code/app/db/migrations/0003_availability_coverage_swap.sql:1]`
`[^rule: emergent/general.dead-broken-code.md §Rationale]` (candidate)

### F-013-03 · MEDIUM · robustezza · **RISOLTO ✓** — `noUncheckedIndexedAccess` nel seed
Chiuso da B4: `tsc` 0 errori. Il seed usa asserzioni non-null `!` documentate (l.88: «db.insert…
returning() garantisce N righe»). Pragmatico ma accettabile.
`[^src5: code/app/db/seed.ts:88]`

---

## TSK-014 — Dashboard Admin → `conditional` (invariato, 0 blocking)

### F-014-01 · MEDIUM · robustezza — **APERTO** — «Timeout > 5s» dichiarato ma non implementato
Nessun fix dispacciato. `KpiCard.tsx` **non ha** `AbortController`/`signal`; il commento (l.109)
«Timeout esplicito: dopo 5s TanStack considera il fetch stale» **conflonde `staleTime` con un timeout
di richiesta** (sono cose diverse: `staleTime` non annulla una fetch appesa). Doc-comment (l.24)
ancora fuorviante. AC «Timeout > 5s → stato errore» non soddisfatto.
`[^src5: code/app/components/dashboard/KpiCard.tsx:109]`
`[^rule: emergent/general.doc-code-mismatch.md §Rationale]` (candidate)

### F-014-02 · LOW · robustezza — **APERTO** — fetch turni sprecata quando coverage=501. Invariato.
`[^src5: code/app/components/dashboard/CoverageAlertList.tsx:50]`

---

## TSK-015 — Tipologie turno → `conditional` (invariato — B6 non applicato)

### F-015-01 · HIGH (blocking) · design — **APERTO** — `inUseMap` mai popolato → RF-C CA2 non attivo
**B6 non è stato applicato.** `ShiftTypeTable` mantiene `inUseMap?: … = {}` (l.114) e
`ShiftTypesClient` monta `<ShiftTypeTable onAddNew={…} />` **senza `inUseMap`** (l.32) → `isInUse`
(l.205, l.229) sempre `false` → ogni riga mostra solo **Elimina**, mai «Disattiva» né badge «In uso».
RF-C CA2 strutturalmente disatteso. Branch presente ma morto.
`[^src5: code/app/app/(admin)/shift-types/_components/ShiftTypesClient.tsx:32]`
`[^rule: emergent/general.dead-broken-code.md §Rationale]` (candidate)

### F-015-02 · MEDIUM · robustezza/UX — **APERTO** — copy DELETE contraddittoria
Invariato: dialog `delete` titolo «Eliminare "X"?» (l.426) ma corpo «La tipologia verrà
**disattivata** … può essere annullata riattivando … tramite Modifica» (l.428-431). Incoerente con
l'azione reale (`deleteMutation`, l.440).
`[^src5: code/app/components/shift-types/ShiftTypeTable.tsx:426]`
`[^rule: emergent/general.doc-code-mismatch.md §Rationale]` (candidate)

### F-015-03 · MEDIUM · design — **APERTO** — logica durata turno duplicata (viola RB-12 single-source)
Invariato: `parseHHMM`+durata+`formatDuration` duplicati tra `ShiftTypeTable.tsx` (l.60-88) e
`ShiftTypeModal.tsx`. Prescritto `lib/rules/calculateShiftDuration` (RB-12).
`[^src5: code/app/components/shift-types/ShiftTypeTable.tsx:60]`
`[^rule: emergent/fe.domain.shared-rule-duplication.md §Rationale]` (candidate)

### F-015-04 · LOW · idiomaticità — commento «DST-safe via date-fns/tz» fuorviante. **APERTO.**
`[^src5: code/app/components/shift-types/ShiftTypeModal.tsx:107]`

### F-015-05 · LOW · idiomaticità — cast ripetuti che vanificano la discriminated union. **APERTO.**
`[^src5: code/app/components/shift-types/ShiftTypeModal.tsx:172]`

---

## TSK-016 — Anagrafica dipendenti → `conditional` (invariato, 0 blocking)

### F-016-01 · MEDIUM/HIGH · idiomaticità — **APERTO** — `any` pervasivo in `StaffModal`
Nessun fix dispacciato. Persistono **20** occorrenze `// eslint-disable-next-line
@typescript-eslint/no-explicit-any` + `: any`/`as any` (l.120-121 `resolver … as any`, l.260-261
`renderFormBody(form: any, …)`, `(form as any).control` ripetuto ~8×). Il gate `no-explicit-any:
error` passa **solo perché soppresso riga-per-riga** → la type-safety del form resta vanificata.
Contraddice l'AC TSK-012 «nessun `any` non giustificato». Non blocking, ma quality debt da chiudere.
`[^src5: code/app/components/staff/StaffModal.tsx:261]`
`[^rule: emergent/general.dead-broken-code.md §Rationale]` (candidate)

### F-016-02 · MEDIUM · design — **APERTO** — campi AC assenti (`telefono`, `contractType`). Invariato (gap G-004/G-005).
`[^src5: code/app/components/staff/StaffModal.tsx:20]`

### F-016-03 · LOW · idiomaticità — **APERTO** — entrambe le `useForm` istanziate sempre. Invariato.
`[^src5: code/app/components/staff/StaffModal.tsx:119]`

---

## Osservazioni residue (nuove, non-blocking) da B4

L'ESLint non crasha più → sono ora **visibili** warning prima mascherati (non contano ai fini
dell'AC «0 errori», ma sono debito da monitorare):
- `no-console` in `lib/toast.ts` (l.15, 21).
- `react-hooks/exhaustive-deps` in `StaffPageClient.tsx` (l.45) e `ShiftGrid.tsx` (l.180) →
  dipendenze `useMemo` che possono cambiare a ogni render (rischio re-render / stale closure).
- `jsx-a11y/role-supports-aria-props`: `aria-disabled` su `role="cell"` in `ShiftCell.tsx`
  (l.73, 88) e `aria-sort` su `role="button"` in `RequestQueue.tsx` (l.106, 158) → attributi ARIA
  non supportati dal ruolo (potenziale finding a11y per l'`a11y-specialist`).

Nessuno è blocking; segnalati per completezza (candidati `qa.*`/`a11y.*`).

---

## Loop status (iter 2 / 3)

- **Progresso reale:** TSK-012 `reject → passed` (3/3 gate); TSK-013 2/3 finding chiusi (F-013-01,
  F-013-03). Fix B1/B4/B8 corretti e stabili.
- **No-progress detection (mecc. §19.4):** TSK-010, TSK-011, TSK-014, TSK-016 hanno **set di
  `rule_id` identico a iter-1** (non dispacciati). TSK-015 F-015-01 identico (B6 non applicato).
  Questi rappresentano un segnale di no-progress: se ripresentati invariati a iter-3, l'aggregator
  forza `reject` + escalation umana (R.Q3, §7 r.16).
- **Regression detection (R.Q4-ter):** `prettier --write` ha toccato ~242 file (blast radius ampio)
  ma **solo formattazione**; `tsc` 0 conferma nessuna regressione di tipo; nessun nuovo finding
  blocking in file non toccati. Regressione: **non rilevata**.
- **max_iterations 3 non bypassabile:** iter-3 è l'ultima. I 4 blocking ancora aperti
  (F-010-01, F-010-02, F-013-02, F-015-01) **devono** essere dispacciati ora con `task_package`
  mirati (≤ 80 righe diff/finding), altrimenti reject forzato.

## Prossimo step consigliato

1. **Dispacciare esplicitamente i 4 `task_package` blocking mancanti** (non erano nel batch B1–B8):
   - **F-015-01 (B6, mai applicato):** popolare `inUseMap` (conteggio `shifts` per `shiftTypeId`
     via API/join RSC) e passarlo a `<ShiftTypeTable inUseMap={…} />`.
   - **F-013-02:** rigenerare le migrazioni con `drizzle-kit generate` (produce journal+snapshot)
     **oppure** documentare un runner SQL esplicito coerente con gli AC.
   - **F-010-01:** `test.fixme(...)` su T-DOM-02 con link al gap ShiftGrid→existingShifts.
   - **F-010-02:** aggiungere `webServer` in `playwright.config.ts` + script `start:test`.
2. Finding `qa.*`/`a11y.*` (F-010-04, F-011-02, warning ARIA di ShiftCell/RequestQueue) → instradare
   a `qa-dev` / `a11y-specialist`, **non** risolvere qui.
3. Non-blocking quality debt (F-014-01, F-015-02/03, F-016-01/02) → opportunistici, fuori dal budget
   diff dell'iterazione blocking.
4. **TSK-012:** `passed` — nessuna azione. Seminare `code_quality/rules/canonical/` con le regole
   `candidate` citate (gate umano) per uscire dalla modalità degradata.

---

### Sicurezza (fuori scope CQRL — nessun incidente)

Nessun secret di produzione né CVE emersi in questa iterazione. Le credenziali fixture
(`Admin123!`/`Employee123!`) in `tests/e2e/global-setup.ts` restano fixture di test allineate al
seed. Nessun `wiki/incidents/*` aperto.
