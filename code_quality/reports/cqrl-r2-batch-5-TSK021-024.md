# CQRL Batch 5 — Code Review ITER-2 (re-review dei fix) TSK-021 → TSK-024

- **Reviewer**: code-reviewer (CQRL v2.12)
- **generated_at**: 2026-07-14
- **iter**: 2 / `max_iterations` 3 (loop **non** esaurito)
- **report precedente**: `code_quality/reports/cqrl-batch-5-TSK021-024.md` (iter-1)
- **Scope**: verifica dei fix applicati (B6 su TSK-023, B8 su TSK-024) + stato dei finding
  residui esplicitamente fuori scope al round 1 (F-021-1, F-022-1, F-022-3).
- **Passate**: idiomaticità · design · robustezza (a11y delegata a EP-007 `a11y-specialist`).
- **Sicurezza**: fuori scope CQRL. Nessun secret in chiaro né CVE emersi → nessuna escalation.

## Stack rilevato

Invariato dall'iter-1: `typescript` · Next.js 15 App Router · React · TailwindCSS v4 ·
shadcn/ui (Radix) · TanStack Query v5 · React Hook Form + Zod · date-fns v3 · React Big
Calendar · Drizzle ORM · Playwright. Confidence ≥ `confidence_min (0.6)` → **modalità
stack-aware piena**.

> Le rule citate restano **bozze `emergent` `status: candidate`** (§19.5, gate umano).

---

## Esito sintetico dei fix verificati

| Item | TSK | Finding iter-1 | Severità | Esito iter-2 |
|---|---|---|---|---|
| B6 | TSK-023 | F-023-1 `SelectItem value=""` (crash Radix) | high (blocking) | **RISOLTO** |
| B8 (a) | TSK-024 | F-024-1 testid `submit-btn` + step 2→3 mancante | high (blocking) | **RISOLTO** |
| B8 (b) | TSK-024 | F-024-3 seed non eseguito + F-024-2 `test.skip` pervasivi | medium | **NON RISOLTO** |
| residuo | TSK-021 | F-021-1 overtime inline ≠ RB-06 | medium | **ANCORA PRESENTE** (era fuori scope) |
| residuo | TSK-022 | F-022-1 `RequestsListClient.tsx` orfano+rotto | medium | **PARZIALE**: rotto→riparato, ma **ancora orfano** |
| residuo | TSK-022 | F-022-3 i18n "richiestae" | low | **ANCORA PRESENTE** (era fuori scope) |

## Verdetto complessivo iter-2

| TSK | Verdict iter-1 | Verdict iter-2 | Blocking? | Nota |
|---|---|---|---|---|
| TSK-021 Calendario | conditional | **conditional** | no | debito design invariato (overtime, initialData) |
| TSK-022 Le mie richieste | conditional | **conditional** | no | orfano riparato ma non rimosso/collegato + i18n |
| TSK-023 Wizard | conditional (crash) | **conditional** | **no** (crash risolto) | resta solo debito design non-bloccante (schema Zod, Suspense) |
| TSK-024 E2E acceptance | conditional (rotto) | **conditional** | no | testid ok, ma seed/`test.skip` **non affrontati** |

Nessun `reject`. Progresso reale: **entrambi i finding `high`/bloccanti (F-023-1, F-024-1)
sono risolti**. Restano finding `medium`/`low`. `review_iter` → **2**. Loop non esaurito
(2 < 3): resta **una** iterazione. Suggerimento `review_status: conditional` su tutti e 4.

---

## Dettaglio verifica fix

### B6 · TSK-023 · F-023-1 — `SelectItem value=""` → RISOLTO ✅
`[^rule: code_quality/rules/emergent/fe.react.radix-select-empty-value.md §Rationale]`

Tutte e **quattro** le occorrenze iter-1 sono state corrette con il sentinella `"__none__"`;
nessun `SelectItem value=""` residuo in tutto `code/app/` (scan pulito):

1. `RequestFormModifyShift.tsx:357` — "Nessun cambio" ora `value="__none__"` (opzione
   selezionabile) con **normalizzazione corretta**:
   `value={field.value || '__none__'}` `[^src5: code/app/components/employee/requests/new/RequestFormModifyShift.tsx:350]`
   e `onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}`
   `[^src5: code/app/components/employee/requests/new/RequestFormModifyShift.tsx:351]`. Il
   round-trip empty ⇄ `__none__` è coerente.
2. `RequestFormSwap.tsx:216` — stato "nessun turno futuro" ora `value="__none__" disabled`
   `[^src5: code/app/components/employee/requests/new/RequestFormSwap.tsx:216]`.
3. `ColleagueTurnPicker.tsx:123` — stato "nessun turno disponibile" ora `value="__none__"
   disabled`, con `Select` intero `disabled` quando lista vuota
   `[^src5: code/app/components/employee/requests/new/ColleagueTurnPicker.tsx:123]`.
4. `RequestFormModifyShift.tsx:254` — selettore turno vuoto ora `value="__none__" disabled`
   `[^src5: code/app/components/employee/requests/new/RequestFormModifyShift.tsx:254]`.

**onValueChange — verifica esplicita (richiesta nel task)**: per l'unico item `__none__`
*selezionabile* (F-023 "Nessun cambio") la normalizzazione a `''` è presente e corretta. Per
i tre item `__none__` *disabled* (placeholder stati vuoti) la normalizzazione non serve: l'item
è non selezionabile → `field.value` non può mai assumere `"__none__"`, quindi gli `onValueChange`
diretti (`field.onChange` / `onChange`) sono corretti. **Il crash a runtime è eliminato.**

*Osservazione minore (non-bloccante)*: la stessa fix è stata applicata in modo coerente anche a
componenti fuori dai file dichiarati (CoverageRuleModal, StaffModal, ShiftEditor, ConflictShiftList,
UserForm, RequestForm legacy). È un allineamento positivo, non una regressione. Per "Nessun cambio"
il valore normalizzato al submit è `''` anziché `undefined` (come suggerito in iter-1): funzionalmente
equivalente perché `proposedShiftTypeId` è `z.string().optional()`.

### B8 (a) · TSK-024 · F-024-1 — testid + step 2→3 → RISOLTO ✅
`[^rule: code_quality/rules/emergent/qa.testing.testid-contract-drift.md §Rationale]`

Il test RF-M CA5 ora percorre il flusso wizard corretto:
- click `absence-form-next-btn` per avanzare step2→step3
  `[^src5: code/app/tests/e2e/sprint2/employee-requests.spec.ts:63]` — il testid esiste in
  `RequestFormAbsence.tsx:251`;
- submit via `confirm-submit-btn`
  `[^src5: code/app/tests/e2e/sprint2/employee-requests.spec.ts:67]` — il testid esiste in
  `RequestReviewStep.tsx:240`;
- nessun riferimento residuo al fantasma `submit-btn` (era del form legacy). Il commento a
  riga 66 documenta la correzione. Il test riflette ora il contratto reale del wizard.

### B8 (b) · TSK-024 · F-024-3 + F-024-2 — seed + `test.skip` → NON RISOLTO ❌
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]`
`[^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Rationale]`

Il secondo elemento esplicito del task ("verifica che i `test.skip` pervasivi siano stati
affrontati e che il seed sia deterministico") **non è stato affrontato**. Evidenze:

1. **La fixture non esegue alcun seed.** `fixtures/sprint2-db.ts` continua a definire solo
   `adminPage`/`employeePage`/`colleaguePage` e **nessuna** operazione di seeding; l'header
   dichiara ancora "Seed Sprint 2 aggiuntivo: 3 coverage_requirements, 2 availability, 1
   swap_operation" `[^src5: code/app/tests/e2e/fixtures/sprint2-db.ts:8]` → doc-code-mismatch
   persistente.
2. **DRY invariato.** La fixture ri-dichiara `adminPage`/`employeePage` via un proprio
   `base.extend` da `@playwright/test` `[^src5: code/app/tests/e2e/fixtures/sprint2-db.ts:42]`
   invece di estendere il `test` base di `fixtures/index.ts` (che li definisce già,
   `[^src5: code/app/tests/e2e/fixtures/index.ts:27]`).
3. **Bug di determinismo concreto (nuovo dettaglio):** la fixture fa login del collega come
   **`luca.verdi@turnly.dev`** `[^src5: code/app/tests/e2e/fixtures/sprint2-db.ts:77]`, ma il
   seed contiene **`lucia.verdi@turnly.dev`** `[^src5: code/app/db/seed.ts:202]` (utente
   diverso). L'utente `luca.verdi` non è seminato → il login "on-demand" non redirige a
   `/calendar` → timeout della fixture. Inoltre `db/seed.ts` **non semina alcuno
   `swap_operation`** né un secondo dipendente con turni per lo scambio. Il determinismo del
   seed richiesto dall'AC non è quindi garantito.
4. **`test.skip(true, …)` ancora pervasivi.** 21 occorrenze in `tests/e2e/sprint2/`, di cui
   **10 nel solo `employee-requests.spec.ts`** (es. `[^src5: code/app/tests/e2e/sprint2/employee-requests.spec.ts:102]`,
   `:150`, `:159`, `:171`, `:176`, `:184`, `:203`, `:274`, `:282`, `:287`, `:306`). I test più
   critici (T-REQ-03, T-SEC-08 — sicurezza) restano a **verde silenzioso** se manca il seed/
   endpoint. Contraddice l'AC "0 failed + fixture deterministiche / ogni test parte da stato DB
   pulito". Root cause (F-024-3) invariata → sintomo (F-024-2) invariato.

**Fix atteso iter-3**: eseguire/collegare un seed deterministico che includa il collega reale
e lo `swap_operation`, allineare l'email collega tra fixture e seed, estendere il `test` base,
e sostituire i `test.skip(true, …)` con fallimento sui prerequisiti mancanti + asserzione
diretta dell'AC. I finding "test insufficiente" restano di competenza **`qa-dev`** (CQRL segnala,
non scrive test).

---

## Stato dei finding residui (fuori scope round 1)

### F-021-1 · medium · design — ANCORA PRESENTE
`[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale]`

`useEmployeeCalendar.computeHours` calcola ancora lo straordinario come
`Math.max(0, totalHours − contractHoursPerWeek × rangeWeeks)` sull'intero range
`[^src5: code/app/hooks/useEmployeeCalendar.ts:105]`; `calculateOvertime` (RB-06, per settimana
ISO) **non è importato**. Il docstring dichiara "ore extra su contractHours settimanali"
`[^src5: code/app/hooks/useEmployeeCalendar.ts:15]` ma l'implementazione è media-sul-periodo →
lo straordinario resta sotto-riportato in vista mese. Confermato invariato (era esplicitamente
fuori scope dei fix di questo round).

### F-022-1 · medium · dead/broken code — PARZIALE (riparato ma ancora orfano)
`[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Rationale]`

Il file è stato **modificato** (mtime successivo al report iter-1) e i bug runtime segnalati
sono stati **corretti**: ora usa `requests.data.length`/`requests.data.map`
`[^src5: code/app/app/(employee)/requests/_components/RequestsListClient.tsx:76]`, il campo
`submittedAt` (non più `createdAt`) `[^src5: code/app/app/(employee)/requests/_components/RequestsListClient.tsx:100]`
e uno `STATUS_STYLES` allineato all'enum reale (`draft|sent|awaiting_colleague|approved|rejected|cancelled|applied`,
nessun `pending`). **Tuttavia il file resta orfano**: non è importato da alcun entry-point (la
pagina usa `MyRequestList`, `[^src5: code/app/app/(employee)/requests/page.tsx:45]`). Il finding
proponeva *eliminare* **oppure** *collegare* il componente: è stato fatto un terzo percorso
(riparare senza né rimuovere né wire-in) → il debito "dead code" **persiste**. Nota di processo:
è una modifica fuori dallo scope dichiarato dei fix (B6/B8) che ha consumato effort senza chiudere
il finding.

### F-022-3 · low · i18n — ANCORA PRESENTE
`[^rule: code_quality/rules/emergent/fe.i18n.pluralization.md §Rationale]`

`` `${total} richiesta${total !== 1 ? 'e' : ''}` `` → "2 richiestae"
`[^src5: code/app/components/employee/requests/MyRequestList.tsx:186]`. Confermato invariato
(era fuori scope).

## Altri finding iter-1 non oggetto dei fix (stato)

Rilevati incidentalmente durante la re-review; restano **aperti** (non erano nel set di fix):
- **F-023-2** (medium, design) — schema payload per-tipo ancora locali ai form
  (`swapPayloadSchema` `[^src5: code/app/components/employee/requests/new/RequestFormSwap.tsx:54]`,
  `modifyShiftPayloadSchema` `[^src5: code/app/components/employee/requests/new/RequestFormModifyShift.tsx:57]`),
  non estratti in `lib/zod/`.
- **F-023-3** (low, idiomaticità) — `useSearchParams()` in `new/page.tsx` senza `<Suspense>`
  `[^src5: code/app/app/(employee)/requests/new/page.tsx:160]`.
- **F-024-4** (low, idiomaticità) — `waitForLoadState('networkidle')` ancora presente
  `[^src5: code/app/tests/e2e/sprint2/employee-requests.spec.ts:312]`.
- F-021-2 (`initialData` cross-key), F-023-4 (doppi cast), F-024-5 (T-SEC-01 200 vs 403):
  non ri-verificati puntualmente in questo round (fuori dai fix dichiarati) → presunti invariati.

---

## Loop status (R.Q4)

- `review_iter`: **2** / `max_iterations` 3 → loop **non** esaurito (resta 1 iterazione).
- **Progresso**: SÌ. I due finding `high`/bloccanti dell'iter-1 (F-023-1 crash Radix, F-024-1
  test rotto) sono **risolti**. Il set di `rule_id` aperti è un **sottoinsieme** dell'iter-1
  → **no-progress NON scattato**.
- **Regression detection**: nessuna nuova regressione funzionale introdotta dai fix. La modifica
  fuori scope su `RequestsListClient.tsx` è benigna (migliora, non rompe). Il mismatch email
  collega (`luca.verdi` vs `lucia.verdi`) è una manifestazione della causa-radice F-024-3, non
  una regressione nuova.
- **Attenzione escalation (R.Q4)**: i finding **F-024-3 + F-024-2** (rule_id
  `general.doc-code-mismatch`, `qa.testing.hollow-acceptance`) sono ora **ripetuti per la 2ª
  iterazione consecutiva sul medesimo target**. Se ricompaiono invariati all'iter-3 → **trigger
  no-progress → escalation umana** (R.Q3 + §7 r.16). Priorità assoluta per il prossimo round.

## Prossimo step (feedback-router)

`task_package` per il dev-agent, ambito ristretto (no refactor opportunistico), `max_diff_lines`
per gruppo ≈ 80. Ordine di priorità iter-3:

1. **TSK-024 / F-024-3 + F-024-2** (REPEAT — priorità assoluta): seed deterministico reale
   (collega `luca.verdi` allineato al seed o viceversa; `swap_operation`; turni per entrambi),
   estendere il `test` base di `fixtures/index.ts`, rimuovere i `test.skip(true, …)` a favore di
   fallimento sui prerequisiti. **Coordinare con `qa-dev`** per la parte test.
2. **TSK-022 / F-022-1**: decisione secca — *eliminare* `RequestsListClient.tsx` oppure
   *collegarlo* al posto di/insieme a `MyRequestList`. Il "riparato-ma-orfano" non chiude il finding.
3. **TSK-022 / F-022-3**: `total === 1 ? 'richiesta' : 'richieste'` (one-liner).
4. **TSK-021 / F-021-1 (+ F-021-2)**: usare `calculateOvertime` (RB-06) per settimana ISO;
   legare `initialData` alla query key.
5. Rimanenti `low`/`medium` design (F-023-2 schema Zod condivisi, F-023-3 Suspense, F-024-4
   selettori fragili, F-024-5 allineamento 403).

> Le rule citate sono **bozze `emergent` `status: candidate`**: promozione a `active`/`canonical`
> è gate umano (§19.5).
