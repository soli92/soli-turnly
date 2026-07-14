# CQRL Code Review — Batch 3 (TSK-010 → TSK-016)

- **reviewer_version:** cqrl-v2.12
- **generated_at:** 2026-07-14
- **passes:** idiomaticity, design, robustness (+ accessibility, config-active)
- **stack_descriptor:** `typescript@5 / next@15 (app-router, rsc) / drizzle-orm+postgres@16 / tanstack-{query,table,virtual} / react-hook-form+zod / playwright + axe-core / vitest` — confidence **alta** (> `confidence_min` 0.6), review **stack-aware** completa.

## Nota di degradazione (ruleset)

`code_quality/rules/{team-specific,emergent,canonical}` sono **vuote** (solo `.gitkeep`).
Non esiste alcun ruleset attivo: la review gira in **modalità degradata evolutiva**. I finding
citano `rule_id` in convenzione come **candidate emergent** (mai attive; promozione = gate umano,
§19.5). Nessuna regola è stata inventata come "attiva". Raccomandazione trasversale: seminare
`code_quality/rules/canonical/` con le regole citate qui sotto.

---

## Sintesi verdetti

| TSK | Area | Verdict | Blocking | Note |
|---|---|---|---|---|
| TSK-010 | E2E Playwright | **conditional** | 2 | Test-gate che fallisce by-design; manca `webServer`/`start:test` |
| TSK-011 | A11y WCAG 2.2 AA | **conditional** | 0 | Gate a11y divergenti; coverage AC parziale |
| TSK-012 | Code Quality Gate | **reject** (gate umano) | 3 | `tsc` 126 err · `eslint` crasha · `prettier` 242 file |
| TSK-013 | DB migration | **conditional** | 2 | seed usa API `@date-fns/tz` inesistente; migrazioni non registrate nel journal Drizzle |
| TSK-014 | Dashboard Admin | **conditional** | 0 | Ottimo impianto; timeout 5s dichiarato ma non implementato |
| TSK-015 | Tipologie turno | **conditional** | 1 | `inUseMap` mai popolato → RF-C CA2 non wired; copy DELETE contraddittoria |
| TSK-016 | Anagrafica dipendenti | **conditional** | 0 | `any` pervasivo in StaffModal; campi AC mancanti (documentati come gap) |

> **`reject` = gate umano** (R.Q3). Nessun auto-revert, nessuna riapertura automatica del Develop.
> Le altre condizioni sono `conditional` (bounded loop, max_iterations 3): re-Develop mirato con
> `task_package` ≤ 80 righe di diff per finding bloccante.

---

## TSK-010 — Acceptance Spec Playwright E2E → `conditional`

**Positivi.** Fixture `adminPage`/`employeePage` con contesti isolati e `ctx.close()` per test
(nessuno stato condiviso, AC rispettato); auth via `storageState` in `global-setup.ts` (nessun
login UI nei test di dominio); suite RBAC/`T-SEC-*` ampia e ben commentata.

### F-010-01 · HIGH · robustezza — test-gate che fallisce by-design committato come verde
`tests/e2e/domain/shifts.spec.ts` `T-DOM-02` asserisce `violation-badge-RB-01` visibile e Salva
disabilitato, ma il commento stesso dichiara «ShiftGrid non passa `existingShifts` (bug, TSK da
aprire)». Il test **fallisce allo stato attuale** e non è marcato `test.fixme()`/`skip`. Contraddice
l'AC «`npx playwright test` su CI: 0 failed».
Fix: `test.fixme(...)` con riferimento al gap finché ShiftGrid non passa `existingShifts`, oppure
aprire il TSK di prodotto e linkarlo.
`[^src5: code/app/tests/e2e/domain/shifts.spec.ts:35]`
`[^rule: emergent/qa.testing.no-known-failing-gate.md §Rationale]` (candidate)

### F-010-02 · HIGH · robustezza — suite E2E non self-boota il server
`playwright.config.ts` **non ha blocco `webServer`** e `package.json` **non ha script `start:test`**
(entrambi presenti nello spec del TSK). Con `fullyParallel` + `globalSetup` che naviga su
`baseURL/login`, la suite presuppone un server già attivo su :3000 → l'AC «su CI: 0 failed» e
«tempo suite < 5 min su runner GitHub Actions» non è raggiungibile out-of-the-box.
Fix: aggiungere `webServer: { command: 'npm run start:test', url, reuseExistingServer: !CI }` e lo
script `start:test`.
`[^src5: code/app/playwright.config.ts:18]`
`[^rule: emergent/qa.e2e.self-hosted-webserver.md §Rationale]` (candidate)

### F-010-03 · MEDIUM · idiomaticità/robustezza — `T-DOM-04` con dead code e assert debole
In `shifts.spec.ts` `T-DOM-04`: (a) `absenceTypesResp` e `absTypesResp` sono fetchati e **mai
usati** (chiamate duplicate); (b) `absenceTypeId: 'placeholder-not-a-valid-uuid'` forza un 400 e poi
`test.skip(true, …)` a runtime — il test è di fatto sempre skippato; (c) l'assert è dentro
`if (await absenceCell.count() > 0)`, quindi **passa silenziosamente** se la cella non esiste
(green-when-nothing-verified).
Fix: rimuovere le fetch morte; introdurre l'endpoint tipi-assenza o un seed deterministico; togliere
il guard condizionale rendendo l'assenza della cella un failure esplicito.
`[^src5: code/app/tests/e2e/domain/shifts.spec.ts:92]`
`[^rule: emergent/qa.testing.no-conditional-soft-pass.md §Rationale]` (candidate)

### F-010-04 · MEDIUM · design — coverage AC incompleta (T-DOM-08 / T-REC / T-SWP)
Il corpo del TSK richiede `T-DOM-08` (durata DST-safe), `T-REC-01` e `T-SWP-01`. In
`tests/e2e/domain/` ci sono solo `shifts.spec.ts` e `requests.spec.ts`; **non esiste alcun spec E2E
di swap** e i casi DST/ricorrenza-salta-assenza non sono presenti come da acceptance. (Esistono
`sprint2/recurrence.spec.ts` e `sprint3/ics-export.spec.ts`, ma non coprono questi casi.)
Nota `qa.*` — completamento demandato a `qa-dev`, non implementare qui.
`[^src5: code/app/tests/e2e/domain/shifts.spec.ts:1]`
`[^rule: emergent/qa.testing.acceptance-coverage.md §Rationale]` (candidate, `severity: medium`)

### F-010-05 · LOW · idiomaticità — dependency Playwright "morta"
`playwright.config.ts` definisce il progetto `setup` con `testMatch: /.*\.setup\.ts/`, ma non esiste
alcun file `*.setup.ts` (l'auth passa da `globalSetup`). I progetti `a11y`/`visual-*` dichiarano
`dependencies: ['setup']` → dipendenza da un progetto che esegue 0 test. Fuorviante.
`[^src5: code/app/playwright.config.ts:33]`

---

## TSK-011 — A11y WCAG 2.2 AA → `conditional`

**Positivi.** `a11y-sprint2.spec.ts` è ben costruito: `AxeBuilder` con tag WCAG 22aa, messaggi
diagnostici ricchi, test negativo che verifica che axe stesso funzioni. Ottima intenzione.

### F-011-01 · MEDIUM · design — due gate a11y con severità divergenti
`tests/a11y/a11y.spec.ts` usa `checkA11y` (fallisce su **qualsiasi** violazione → strict, coerente
con l'AC «0 violazioni WCAG 2.2 AA») mentre `tests/a11y/sprint2|3/*.spec.ts` filtrano solo
`impact === 'critical' | 'serious'` (gate **più debole**). Due filosofie coesistono: la relaxed
contraddice l'AC di TSK-011. Serve una policy unica (allineare la soglia in `factory.config` e in
tutti gli spec).
`[^src5: code/app/tests/a11y/sprint2/a11y-sprint2.spec.ts:67]`
`[^rule: emergent/a11y.gate.consistent-severity-threshold.md §Rationale]` (candidate)

### F-011-02 · MEDIUM · design — AC di tastiera/nav non coperti da test
`keyboard-nav.spec.ts` verifica solo «Tab atterra su elemento interattivo» + «Escape chiude il
dialog». Restano **non testati** AC espliciti di TSK-011: navigazione griglia con **frecce**,
**skip link** visibile al primo Tab, `aria-current="page"` sulla sidebar. Da coprire (nota `qa.*`).
`[^src5: code/app/tests/a11y/keyboard-nav.spec.ts:6]`
`[^rule: emergent/a11y.keyboard.grid-navigation-coverage.md §Rationale]` (candidate)

### F-011-03 · LOW · idiomaticità — import inutilizzato `expect`
`a11y.spec.ts` importa `{ test, expect }` ma `expect(` è usato 0 volte (verifica via `checkA11y` che
lancia). Latente errore `@typescript-eslint/no-unused-vars` (attualmente mascherato dal crash ESLint
— vedi F-012-02).
`[^src5: code/app/tests/a11y/a11y.spec.ts:1]`

### F-011-04 · LOW · robustezza — `waitForLoadState('networkidle')`
Pattern sconsigliato dalla doc Playwright (flaky su app con polling/SSE come questa: `useNotifications`
e `refetchInterval`). Preferire web-first assertions sul contenuto atteso della route.
`[^src5: code/app/tests/a11y/a11y.spec.ts:33]`

---

## TSK-012 — Code Quality Gate → `reject` (gate umano)

Verdict `reject` perché l'oggetto stesso del TSK — «far passare il gate» — è **oggettivamente
disatteso su tutte e tre le porte**, con volume che eccede il budget di una singola iterazione
(`max_diff_lines: 80`) e con errori distribuiti anche fuori dallo scope di questo batch. Serve triage
umano sull'approccio (fix massivo vs. rilassamento temporaneo mirato del gate). Nessun auto-fix.

### F-012-01 · HIGH (blocking) · robustezza — `tsc --noEmit` → 126 errori (AC: 0)
Eseguito in review. 126 `error TS`. Categorie principali: `exactOptionalPropertyTypes` sugli
`AuditLogEntry` (`ip`/`userAgent: string | undefined`), `noUncheckedIndexedAccess` (accessi array
senza guard), `RequestListResponse` usato come array (`.length`/`.map`), enum `status` disallineati
(`'pending'` vs `'all' | RequestStatus`). Include file dello scope batch (`db/seed.ts`,
`api/shift-types/*`). AC «`tsc --noEmit` → 0 errori» non soddisfatto.
`[^src5: code/app/tsconfig.json:7]`
`[^rule: canonical/typescript.strict.zero-tsc-errors.md §Rationale]` (candidate)

### F-012-02 · HIGH (blocking) · robustezza — ESLint **crasha** (type-aware senza `parserOptions.project`)
`eslint.config.mjs` abilita `@typescript-eslint/no-floating-promises` e `no-misused-promises` (regole
**type-aware**) ma non configura `languageOptions.parserOptions.projectService`/`project`. `next lint`
termina con: *"You have used a rule which requires type information, but don't have parserOptions set
to generate type information"*. Il gate **non gira affatto** → AC «`eslint .` → 0 errori» non
verificabile. Fix: aggiungere il project service typescript-eslint o rimuovere le regole type-aware.
`[^src5: code/app/eslint.config.mjs:28]`
`[^rule: canonical/typescript.eslint.type-aware-parser-options.md §Rationale]` (candidate)

### F-012-03 · HIGH (blocking) · idiomaticità — `prettier --check` → 242 file fuori formato (AC: 0)
Eseguito in review: «Code style issues found in 242 files». AC «`prettier --check` → 0 file
out-of-format» non soddisfatto (interessa gran parte di `tests/**`, `types/**`, ecc.).
Fix meccanico: `npm run format` (o CI step `--write`), poi enforcement.
`[^src5: code/app/.prettierrc:1]`
`[^rule: canonical/style.prettier.zero-unformatted.md §Rationale]` (candidate)

> Le config in sé (tsconfig strict-flags, vitest coverage include `lib/rules`+`lib/zod` con soglie,
> struttura CI) sono corrette e idiomatiche: il problema è che **nessuna porta è verde**.

---

## TSK-013 — DB migration (availability / coverage_requirements / swap_operations) → `conditional`

**Positivi.** `db/schema.ts` tabelle 11-13 sono ben modellate e **allineate 1:1** con
`0003_availability_coverage_swap.sql` (enum, FK `onDelete: cascade` su `availability.user_id`, indici
`availability_user_idx`/`coverage_qual_idx`, `TIMESTAMPTZ` coerente con l'app DST-safe, CHECK
`day_of_week BETWEEN 0 AND 6`). Type-exports `$inferSelect/$inferInsert` completi. Seed inserisce
davvero le 3 regole di copertura e le 2 finestre di indisponibilità richieste.

### F-013-01 · HIGH (blocking) · robustezza — `db/seed.ts` importa membri inesistenti da `@date-fns/tz`
`db/seed.ts:26` → `import { toZonedTime, fromZonedTime } from '@date-fns/tz'`. Verificato in review:
`@date-fns/tz` esporta `TZDate, TZDateMini, tz, tzOffset, tzScan, tzName` — **non** `toZonedTime`/
`fromZonedTime` (quelle appartengono al pacchetto diverso `date-fns-tz`). Risultato: `tsc` fallisce
(`TS2305`) e il seed **crasherebbe a runtime** → AC «`db/seed.ts` esegue senza errori» + «`tsc`
passa» non soddisfatti. NB: l'errore è propagato da `raw/tech_stack.md` che afferma erroneamente che
`@date-fns/tz` esponga `zonedTimeToUtc`/`toZonedTime`.
Fix: usare `TZDate`/`tz` di `@date-fns/tz`, oppure aggiungere `date-fns-tz` come dipendenza.
`[^src5: code/app/db/seed.ts:26]`
`[^rule: emergent/typescript.imports.verify-package-exports.md §Rationale]` (candidate)

### F-013-02 · MEDIUM (blocking) · design — migrazioni hand-authored non registrate nel journal Drizzle
`db/migrations/` contiene `0001`,`0002`,`0003` `.sql` scritte a mano (marcatori `=== UP ===`/
`=== DOWN ===`, non-Drizzle) ma **manca `db/migrations/meta/_journal.json` e gli snapshot**.
`drizzle.config.ts` punta a `out: './db/migrations'`. `drizzle-kit migrate` legge il journal: senza,
non applica nulla; `drizzle-kit generate` rigenererebbe da zero un `0000` in conflitto con i file
esistenti. Gli AC «`drizzle-kit generate` produce migration» e «`drizzle-kit migrate`: 0 errori, 3
tabelle presenti» **non sono verificabili** con lo stato attuale. La sezione `=== DOWN ===` è
puramente decorativa (Drizzle è forward-only).
Fix: rigenerare le migrazioni con `drizzle-kit generate` (produce journal+snapshot) oppure adottare
un runner SQL esplicito documentato, coerente con gli AC.
`[^src5: code/app/db/migrations/0003_availability_coverage_swap.sql:88]`
`[^rule: emergent/db.drizzle.migrations-journal-integrity.md §Rationale]` (candidate)

### F-013-03 · MEDIUM · robustezza — `db/seed.ts` viola `noUncheckedIndexedAccess`
~20 errori `TS18048 'x' is possibly 'undefined'` (es. `infermiere`, `turnoNotte`, `marioRossi`,
`shiftType`, `adminUser`) da accessi array/`find` non guardati. Contraddice l'AC «Nessuna regressione
… `tsc --noEmit` passa».
Fix: guard/asserzioni non-null con messaggio chiaro, o helper `getSeeded(...)` che lancia se assente.
`[^src5: code/app/db/seed.ts:102]`
`[^rule: canonical/typescript.strict.no-unchecked-index-access.md §Rationale]` (candidate)

---

## TSK-014 — Dashboard Admin → `conditional`

**Positivi (impianto molto solido).** RSC leggero che compone client-component per KPI (pattern
corretto); `KpiCard` generica con stati loading/error/empty ben separati; a11y curata (`aria-busy`,
`sr-only`, `aria-hidden` su icone, `<section aria-label>`, focus ring su card `Link`);
`CoverageAlertList` con graceful degradation su 501 + empty-state «Copertura OK»; `InboxBadge`
integra `useNotifications()` (SSE) + `refetchInterval 60s` per RF-K CA2.

### F-014-01 · MEDIUM · robustezza — «Timeout > 5s → errore» dichiarato ma non implementato
Il doc-comment di `KpiCard` promette «Timeout > 5s: mostra stato errore con Riprova». L'implementazione
usa solo `staleTime: 30_000` + `retry: 1`, **senza** `AbortController`/timeout della `fetch`: una
richiesta appesa resta in skeleton indefinitamente. AC «Timeout > 5s: mostra stato errore» non
soddisfatto; commento fuorviante.
Fix: `AbortController` con `setTimeout(5000)` nella `queryFn` (o `signal`), reject → stato error.
`[^src5: code/app/components/dashboard/KpiCard.tsx:117]`
`[^rule: emergent/react.data.fetch-timeout-honored.md §Rationale]` (candidate)

### F-014-02 · LOW · robustezza — fetch turni sprecata quando coverage=501
In `CoverageAlertList.fetchUndercoveredSlots` il `Promise.all` lancia sempre anche la fetch `/api/
shifts`, poi scarta tutto se coverage è 501/404. Innocuo ora (TSK-006 non pronto) ma spreca una
round-trip. Valutare short-circuit.
`[^src5: code/app/components/dashboard/CoverageAlertList.tsx:50]`

---

## TSK-015 — Tipologie turno → `conditional`

**Positivi.** `ShiftTypeModal` con Zod campo-per-campo in italiano, calcolo durata live corretto
(«Notte 22:00–06:00» → 480 min, `crossesMidnight` true), warning notturno `role="status"` +
`aria-live="polite"`, switch custom con `aria-checked`/`sr-only`. `ShiftTypeTable` con `<th scope>`,
AlertDialog Radix, empty/skeleton/error states.

### F-015-01 · HIGH (blocking) · design — `inUseMap` mai popolato → RF-C CA2 non attivo
`ShiftTypeTable` decide DELETE vs "Disattiva"/"In uso" da `inUseMap` (default `{}`). Ma
`ShiftTypesClient` monta `<ShiftTypeTable onAddNew={…} />` **senza passare `inUseMap`** → `isInUse`
sempre `false` → ogni riga mostra **solo Elimina**, mai la disattivazione protetta. L'AC «Tipologia
con turni associati: DELETE non disponibile, solo disattivazione (RF-C CA2)» è **strutturalmente
disatteso** (branch presente ma dead). Il badge «In uso» non appare mai.
Fix: popolare `inUseMap` (conteggio `shifts` per `shiftTypeId`, via API o join lato RSC) e passarlo al
componente.
`[^src5: code/app/app/(admin)/shift-types/_components/ShiftTypesClient.tsx:32]`
`[^rule: emergent/react.props.no-dead-branch-default.md §Rationale]` (candidate)

### F-015-02 · MEDIUM · robustezza/UX — copy dell'AlertDialog DELETE contraddittoria
Nel dialog `type === 'delete'` il titolo è «Eliminare "X"?» ma il corpo dice «La tipologia verrà
**disattivata** … può essere annullata riattivando … tramite Modifica». Messaggio incoerente con
l'azione (DELETE) e con l'utente: promette disattivazione reversibile mentre esegue eliminazione.
Fix: allineare la copy alla semantica reale del `deleteMutation`.
`[^src5: code/app/components/shift-types/ShiftTypeTable.tsx:445]`
`[^rule: emergent/ux.copy.destructive-action-clarity.md §Rationale]` (candidate)

### F-015-03 · MEDIUM · design — logica durata turno duplicata (viola RB-12 single-source)
`parseHHMM` + calcolo durata + `formatDuration` sono **duplicati** tra
`ShiftTypeModal.tsx` (`calcShiftDurationFromTimes`) e `ShiftTypeTable.tsx` (`calcDurationMinutes`).
Lo spec del TSK e `tech_stack.md` prescrivono la funzione pura condivisa
`lib/rules/calculateShiftDuration` (RB-12), invocata sia da FE che API. La duplicazione rischia
divergenza dall'implementazione canonica di RB-12.
Fix: estrarre in `lib/rules/` (o `lib/date/`) e importare in entrambi.
`[^src5: code/app/components/shift-types/ShiftTypeTable.tsx:60]`
`[^rule: canonical/design.dry.single-source-business-rule.md §Rationale]` (candidate)

### F-015-04 · LOW · idiomaticità — commento «DST-safe via date-fns/tz» fuorviante
`calcShiftDurationFromTimes` usa una data di riferimento **fissa** `new Date(2000,0,3)` (di proposito
non-DST) + `differenceInMinutes`: è corretto per la preview ma **non** è "DST-safe via date-fns/tz"
come afferma il commento (non usa tz). Allineare il commento o delegare a RB-12 (vedi F-015-03).
`[^src5: code/app/components/shift-types/ShiftTypeModal.tsx:107]`

### F-015-05 · LOW · idiomaticità — cast ripetuti che vanificano la discriminated union
In `ShiftTypeModal` `props as ShiftTypeModalEditProps` è ripetuto ~7 volte perché `const { mode } =
props` early destructuring rompe il narrowing. Con `if (props.mode === 'edit')` il TS narrowerebbe
`props.shiftType` senza cast.
`[^src5: code/app/components/shift-types/ShiftTypeModal.tsx:172]`

---

## TSK-016 — Anagrafica dipendenti → `conditional`

**Positivi (parte tabellare eccellente).** `StaffTable` usa `@tanstack/react-virtual` (soddisfa
«50+ dipendenti»), `role="grid"` + `aria-sort`/`aria-colindex`/`aria-rowindex`, ordine colonne esatto
(cognome, nome, email, qualifica, ore/sett., contratto, stato), sort di default su `lastName`.
`StaffPageClient` pulito (initialData da RSC, filtri client memoizzati, `useCallback`). RF-B CA1
(email dup → `setError('email')`) e CA2 (AlertDialog conferma disattivazione) implementati.

### F-016-01 · MEDIUM/HIGH · idiomaticità — `any` pervasivo in `StaffModal` (contro TSK-012 e stack)
~12 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`: `resolver: zodResolver(...) as
any`, `renderFormBody(form: any, …)`, `(form as any).control` su ogni `FormField`. Vanifica la
type-safety del form (nome campo errato = nessun errore compile) e la filosofia "Zod condiviso FE+BE".
Contraddice l'AC di TSK-012 «nessun `any` non giustificato». Le due `useForm` (`AdminUserCreateInput`
vs `AdminUserPatchInput`) andrebbero unificate con un body generico tipizzato `<T extends FieldValues>`
o due render-body tipizzati.
`[^src5: code/app/components/staff/StaffModal.tsx:261]`
`[^rule: canonical/typescript.no-explicit-any-in-forms.md §Rationale]` (candidate)

### F-016-02 · MEDIUM · design — campi AC assenti: `telefono` e `contractType`
Lo spec elenca `telefono` (opzionale) e `contractType` enum (full-time/part-time/contractor); il modal
li omette (commento: gap G-004/G-005, API non li supporta). `StaffTable` **deriva** il contratto da
`contractHours` (≥36 = Full-time) invece del campo reale. AC (tabella campi StaffModal + colonna
contratto) parzialmente disatteso — tracciato come gap, quindi non nascosto, ma da chiudere.
`[^src5: code/app/components/staff/StaffModal.tsx:20]`
`[^rule: emergent/design.spec-field-coverage.md §Rationale]` (candidate, `severity: medium`)

### F-016-03 · LOW · idiomaticità — entrambe le `useForm` istanziate sempre
`createForm` ed `editForm` vengono create a ogni render indipendentemente da `mode`: un hook form
inutilizzato per modalità. Innocuo, ma valutare istanza singola condizionata.
`[^src5: code/app/components/staff/StaffModal.tsx:119]`

---

## Loop status

- Iterazione: **1** (nessun report precedente in `code_quality/reports/`). No-progress/regression
  detection non applicabile.
- `max_iterations`: 3. Le voci `conditional` sono ri-sviluppabili con `task_package` mirati.
- **TSK-012 = `reject`** → escalation umana (R.Q3 / §7 r.16): decidere se fix massivo di
  tsc/eslint/prettier o rilassamento temporaneo documentato del gate. Molti errori `tsc` sono fuori
  dallo scope di questo batch (matrix, reports, requests, api/absences) → coordinamento cross-TSK.

## Prossimo step consigliato

1. **Prima** dei re-Develop `conditional`: risolvere F-012-02 (ESLint config type-aware) così il gate
   torna eseguibile e i finding di lint diventano visibili.
2. Priorità blocking: F-010-01/02, F-013-01/02, F-015-01.
3. Finding `qa.*` (F-010-04, F-011-02) → instradare a `qa-dev`, non risolvere qui.
4. Seminare `code_quality/rules/canonical/` con le regole `candidate` citate (gate umano) per uscire
   dalla modalità degradata alle prossime review.

---

### Sicurezza (fuori scope CQRL — nessun incidente)

Credenziali `Admin123!`/`Employee123!` in `tests/e2e/global-setup.ts` sono fixture di test allineate
al seed, non secret di produzione → nessun `wiki/incidents/*` aperto. Segnalato solo per completezza.
