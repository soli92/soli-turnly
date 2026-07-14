# CQRL Code Review — Batch 3 · ITER 3 (FINALE) (TSK-011 → TSK-016)

- **reviewer_version:** cqrl-v2.12
- **generated_at:** 2026-07-14
- **iter:** 3 / max_iterations 3 — **ULTIMA ITERAZIONE** (loop non prolungabile, R.Q4)
- **prev_report:** `code_quality/reports/cqrl-r2-batch-3-TSK010-016.md` (iter 2)
  - *nota:* il path citato nel dispatch (`cqrl-r2-batch-3-TSK011-016.md`) non esiste; la baseline
    iter-2 reale copre TSK-010→016. TSK-010 è fuori dallo scope di questo round (E2E, `qa-dev`).
- **passes:** idiomaticity, design, robustness (+ accessibility, config-active)
- **stack_descriptor:** `typescript@5 / next@15 (app-router, rsc) / drizzle-orm+postgres@16 /
  tanstack-{query,table} / react-hook-form+zod@^3 / drizzle-kit@0.31.10 / playwright + axe-core /
  vitest` — confidence **alta** (> `confidence_min` 0.6), review **stack-aware** completa.

## Metodo iter-3

I tre gate di qualità (`tsc --noEmit`, `next lint`, `prettier --check .`) sono stati **rieseguiti
realmente** nel workspace `code/app/`. Ogni fix dichiarato (TSK-013 journal, TSK-015 in-use route,
TSK-016 ARIA+`any`+campi, TSK-014 timeout) è stato verificato leggendo il codice corrente e
confrontandolo con il report iter-2. Le regressioni di gate sono state cross-referenziate con il log
dev (`wiki/log.md`) e con il report gemello `cqrl-r3-batch-1-TSK001-005.md`.

## Nota di degradazione (ruleset)

`code_quality/rules/canonical` e `team-specific` restano **vuote**; `emergent/` contiene 10 bozze
`status: candidate`. La review gira in **modalità degradata evolutiva**: i `rule_id` sono citati come
convenzione candidate (promozione = gate umano §19.5). Nessuna regola inventata come attiva.

---

## Esito gate di qualità workspace-wide (era il deliverable di TSK-012)

| Gate | iter-2 | **iter-3** | Δ | Esito |
|---|---|---|---|---|
| `tsc --noEmit` | exit 0 · 0 err | **exit 1 · 5 err** | ↓↓ | **REGREDITO** |
| `next lint` | exit 0 · 0 err (N warn) | **exit 1 · 1 err + 8 warn** | ↓ | **REGREDITO** |
| `prettier --check .` | exit 0 · 0 file | **exit 1 · 19 file** | ↓ | **REGREDITO** |

> **Il gate di qualità è ROSSO su tutte e tre le porte all'iterazione finale.** Vedi «Regression
> detection» per l'attribuzione: i breaker `tsc`/`lint` sono **esterni al batch 011-016** (TSK-007
> `ApprovalPanel.tsx`, owner sprint3), già escalati dal review batch-1 iter-3; la quota
> attribuibile a questo batch è **solo `prettier`** (StaffModal + snapshot).

### tsc — 5 errori (tutti in file NON toccati da questo batch)

```
components/requests/ApprovalPanel.tsx(48,3)   TS2353  'pending' non esiste in Record<RequestStatus, string>
components/requests/ApprovalPanel.tsx(87,21)  TS2367  confronto RequestStatus vs '"pending"' senza overlap
components/requests/ApprovalPanel.tsx(127,16) TS2367  idem
components/requests/ApprovalPanel.tsx(144,29) TS2339  'createdAt' non esiste su RequestRow
tests/visual/sprint3/reports-overtime.spec.ts(40,110) TS2345  callback rAF non assegnabile
```

Root-cause: **drift di contratto sul tipo condiviso**. `hooks/useRequests.ts:25-26` definisce ora
`RequestStatus = 'draft'|'sent'|'awaiting_colleague'|'approved'|'rejected'|'cancelled'|'applied'`
(**niente `'pending'`**) e `RequestRow` espone `submittedAt` (**niente `createdAt`**, l.36).
`ApprovalPanel.tsx` (consumer di TSK-007) referenzia ancora `'pending'` (l.48/87/127) e `createdAt`
(l.144). `ApprovalPanel.tsx` è **file committato e non modificato** da questo batch → l'errore è
comparso perché il tipo sorgente è evoluto senza aggiornare il consumer.
`[^src5: code/app/components/requests/ApprovalPanel.tsx:87]`
`[^rule: emergent/general.dead-broken-code.md §Rationale]` (candidate; pattern
`general.shared-type-contract-drift` da bozzare)

### next lint — 1 ERROR + 8 warning

- **ERROR** `@typescript-eslint/no-misused-promises` — `ApprovalPanel.tsx:228` (`onSubmit` con
  handler Promise-returning senza `void`). File **fuori batch** (TSK-007).
  `[^src5: code/app/components/requests/ApprovalPanel.tsx:228]`
- Warning (non-bloccanti, pre-esistenti + nuovi): `react-hooks/exhaustive-deps` in
  `StaffPageClient.tsx:45` e `ShiftGrid.tsx:180`; `no-console` in `lib/toast.ts:15/21`;
  `jsx-a11y/role-supports-aria-props` in `ShiftCell.tsx:73/88` (vedi TSK-016).

### prettier — 19 file (quota batch: StaffModal + 3 snapshot)

File di **questo batch** non formattati: `components/staff/StaffModal.tsx` (fix TSK-016),
`db/migrations/meta/0000_snapshot.json`, `0001_snapshot.json`, `0002_snapshot.json` (fix TSK-013).
Gli altri 15 sono fuori batch (ApprovalPanel, recurrence, globals.css, spec e2e/a11y/visual).
**Hygiene miss:** i fix iter-3 non hanno eseguito `prettier --write` prima del commit.

---

## Sintesi verdetti iter-3 (FINALE)

| TSK | Area | iter-2 | **iter-3** | Δ | Blocking aperti |
|---|---|---|---|---|---|
| TSK-011 | A11y WCAG 2.2 AA | conditional | **pass** (accept-as-debt) | ↑ | 0 |
| TSK-012 | Code Quality Gate | pass | **conditional** (REGRESSIONE) | ↓ | gate rosso (esterno + prettier) |
| TSK-013 | DB migration | conditional | **pass** | ↑ | 0 (residuo `generate`) |
| TSK-014 | Dashboard Admin | conditional | **pass** | ↑ | 0 |
| TSK-015 | Tipologie turno | conditional | **pass** | ↑ | 0 |
| TSK-016 | Anagrafica dipendenti | conditional | **pass** | ↑ | 0 |

> **5 TSK su 6 chiusi a `pass`** (blocking risolti). **TSK-012 è l'unico non certificabile**: la sua
> certificazione `pass` di iter-2 è **revocata** perché il gate workspace è rosso all'iterazione
> finale. Nessun `pass` è un auto-close/merge — è advisory per l'orchestrator (R.Q3).
> **Nessun forced-reject §19.4**: nessun TSK ripresenta un blocking *identico* a iter-2 non
> giustificato (tutti risolti, o accept-as-debt documentato).

---

## TSK-011 — A11y WCAG 2.2 AA → **`pass`** (accept-as-debt)

**F-011-01 · MEDIUM · ACCETTATO A DEBITO (decisione umana).** Il gate a11y usa
`includedImpacts: ['critical']`: soglia allineata verbatim a `factory.config.yaml` →
`a11y.severity_threshold: critical` + `a11y.fail_ci_on: critical`. La divergenza segnalata a iter-2
(gate più permissivo dell'AC «serious+critical») è **coerente con la config di factory attiva**: la
giustificazione ACCEPT-AS-DEBT è valida e documentata → **no forced-reject**. Debito tracciato per
`a11y-specialist` (eventuale innalzamento a `serious` è decisione di policy, non di review).
`[^src5: code/app/tests/a11y/sprint2/a11y-sprint2.spec.ts:67]`
`[^rule: emergent/a11y.gate.consistent-severity-threshold.md §Rationale]` (candidate, non ancora bozzata)

Residui non-bloccanti (invariati da iter-2, `qa.*`/`a11y.*`, fuori scope CQRL): F-011-02 (AC
tastiera/nav), F-011-03 (`expect` inutilizzato), F-011-04 (`networkidle`). I file spec a11y
(`a11y-sprint2/3.spec.ts`) risultano non formattati → confluiscono nel gate `prettier` (TSK-012).

---

## TSK-012 — Code Quality Gate → **`conditional`** (REGRESSIONE — certificazione `pass` revocata)

Il deliverable di configurazione del gate è **intatto**: `eslint.config.mjs`
(`parserOptions.project` + `tsconfigRootDir`), `vitest.config.ts` (include/exclude/coverage),
`tsconfig.json` (strictness) sono invariati e corretti. **Ma il gate workspace è ROSSO su 3/3 porte**
(vedi sopra), quindi l'AC «0 errori» non è soddisfatta all'iterazione finale e la certificazione
`pass` di iter-2 **non regge**.

Attribuzione della regressione (R.Q4-ter — nuovi finding in file non toccati dal fix):

1. **`tsc` (5) + `lint` (1 err) → ESTERNI a questo batch.** Root-cause in `ApprovalPanel.tsx`
   (**TSK-007**, drift `RequestStatus 'pending'`/`RequestRow.createdAt`) e
   `tests/visual/sprint3/reports-overtime.spec.ts` (**owner sprint3**). **Già escalati** dal review
   batch-1 iter-3 (`wiki/log.md`, entry «ESCALATION FUORI BATCH»). **Non ri-assegnare a 011-016**:
   il fix va instradato a TSK-007 (aggiornare il consumer al nuovo enum) + owner sprint3 (rAF).
2. **`prettier` (quota batch) → attribuibile a questo batch.** `StaffModal.tsx` + i 3 snapshot
   `meta/*.json` non formattati. Fix banale (`prettier --write`), ma necessario per riportare il
   gate a verde.

Poiché **non** è un finding identico non risolto (i F-012-01/02/03 di iter-1 restano risolti) e la
causa primaria è esterna + già escalata, **non si applica il forced-reject**. Verdetto
`conditional` con marker **`regression`**: il gate non può essere certificato finché (a) TSK-007 +
sprint3 non chiudono i breaker `tsc`/`lint` e (b) questo batch non esegue `prettier --write`.
Decisione finale = **gate umano** (R.Q3): il merge del batch resta **bloccato** fino a gate verde.
`[^src5: code/app/eslint.config.mjs:18]`
`[^rule: emergent/general.dead-broken-code.md §Rationale]` (candidate)

---

## TSK-013 — DB migration → **`pass`** (F-013-02 blocking risolto; residuo su `generate`)

**F-013-02 · era MEDIUM (blocking) · RISOLTO ✓ per il path `migrate`.** `meta/_journal.json` ora
esiste con **4 entry** (idx 0-3, dialect postgresql, version 7) e tag allineati ai 4 file SQL
(`0001_initial_schema`, `0002_exclude_gist`, `0003_availability_coverage_swap`,
`0004_users_phone_contract_type`). Tutti i `.sql` referenziati esistono → `drizzle-kit migrate`
(che legge journal + `${tag}.sql`, **non** gli snapshot) è ora applicabile. Il blocking di iter-2
(«senza journal migrate non applica nulla») è chiuso. Finding **materialmente diverso** da iter-2 →
no forced-reject.
`[^src5: code/app/db/migrations/meta/_journal.json:1]`

### F-013-04 · MEDIUM · design — **NUOVO (residuo, non-blocking)** — snapshot `0003` mancante → `generate` incoerente
Il log dev conferma che `drizzle-kit` generò 3 entry + 3 snapshot (`0000/0001/0002`) per idx 0-2;
la **4ª entry (`0004`) è stata appesa a mano** al journal (per il migration phone/contractType di
TSK-016) **senza generare `0003_snapshot.json`**. Effetti:
- `migrate`: OK (non usa snapshot).
- `generate`: lo snapshot più recente disponibile è `0002` ma `schema.ts` ora contiene
  `phone`/`contractType` → il prossimo `drizzle-kit generate` rileva drift e/o fallisce sul
  disallineamento journal(idx 3)↔snapshot(max 0002). L'AC «`drizzle-kit generate`» resta fragile.
Non-blocking (il path applicativo `migrate` funziona), ma da chiudere: rigenerare lo snapshot con
`drizzle-kit generate` dopo aver aggiunto phone/contractType allo schema (produce `0004_*` coerente).
`[^src5: code/app/db/migrations/meta/0002_snapshot.json:1]`
`[^rule: emergent/general.dead-broken-code.md §Rationale]` (candidate)

Residuo: i 3 snapshot non sono prettier-formattati (→ gate TSK-012).

---

## TSK-014 — Dashboard Admin → **`pass`** (F-014-01 RISOLTO, oltre l'accept-as-debt atteso)

Il dispatch lo indicava come ACCEPT-AS-DEBT, ma il codice è stato **realmente corretto**.
`KpiCard.tsx:107-113` implementa ora un vero **`AbortController`** con timeout 5s
(`setTimeout(() => controller.abort(), 5_000)`), collega il `signal` di TanStack Query all'abort e
pulisce il timeout in `finally`. Il doc-comment (l.108-109) è **corretto**: distingue esplicitamente
`staleTime` (cache) dalla cancellazione della richiesta. L'AC «Timeout > 5s → stato errore» è ora
soddisfatta. F-014-01 **RISOLTO**.
`[^src5: code/app/components/dashboard/KpiCard.tsx:110]`

Residuo non-blocking invariato: F-014-02 (LOW, fetch turni sprecata quando coverage=501).

---

## TSK-015 — Tipologie turno → **`pass`** (F-015-01 RISOLTO)

**F-015-01 · era HIGH (blocking) · RISOLTO ✓.** Il branch morto è ora vivo:
- Nuovo endpoint `app/api/admin/shift-types/in-use/route.ts` — GET **admin-only** (`auth()` →
  `unauthorized`/`forbidden`), `selectDistinct(shiftTypeId).where(isNotNull(...))`, restituisce un
  `Record<string, boolean>` **grezzo** via `ApiResponse.ok` (che è `Response.json(data)` **senza
  envelope** → `res.json()` lato client ottiene la mappa pulita, nessun mismatch di forma).
- `ShiftTypesClient.tsx:22-29` fetcha la mappa con `useQuery(['shift-types','in-use'])` e la passa a
  `<ShiftTypeTable inUseMap={inUseMap ?? {}} />` (l.42).
- `ShiftTypeTable.tsx:205/229` legge `inUseMap[row.original.id]` → colonna «In uso» e azione
  «Disattiva» (inUse=true) vs «Elimina» (inUse=false) ora **realmente pilotate dai dati**. RF-C CA2
  attivo. `useMemo(..., [inUseMap])` (l.269) rigenera le colonne al cambio mappa.
`[^src5: code/app/app/admin/shift-types/_components/ShiftTypesClient.tsx:22]`

Residui non-bloccanti (invariati da iter-2, debito quality — **non** forced-reject perché
non-blocking):
- **F-015-02 · MEDIUM** — copy DELETE contraddittoria: titolo «Eliminare "X"?» (l.426) ma corpo «la
  tipologia verrà **disattivata** … annullabile riattivando via Modifica» (l.429-431), mentre
  l'handler chiama `deleteMutation` (l.440). Da uniformare (o titolo o comportamento).
  `[^src5: code/app/components/shift-types/ShiftTypeTable.tsx:426]`
  `[^rule: emergent/general.doc-code-mismatch.md §Rationale]` (candidate)
- **F-015-03 · MEDIUM** — logica durata (`parseHHMM`/`calcDurationMinutes`/`formatDuration`)
  duplicata rispetto a `lib/rules/calculateShiftDuration` (RB-12 single-source).
  `[^src5: code/app/components/shift-types/ShiftTypeTable.tsx:60]`
  `[^rule: emergent/fe.domain.shared-rule-duplication.md §Rationale]` (candidate)

> Nota UX (opzionale): la mappa `in-use` e la lista tipologie usano query-key separate; una
> disattivazione non invalida `['shift-types','in-use']`. Non-blocking, ma un `invalidateQueries`
> sulla mutation renderebbe il badge reattivo.

---

## TSK-016 — Anagrafica dipendenti → **`pass`** (F-016-01 + F-016-02 RISOLTI; residuo a11y ShiftCell)

**F-016-01 · era MEDIUM/HIGH · RISOLTO ✓ — `any` eliminato.** `StaffModal.tsx` ha ora **0**
occorrenze di `any` e **0** `eslint-disable no-explicit-any` (verificato via grep). La type-safety è
recuperata con: union tipata `StaffFormUnion = UseFormReturn<AdminUserCreateInput> |
UseFormReturn<AdminUserPatchInput>` (l.99-101), `resolver … as Resolver<AdminUserCreateInput>`
(cast tipato, non `any`, l.121) e **un singolo** cast documentato
`const ctrl = form.control as unknown as Control<AdminUserCreateInput>` (l.263) che evita di
duplicare l'intero render-tree per istanza di form. Miglioramento sostanziale e idiomatico.
`[^src5: code/app/components/staff/StaffModal.tsx:263]`

**F-016-02 · era MEDIUM · RISOLTO ✓ — campi `phone` e `contractType` presenti.** Aggiunti il campo
telefono (`Input type="tel"`, l.337-356) e tipo contratto (`Select` enum
`full_time`/`part_time`/`contractor`, l.414-436). Backed da schema Zod
(`adminUserCreateSchema.phone`/`.contractType`, `lib/zod/index.ts:204-205`), da `db/schema.ts:110-111`
e dalla migration `0004_users_phone_contract_type.sql`. `tsc` sui file StaffModal/zod: 0 errori.
Gap G-004/G-005 chiusi.
`[^src5: code/app/components/staff/StaffModal.tsx:414]`

**ARIA — parziale:**
- `RequestQueue.tsx` — **CORRETTO ✓**: `aria-sort` ora su `<th role="columnheader" scope="col">`
  (l.300-314), ruolo che supporta `aria-sort`. Il warning iter-2 (`aria-sort` su `role="button"`) è
  risolto. `[^src5: code/app/components/requests/RequestQueue.tsx:305]`
- `ShiftCell.tsx` — **NON risolto (residuo non-blocking)**: `aria-disabled` è stato sostituito con
  `aria-readonly` su `role="cell"` (l.76, l.91), ma `next lint` conferma che **anche `aria-readonly`
  non è supportato dal ruolo `cell`** (2× `jsx-a11y/role-supports-aria-props`). Il fix ha scambiato
  un attributo non supportato con un altro non supportato. Correzione corretta: usare
  `role="gridcell"` (che supporta `aria-readonly`) coerentemente con la struttura griglia, o rimuovere
  l'attributo. Non-blocking → `a11y-specialist`.
  `[^src5: code/app/components/matrix/ShiftCell.tsx:76]`
  `[^rule: emergent/a11y.role-supports-aria-props.md §Rationale]` (candidate, non ancora bozzata)

Residuo: `StaffModal.tsx` non prettier-formattato (→ gate TSK-012). F-016-03 (LOW, entrambe le
`useForm` sempre istanziate) invariato, non-blocking.

---

## Regression detection (R.Q4-ter) — headline del round

- **Regressione di gate RILEVATA** e attribuita:
  - `tsc` (5) + `lint` (1 err): **file esterni al batch** (`ApprovalPanel.tsx` = TSK-007;
    `reports-overtime.spec.ts` = sprint3). **Già escalati** dal review batch-1 iter-3. Non ri-ownati
    qui; solo cross-reference.
  - `prettier` (quota batch): `StaffModal.tsx` + 3 snapshot `meta/*.json` → hygiene miss dei fix di
    questo batch, fixabile in un comando.
- **Nessuna regressione logica** introdotta dai fix 011-016: i loro file sono `tsc`-clean e
  `lint`-clean (0 errori sui file toccati). Le fix hanno **chiuso** blocking senza romperne altri.
- **No-progress detection:** nessun TSK ripresenta un blocking *identico* a iter-2 non risolto:
  F-011-01 (accept-as-debt giustificato), F-013-02 (materialmente cambiato → risolto per migrate),
  F-014-01/F-015-01/F-016-01/F-016-02 (risolti). → **nessun forced-reject** su alcun TSK.

---

## Loop status (iter 3 / 3 — FINALE)

- **max_iterations raggiunto:** loop chiuso, non prolungabile (R.Q4).
- **Esito batch:** 5/6 `pass`. TSK-012 `conditional` con marker `regression`: la sua AC (gate verde)
  non è soddisfatta all'iterazione finale, ma **non è forced-reject** (nessun finding identico
  irrisolto; causa primaria esterna + già escalata).
- **Merge del batch:** **BLOCCATO** finché il gate workspace non torna verde (dipende da attori
  fuori batch + `prettier --write` locale). Decisione = **gate umano** (R.Q3).

## Prossimo step consigliato (task_package / escalation)

1. **[fuori batch — cross-ref, non ri-assegnare qui]** TSK-007: aggiornare `ApprovalPanel.tsx` al
   nuovo `RequestStatus` (rimuovere `'pending'`, usare `'sent'`/stati validi) e `submittedAt` al posto
   di `createdAt`; correggere `onSubmit` Promise-returning (l.228). Owner sprint3: fix rAF in
   `reports-overtime.spec.ts`. Constraint: `max_diff_lines ≤ 80`, no refactor opportunistico.
2. **[batch — task_package prettier]** eseguire `prettier --write` su `components/staff/StaffModal.tsx`
   e `db/migrations/meta/{0000,0001,0002}_snapshot.json` (+ gli altri 15 file fuori-batch a cura dei
   rispettivi owner). Ripristina la porta `prettier`.
3. **[TSK-013, non-blocking]** rigenerare lo snapshot mancante: aggiungere phone/contractType a
   `schema.ts`, poi `drizzle-kit generate` per produrre `0004_snapshot.json` coerente e riallineare
   journal↔snapshot (sblocca `drizzle-kit generate` futuro).
4. **[TSK-016, non-blocking → a11y-specialist]** `ShiftCell`: `role="cell"` → `role="gridcell"` (o
   rimuovere `aria-readonly`) per chiudere i 2 warning `role-supports-aria-props`.
5. **[TSK-015, non-blocking]** uniformare la copy del dialog DELETE (F-015-02) e centralizzare la
   durata turno su `lib/rules/calculateShiftDuration` (F-015-03, RB-12).
6. **Uscita dalla modalità degradata:** seminare `code_quality/rules/canonical/` con le regole
   `candidate` più citate (`general.dead-broken-code`, `general.doc-code-mismatch`,
   `fe.domain.shared-rule-duplication`, + bozzare `general.shared-type-contract-drift`,
   `a11y.role-supports-aria-props`) — promozione = gate umano §19.5.

---

### Sicurezza (fuori scope CQRL — nessun incidente)

Nessun secret di produzione né CVE emersi. La nuova route `in-use` è correttamente admin-gated
(`unauthorized`/`forbidden` prima di ogni query). Nessun `wiki/incidents/*` aperto.
