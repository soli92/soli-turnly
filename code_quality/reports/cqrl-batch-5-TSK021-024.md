# CQRL Batch 5 — Code Review TSK-021 → TSK-024

- **Reviewer**: code-reviewer (CQRL v2.12)
- **generated_at**: 2026-07-14
- **Scope**: employee pages (calendario, richieste, wizard nuova richiesta) + E2E acceptance Sprint 2
- **Passate**: idiomaticità · design · robustezza (accessibility delegata a EP-007 `a11y-specialist`, cfr. `ux_ui.delegate_a11y_to_ep007: true`)
- **Sicurezza**: fuori scope CQRL. Nessun secret in chiaro né CVE emersi durante la lettura → nessuna escalation `wiki/incidents/`.

## Stack rilevato

`typescript` · Next.js 15 App Router (RSC + client) · React · TailwindCSS v4 · shadcn/ui (Radix) ·
TanStack Query v5 · React Hook Form + Zod · date-fns v3 · React Big Calendar · Drizzle ORM · Playwright.
Fonte: `raw/tech_stack.md` (verbatim §11). Confidence ≥ `confidence_min (0.6)` → **modalità stack-aware piena**.

## Nota su ruleset (modalità degradata parziale)

`code_quality/rules/{canonical,team-specific,emergent}/` erano **vuote** (solo `.gitkeep`).
Per non violare l'invariante "mai inventare rule_id", ho creato **bozze `emergent/` con
`status: candidate`** (gate umano per l'attivazione, §19.5 — mai applicate nello stesso run).
Ogni finding cita una di queste bozze. Rule create:

| rule_id | severity | tema |
|---|---|---|
| `fe.react.radix-select-empty-value` | high | Radix `SelectItem value=""` |
| `qa.testing.testid-contract-drift` | high | selettori test vs contratto reale |
| `fe.domain.shared-rule-duplication` | medium | RB-06 / Zod ri-implementati lato FE |
| `fe.tanstack.initialdata-cross-key` | medium | `initialData` condivisa tra query key |
| `general.dead-broken-code` | medium | componente orfano e disallineato |
| `qa.testing.hollow-acceptance` | medium | test vacui / skip-guard pervasivo |
| `general.doc-code-mismatch` | low | docstring che dichiara comportamenti assenti |
| `qa.testing.brittle-selectors` | low | `waitForTimeout`/`networkidle`/classi utility |
| `fe.i18n.pluralization` | low | plurale italiano errato |
| `fe.next.usesearchparams-suspense` | low | `useSearchParams` senza `<Suspense>` |

---

## Verdetto complessivo

| TSK | Verdict | Blocking? | Priorità fix |
|---|---|---|---|
| TSK-021 Calendario | **conditional** | no | overtime divergente (design) + `initialData` (robustezza) |
| TSK-022 Le mie richieste | **conditional** | no | dead code + gap scambi-ricevuti in lista |
| TSK-023 Wizard nuova richiesta | **conditional** | sì (crash runtime) | `SelectItem value=""` (crash) |
| TSK-024 E2E acceptance | **conditional** | sì (test rotto/vacuo) | testid drift + test vacui |

Nessun verdict `reject`: i finding sono fixable in iterazione. `review_iter` proposto = 1 per
tutti (max_iterations = 3 → loop NON esaurito). Suggerimento `review_status: conditional` su
tutti e 4 i TSK.

---

## TSK-021 — Calendario dipendente (React Big Calendar + export .ics)

**Verdict: conditional.** Codice pulito e ben commentato; i18n RBC in italiano, a11y curata
(role/aria su eventi, toolbar, drawer). Due finding sostanziali (design + robustezza) e minori.

### [F-021-1 · medium · design] Straordinario ri-implementato inline, divergente da RB-06
`[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale]`

`hooks/useEmployeeCalendar.ts` → `computeHours()` calcola lo straordinario come
`max(0, totalHours − contractHoursPerWeek × rangeWeeks)` sull'INTERO range visualizzato
`[^src5: code/app/hooks/useEmployeeCalendar.ts:90]`. Ma:
1. La TSK prescrive esplicitamente l'uso di `calculateOvertime` (RB-06) da `lib/rules`
   (TSK-021 §HoursSummaryBar). La pure function esiste
   `[^src5: code/app/lib/rules/calculateOvertime.ts:23]` ma **non è usata**.
2. RB-06 calcola lo straordinario **per settimana ISO** (`startOfISOWeek`/`endOfISOWeek`),
   la FE lo calcola come **media sul periodo**. Su vista mese (range ~35–42 giorni)
   `contractHoursForPeriod = 40 × (giorni/7)`: le settimane sotto-40h compensano quelle
   sopra-40h → lo straordinario reale viene **sotto-riportato**. L'AC "40h/sett con 46h
   pianificate → 6h straordinario" regge solo in vista settimana.

**Fix**: usare `calculateOvertime` per settimana ISO, sommando l'overtime per-settimana sul
periodo visualizzato (clamp a 0 per singola settimana). Rimuovere il calcolo duplicato.

### [F-021-2 · medium · robustezza] `initialData` applicata a tutte le query key (dati stale su navigazione)
`[^rule: code_quality/rules/emergent/fe.tanstack.initialdata-cross-key.md §Rationale]`

`EmployeeCalendar.tsx` memoizza `queryOptions = { initialData: initialShifts }` con deps `[]`
e `// eslint-disable-line react-hooks/exhaustive-deps` `[^src5: code/app/components/employee/calendar/EmployeeCalendar.tsx:141]`,
poi le passa a `useEmployeeCalendar` che le spread in `useQuery` `[^src5: code/app/hooks/useEmployeeCalendar.ts:130]`.
Con `staleTime: 60_000` e senza `initialDataUpdatedAt`, navigando a un altro mese la **nuova
query key** viene seminata con i turni del mese iniziale e considerata fresca → mostra dati del
mese sbagliato fino allo scadere dello staleTime. L'`eslint-disable` maschera proprio questo.

**Fix**: fornire `initialData` solo quando `from/to` coincidono col range server-side (es.
condizione sul range del mese corrente), oppure usare `queryClient.setQueryData(byRange(...), initialShifts)`
in hydration.

### [F-021-3 · low · robustezza] Export .ics: parametri `from`/`to` non validati
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]`

`api/users/me/shifts/export/route.ts` accetta `from`/`to` grezzi e li passa a `gte/lte`
senza validare il formato `YYYY-MM-DD` `[^src5: code/app/app/api/users/me/shifts/export/route.ts:31]`.
Un valore malformato produce un filtro SQL indefinito. `T-SEC-01` è invece **corretto** (userId
sempre dal token, nessun IDOR). **Fix**: validare con uno schema Zod (riusabile) e rispondere 400.

### [F-021-4 · low · a11y — DELEGATO EP-007] "focus trap" dichiarato ma non implementato
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]`

`ShiftDetailDrawer.tsx` docstring dichiara "Focus trap" ma implementa solo il focus iniziale
sul bottone chiudi (`setTimeout(..., 50)`), senza contenimento del Tab
`[^src5: code/app/components/employee/calendar/ShiftDetailDrawer.tsx:44]`. Segnalato come
contesto per `a11y-specialist` (dominio a11y delegato). Considerare il primitivo `Dialog`
shadcn/Radix che fornisce focus-trap by-design.

---

## TSK-022 — Le mie richieste (lista + accetta/rifiuta scambio)

**Verdict: conditional.** Lista, filtri, card, timeline, cancel e pannello scambio ben fatti;
`T-SEC-08` correttamente verificato client-side in `SwapAcceptRejectPanel`
(`payload.targetUserId === session.user.id`) `[^src5: code/app/components/employee/requests/SwapAcceptRejectPanel.tsx:119]`.

### [F-022-1 · medium · design] `RequestsListClient.tsx` è codice orfano e rotto
`[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Rationale]`

`app/(employee)/requests/_components/RequestsListClient.tsx` non è importato da nessun
entry-point (la pagina usa `MyRequestList`). Inoltre è disallineato al modello corrente:
- destruttura `{ data: requests }` da `useRequests()` e chiama `requests.length` / `requests.map`,
  ma l'hook ritorna `RequestListResponse = { data, total, page, limit }` (oggetto, non array)
  `[^src5: code/app/hooks/useRequests.ts:158]` → `map` su undefined a runtime;
- usa `request.createdAt` (campo inesistente in `RequestRow`, che ha `submittedAt`) e status
  `pending` (non nell'enum `draft|sent|awaiting_colleague|approved|rejected|cancelled|applied`)
  `[^src5: code/app/app/(employee)/requests/_components/RequestsListClient.tsx:42]`.

**Fix**: eliminare il file (o riallinearlo se destinato a sostituire `MyRequestList`).

### [F-022-2 · medium · design] Scambi ricevuti assenti dalla LISTA (RF-M CA6 solo parziale)
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]`

`MyRequestList` mostra un banner-placeholder "GAP-TSK022-002" al posto di `SwapReceivedCard`
`[^src5: code/app/components/employee/requests/MyRequestList.tsx:204]`. Il flusso accetta/rifiuta
esiste ma solo sulla pagina di dettaglio `[id]` (`RequestDetailClient` monta `SwapAcceptRejectPanel`)
`[^src5: code/app/app/(employee)/requests/[id]/_components/RequestDetailClient.tsx:276]`.
Gli AC RF-M CA6 / T-SEC-08 sono quindi soddisfatti **nel dettaglio** ma non nella lista come da
spec (`GET /api/requests?received_swap=true`). È un gap funzionale documentato → il completamento
(o l'esplicito descoping del criterio) va tracciato con `qa-dev`/gaps. Degradation accettabile,
ma l'AC di lista non è verde.

### [F-022-3 · low · idiomaticità] Plurale italiano errato ("richiestae")
`[^rule: code_quality/rules/emergent/fe.i18n.pluralization.md §Rationale]`

`` `${total} richiesta${total !== 1 ? 'e' : ''}` `` → "2 richiestae"
`[^src5: code/app/components/employee/requests/MyRequestList.tsx:199]`. **Fix**:
`total === 1 ? 'richiesta' : 'richieste'`.

---

## TSK-023 — Wizard nuova richiesta (4 tipi)

**Verdict: conditional — contiene un crash a runtime.** Wizard, stepper, focus management,
mapping errori Zod BE→step2, preview RB-10 ottimistico: tutto ben strutturato. Ma:

### [F-023-1 · high · robustezza] `SelectItem value=""` → crash Radix all'apertura del select
`[^rule: code_quality/rules/emergent/fe.react.radix-select-empty-value.md §Rationale]`

Quattro occorrenze; Radix Select vieta il value vuoto e lancia
"A `<Select.Item />` must have a value prop that is not an empty string" al mount del content:
- `RequestFormModifyShift.tsx:391` → `<SelectItem value="">Nessun cambio</SelectItem>` — **opzione
  selezionabile e trigger NON disabilitato** → crash certo appena si apre "Nuova tipologia"
  `[^src5: code/app/components/employee/requests/new/RequestFormModifyShift.tsx:391]`;
- `RequestFormSwap.tsx:222` → item vuoto quando il dipendente non ha turni futuri (trigger non
  disabilitato) → crash all'apertura `[^src5: code/app/components/employee/requests/new/RequestFormSwap.tsx:222]`;
- `ColleagueTurnPicker.tsx:126` e `RequestFormModifyShift.tsx:273` → item vuoto `disabled` (trigger
  disabilitato → in pratica non si apre, ma resta anti-pattern fragile)
  `[^src5: code/app/components/employee/requests/new/ColleagueTurnPicker.tsx:126]`.

**Fix**: usare valore sentinella non vuoto (es. `"__none__"`, normalizzato a `undefined` al submit)
per l'opzione "Nessun cambio"; per gli stati vuoti non renderizzare `SelectItem`, usare solo il
placeholder + messaggio esterno o trigger disabilitato.

### [F-023-2 · medium · design] Schema payload per-tipo duplicati lato FE (parità T-INT-01 a rischio)
`[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale]`

Ogni form definisce il proprio schema locale (`absencePayloadSchema`, `swapPayloadSchema`,
`newShiftPayloadSchema`, `modifyShiftPayloadSchema`) `[^src5: code/app/components/employee/requests/new/RequestFormAbsence.tsx:86]`.
Il `requestCreateSchema` condiviso tratta il payload come opaco (`z.record(z.unknown())`,
"struttura interna validata in TSK-006") `[^src5: code/app/lib/zod/index.ts:129]`. Quindi la
struttura interna del payload NON ha una single source of truth condivisa FE↔BE: le regole del
payload possono divergere silenziosamente dal validatore BE. Contraddice l'intento T-INT-01 dello
stack. **Fix**: estrarre gli schema per-tipo del payload in `lib/zod/` e riusarli sia nei form sia
nel Route Handler (TSK-006).

### [F-023-3 · low · idiomaticità] `useSearchParams` senza confine `<Suspense>`
`[^rule: code_quality/rules/emergent/fe.next.usesearchparams-suspense.md §Rationale]`

`new/page.tsx` è `'use client'` e chiama `useSearchParams()` senza `<Suspense>` a monte
`[^src5: code/app/app/(employee)/requests/new/page.tsx:161]` → warning/errore in build statica
Next 15. **Fix**: isolare la lettura params in un sotto-componente avvolto in `<Suspense>`.

### [F-023-4 · low · idiomaticità] Doppio cast `as unknown as X` nel riepilogo
`[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale]`

`RequestReviewStep.buildRows` fa `payload as unknown as AbsencePayload` ecc.
`[^src5: code/app/components/employee/requests/new/RequestReviewStep.tsx:126]`. Il doppio cast
elude il type-checker. Con gli schema payload centralizzati (F-023-2) si può fare parsing/narrowing
tipizzato invece del cast. Correlato: `RequestDetailClient.flattenPayload` usa `String(value)` →
`"[object Object]"` per payload annidati `[^src5: code/app/app/(employee)/requests/[id]/_components/RequestDetailClient.tsx:88]`.

---

## TSK-024 — E2E acceptance Sprint 2 (Playwright)

**Verdict: conditional — la suite non tutela realmente gli AC.** Buona copertura di scenari e
uso corretto delle fixture autenticate multi-ruolo. Ma un test è rotto e diversi sono vacui, il
che confligge con l'AC "0 failed + fixture deterministiche".

### [F-024-1 · high · robustezza/qa] Test RF-M CA5 usa un testid inesistente e salta uno step
`[^rule: code_quality/rules/emergent/qa.testing.testid-contract-drift.md §Rationale]`

`employee-requests.spec.ts` (RF-M CA5) clicca `getByTestId('submit-btn')`
`[^src5: code/app/tests/e2e/sprint2/employee-requests.spec.ts:64]`, ma il wizard usa
`data-testid="confirm-submit-btn"` `[^src5: code/app/components/employee/requests/new/RequestReviewStep.tsx:262]`
(`submit-btn` esiste solo nel form legacy `components/requests/RequestForm.tsx:579`). Inoltre il
test non clicca "Avanti" step2→step3 (`absence-form-next-btn` non è mai referenziato) → non
raggiunge nemmeno lo step di conferma. Esito: **il test fallisce in CI** → viola l'AC "0 failed".
**Fix**: percorrere step 2 → step 3 e usare `confirm-submit-btn`.

### [F-024-2 · medium · design/qa] Test vacui e skip-guard pervasivi
`[^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Rationale]`

- `coverage.spec.ts` T-DOM-07: se non trova celle sotto-coperta fa asserzione debole e `return`
  → passa anche senza verificare il deficit (il cuore dell'AC)
  `[^src5: code/app/tests/e2e/sprint2/coverage.spec.ts:123]`.
- `employee-requests.spec.ts` T-REQ-03 / T-SEC-08 (i più critici, sicurezza) sono costellati di
  `test.skip(true, ...)` su seed/endpoint mancanti `[^src5: code/app/tests/e2e/sprint2/employee-requests.spec.ts:167]`
  → verde silenzioso se il seed non c'è. Stesso pattern in `dashboard.spec.ts` RF-K CA2.

Contraddice l'AC "ogni test parte da stato DB pulito" (prerequisiti deterministici). **Fix**:
garantire il seed nella fixture (v. F-024-3) e far FALLIRE il test sui prerequisiti mancanti;
asserire direttamente la condizione dell'AC.

### [F-024-3 · medium · design] `sprint2-db.ts` dichiara un seed che non esegue + duplica le fixture base
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]`

L'header di `fixtures/sprint2-db.ts` dichiara "Seed Sprint 2: 3 coverage_requirements, 2
availability, 1 swap_operation" ma il file **non esegue alcun seeding** — definisce solo
`adminPage`/`employeePage`/`colleaguePage` `[^src5: code/app/tests/e2e/fixtures/sprint2-db.ts:8]`.
Inoltre ri-dichiara `adminPage`/`employeePage` già presenti in `fixtures/index.ts`
`[^src5: code/app/tests/e2e/fixtures/index.ts:27]` invece di estenderne il `test` (violazione DRY).
Questo è la causa-radice dei test vacui (F-024-2): il determinismo del seed non è garantito da
nessuna parte del percorso di test. **Fix**: implementare il seed dichiarato (o puntare al modulo
che lo esegue) ed estendere il `test` base invece di duplicarlo.

### [F-024-4 · low · idiomaticità] Anti-pattern Playwright: waitForTimeout / networkidle / selettori-classe
`[^rule: code_quality/rules/emergent/qa.testing.brittle-selectors.md §Rationale]`

- `waitForTimeout(1_000/500)` `[^src5: code/app/tests/e2e/sprint2/employee-calendar.spec.ts:113]`,
  `[^src5: code/app/tests/e2e/sprint2/coverage.spec.ts:163]`.
- `waitForLoadState('networkidle')` `[^src5: code/app/tests/e2e/sprint2/employee-requests.spec.ts:301]`.
- Locator su classi utility: `inboxBadge.locator('p.text-3xl')`
  `[^src5: code/app/tests/e2e/sprint2/dashboard.spec.ts:61]`,
  `[^src5: code/app/tests/e2e/sprint2/coverage.spec.ts:158]`.

**Fix**: web-first assertion + `data-testid` stabili (es. `kpi-inbox-count`) al posto delle classi.

### [F-024-5 · low · design/qa] T-SEC-01: il test verifica 200+filtro, la spec/AC diceva 403
`[^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Rationale]`

`employee-calendar.spec.ts` T-SEC-01 verifica che `GET /api/shifts?userId=<admin>` risponda 200
con zero turni admin `[^src5: code/app/tests/e2e/sprint2/employee-calendar.spec.ts:152]`, mentre
lo scenario in TSK-024 (e TSK-021 AC) prescriveva `403`. Il silent-filter è una postura di
sicurezza valida, ma è una deviazione dalla spec: allineare spec e test (e verificare che il
BE non esponga `userId` altrui) per evitare ambiguità sul contratto atteso.

---

## Loop status

- `review_iter` corrente: **1** / `max_iterations` 3 → loop **non** esaurito.
- No-progress detection: N/A (prima iterazione, nessun report precedente per questi TSK).
- Regression detection: N/A (baseline assente).

## Prossimo step (feedback-router)

`task_package` consigliato per il dev-agent, ambito ristretto (no refactor opportunistico),
`max_diff_lines` per gruppo ≈ 80. Ordine per severità:

1. **TSK-023 / F-023-1** (crash Radix) — priorità assoluta, blocca l'uso del form modifica/scambio.
2. **TSK-024 / F-024-1 + F-024-3** — riparare il test RF-M CA5 e rendere deterministico il seed
   della fixture, così la suite torna significativa prima di rieseguire gli altri.
3. **TSK-021 / F-021-1 + F-021-2** — usare RB-06 per settimana ISO; legare `initialData` alla key.
4. **TSK-022 / F-022-1 + F-022-3** — rimuovere il file orfano; correggere il plurale.
5. Rimanenti finding `low`/`medium` di design (schema Zod condivisi, Suspense, seed doc-mismatch).

I finding "test mancante/insufficiente" (F-024-*) sono di competenza `qa-dev` per la stesura/
riparazione dei test: CQRL li segnala, non scrive test. I gap funzionali (F-022-2) vanno tracciati
in `wiki/gaps.md` / con `qa-dev`, non risolti dal reviewer.

> Le rule citate sono **bozze `emergent` `status: candidate`**: la promozione a `active`/`canonical`
> è gate umano (§19.5). Rivedere `code_quality/rules/emergent/` prima del prossimo run.
