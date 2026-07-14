# CQRL Batch 4 — Code Review TSK-017 / TSK-018 / TSK-019 / TSK-020

- **Reviewer**: code-reviewer@2.12.0 (CQRL v2.12)
- **Generato**: 2026-07-14T00:00:00Z
- **Stack rilevato**: TypeScript 5.x (strict) / Next.js 15 (App Router) + React 19 · TanStack Query v5 + Table v8 · Drizzle ORM · Zod · react-hook-form · Auth.js v5 · Radix UI · Tailwind — confidence ~0.95 (da `package.json`, `tsconfig.json` strict) → **stack-aware NON degradato**
- **Passate eseguite**: idiomaticità · design · robustezza (accessibility: alcuni rilievi low, dettaglio delegato a EP-007 `a11y-specialist`)
- **Ambito (admin Wave 2)**: gestione assenze, fabbisogni/copertura, wizard ricorrenze, coda approvazioni

---

## ⚠️ Meta-finding di processo (condiziona il flusso CQRL automatico)

Il ruleset locale `code_quality/rules/{team-specific,emergent,canonical}/` di soli-turnly è
**vuoto** (solo `.gitkeep`). L'unico rule pack disponibile è nel repo factory padre
(`code_quality/rules/canonical/design-complexity.md`, solo regole di complessità
language-agnostiche `*.design.complexity.*`).

Secondo `code-review-protocol §Regole anti-corner-case`, con ruleset vuoto il CQRL automatico
farebbe **ABORT**. Poiché questa review è **richiesta esplicitamente** con path report custom
(override tipo `/review`), procedo in **modalità bootstrapping** (coerente con batch 6/7):

- **Nessun finding cita una `rule_id` attiva** (non esistono a livello di progetto).
- Ogni finding propone una `rule_id` **candidate** (tier `emergent`, `status: candidate`),
  convenzione `{language}.{framework}.{context}.{slug}`. **Attivazione = gate umano** (§19.5).
- **Nessuna metrica di complessità ha superato le soglie di blocco** delle regole canoniche
  (`cyclomatic > 20` / `cognitive > 30`): niente finding `*.design.complexity.*` rule-backed.

**Caveat linter**: `eslint` è installato ma l'esecuzione fallisce (typed-linting —
`@typescript-eslint/no-floating-promises` richiede `parserOptions.project` che il flat-config
non fornisce quando invocato su subset di file). `linter_output` **non iniettato**; review basata
su analisi statica manuale. Raccomandato fix del flat-config per abilitare il CQRL deterministico.

**Fuori scope**: sicurezza (SAST/secret/dependency — R.Q7). Il rilievo H1 ha un risvolto
RBAC ma è classificato design/robustezza (nessun secret/CVE → nessun incident file).

---

## Verdetti (sintesi)

| TSK | Layer | Verdict | High | Medium | Low | Note |
|---|---|---|---|---|---|---|
| **TSK-017** | fe | **CONDITIONAL** | 0 | 3 | 2 | Flusso conflitti ben costruito; scrittura non transazionale + fail-open + FK placeholder |
| **TSK-018** | fe | **PASS (light)** | 0 | 0 | 3 | Qualità alta; solo hardening (truncation range, guard delete) |
| **TSK-019** | fe | **CONDITIONAL** | 1 | 1 | 3 | Wizard eccellente ma link `/admin/*` rotti + edit route inesistente + BE assente |
| **TSK-020** | fe | **CONDITIONAL** | 1 | 1 | 2 | Percorso attivo ottimo; **collisione di route (build breaker)** + ~1540 LOC dead-code |

Nessun marker rosso (`no_progress`, `regression`, `loop_exhausted`) — iter 1/3 per tutti.
Nessuna precedente iterazione in `code_quality/reports/`.

---

## ⛳ H1 — Cross-cutting (TSK-019 + TSK-020): contratto route-group `(admin)` vs prefisso `/admin/*`

- **Severity**: high · **fix_complexity**: medium · **auto_fixable**: no
- **rule_id (candidate)**: `ts.nextjs.robustness.duplicate_route_resolution`,
  `ts.nextjs.design.route_group_url_contract_mismatch`
- **Causa radice**: il route group `app/(admin)/**` è **URL-trasparente** in Next.js App Router →
  le pagine risolvono a URL **senza** segmento `/admin` (`/recurrence`, `/requests`, `/absences`,
  `/coverage`, `/dashboard`, `/users`, …). Parte del codice assume invece un prefisso `/admin/*`.
  Convivono quindi due convenzioni incompatibili.
- **Conseguenza 1 — collisione di route (BUILD BREAKER, TSK-020)**: due `page.tsx` risolvono allo
  stesso URL →
  - `/requests` ← `app/(admin)/requests/page.tsx` **e** `app/(employee)/requests/page.tsx`
  - `/requests/[id]` ← `app/(admin)/requests/[id]/page.tsx` **e** `app/(employee)/requests/[id]/page.tsx`

  Next.js fallisce in `next build`: *"You cannot have two parallel pages that resolve to the same
  path"*. Blocca la buildabilità di TSK-020.
- **Conseguenza 2 — link rotti / 404 (TSK-019)**: navigazione verso un segmento `/admin` che non
  esiste:
  `[^src5: code/app/components/recurrence/RecurrenceWizard.tsx:122]` e `:152` (`router.push('/admin/recurrence')`),
  `[^src5: code/app/components/recurrence/RecurrenceList.tsx:163]` (`/admin/recurrence/new`),
  `[^src5: code/app/components/recurrence/RecurrenceList.tsx:271]` (`/admin/recurrence/${id}/edit` — **route inesistente**),
  `[^src5: code/app/app/(admin)/recurrence/page.tsx:31]`, `[^src5: code/app/app/(admin)/recurrence/new/page.tsx:27]`.
- **Conseguenza 3 — regola middleware `/admin/*` "morta" per le pagine**:
  `[^src5: code/app/middleware.ts:56]` protegge `pathname.startsWith('/admin')`, ma le pagine reali
  stanno a path bare → il gate ruolo non le matcha. **Mitigato**: ogni RSC admin auto-verifica il
  ruolo (`auth()` / `requireAdmin()`), quindi l'access-control regge (defense-in-depth). Le route
  `/api/admin/*` usano un segmento `/admin` **reale** e sono correttamente protette. Resta config
  fuorviante + redirect post-login verso `/admin/dashboard` non risolvibile (`middleware.ts:31`).
- **Nota di coerenza**: TSK-020 usa internamente path **bare corretti** (`/requests`, `/requests/${id}`)
  — è TSK-019 ad usare il prefisso `/admin/*` errato. L'incoerenza è quindi *intra-team*.
- **Fix (una delle due direzioni, applicata ovunque)**:
  1. rinominare `app/(admin)` → `app/admin` (segmento letterale) — allinea middleware + link + risolve
     la collisione con `(employee)`; **oppure**
  2. mantenere `(admin)` e correggere link/middleware/redirect a path bare, disambiguando `/requests`
     admin vs employee (es. `app/(admin)/approvals`).
- **Handoff**: da valutare in `wiki/gaps.md` per review umana (impatto su scaffolding TSK-001 + Wave employee).

---

## TSK-017 — Gestione assenze + conflict resolution — CONDITIONAL

**AC soddisfatti (verificati a livello di codice)**: dry-run `check-conflicts` → apertura
`AbsenceConflictModal` con lista turni + radio Annulla/Mantieni/Riassegna (RF-G CA2); salvataggio
diretto se nessun conflitto; validazione form (dipendente/tipo obbligatori, `endDate ≥ startDate`,
note ≤ 500); tabella + empty state; a11y form curata (fieldset/legend, `role="alert"`, focus).

### [M1] Scrittura multi-entità non transazionale in `POST /api/admin/absences`
- **Severity**: medium · **fix_complexity**: low · **auto_fixable**: no
- **File**: `[^src5: code/app/app/api/admin/absences/route.ts:88]`–`158`
- **rule_id (candidate)**: `drizzle.robustness.non_transactional_multi_write`
- **Rationale**: il POST esegue in sequenza `db.delete(shifts)` / `db.update(shifts)` (per ogni
  `conflictResolution`) + `db.insert(absences)` + audit log, **senza** `db.transaction`. Se l'insert
  assenza (o un update intermedio) fallisce, i turni sono già stati cancellati/riassegnati ma nessuna
  assenza risulta registrata → planning incoerente e non ripristinabile. `grep` conferma **zero**
  uso di `db.transaction` in tutto il repo. Il flusso "risolvi conflitti + registra assenza" è per
  definizione atomico e va avvolto in una transazione.

### [M2] Fail-open sul controllo conflitti in `AbsenceForm`
- **Severity**: medium · **fix_complexity**: low · **auto_fixable**: no
- **File**: `[^src5: code/app/components/absences/AbsenceForm.tsx:145]`–`177`
- **rule_id (candidate)**: `ts.react.robustness.fail_open_on_safety_check`
- **Rationale**: se `check-conflicts` (dry-run di sicurezza) rifiuta, il `catch` prosegue con
  **creazione diretta senza risoluzioni** (`console.error` + commento "fallback a creazione diretta").
  L'assenza viene registrata mentre i turni in conflitto restano non gestiti — aggira il workflow
  RF-G CA2 proprio quando il sistema non riesce a garantirlo. È surfaced all'utente (avviso amber a
  `AbsenceForm.tsx:334`), ma il comportamento resta fail-open: preferibile bloccare il submit e
  invitare al retry.

### [M3] `absenceTypeId` valorizzato con la label enum (FK placeholder)
- **Severity**: medium · **fix_complexity**: medium · **auto_fixable**: no
- **File**: `[^src5: code/app/app/api/admin/absences/route.ts:133]`–`148` (linea 140)
- **rule_id (candidate)**: `drizzle.robustness.placeholder_fk_value`
- **Rationale**: `absenceTypeId: absenceType` scrive la stringa enum (`'ferie'`, `'malattia'`, …)
  in una colonna FK che dovrebbe referenziare `absence_types.id` (UUID). Il commento lo dichiara
  "placeholder — da sostituire con UUID reale post-seed". In produzione produce FK violation o join
  rotti su `absence_types`. È debito documentato ma rimane un difetto latente bloccante per l'uso reale.

### [L1] Filtro riassegnazione confronta `user.id` con l'id del turno
- **Severity**: low · **fix_complexity**: low · **auto_fixable**: no
- **File**: `[^src5: code/app/components/absences/ConflictShiftList.tsx:257]`
- **rule_id (candidate)**: `ts.react.design.mismatched_id_comparison`
- **Rationale**: `users.filter((u) => u.id !== conflict.id)` con commento "esclude stesso user del
  turno" — ma `conflict.id` è l'**id del turno**, e `ShiftConflict` non espone `userId`. Il filtro
  non esclude mai nessuno (confronto tra spazi-id diversi): codice morto + commento fuorviante.
  Effetto funzionale: si può "riassegnare" il turno allo stesso dipendente che va in assenza.

### [L2] Cast non sicuro di query param a literal enum
- **Severity**: low · **fix_complexity**: low · **auto_fixable**: yes (validazione Zod)
- **File**: `[^src5: code/app/app/api/admin/absences/route.ts:45]`
- **rule_id (candidate)**: `ts.idiomaticity.unsafe_query_param_cast`
- **Rationale**: `eq(absences.status, statusParam as 'pending')` forza un parametro di query
  arbitrario al tipo literal senza validarlo contro l'enum → aggira la type-safety (un valore fuori
  enum passa a Drizzle così com'è). Validare con Zod / whitelist prima dell'uso.

### Advisory (non gating)
- `TODO TSK-006` RB-09 (overlap assenze) / RB-10 (saldo ferie) non validati (`route.ts:130-131`) —
  delegato a TSK-006; se implica test mancanti → competenza `qa-dev` (`qa.testing.*`), non CQRL.

**Verdict TSK-017**: `CONDITIONAL` — 3 medium robustezza, nessun blocco duro. Loop non obbligatorio;
`task_package` per fe-dev con must-fix M1+M2, then M3.

---

## TSK-018 — Fabbisogni/copertura + monitor sotto-copertura — PASS (light)

**AC soddisfatti**: setup regole (CRUD) + monitor grid data × fascia con celle verde/giallo/rosso e
deficit `-N`; navigazione periodo settimana/mese; empty state; delete con conferma 409 se turni
attivi oggi; a11y monitor solida (`role="grid"`, `scope=col/row`, sticky header, `aria-busy`).
`CoverageMonitorGrid`, `CoverageCell`, `CoverageLegend` e le route sono di **buona qualità**.

### [L1] Troncamento silenzioso del range a 90 giorni nel monitor
- **Severity**: low · **fix_complexity**: low · **auto_fixable**: no
- **File**: `[^src5: code/app/app/api/admin/coverage/monitor/route.ts:35]`–`48` (guard `count < 90`)
- **rule_id (candidate)**: `ts.robustness.silent_range_truncation`
- **Rationale**: `generateDateRange` tronca a 90 giorni **senza** errore né segnale al client: un
  range > 90gg restituirebbe dati parziali indistinguibili da "nessun fabbisogno". Latente (la UI
  oggi limita a week/month), ma perdita dati silenziosa. Meglio 400 esplicito o flag `truncated`.

### [L2] Guard "turni attivi oggi" imprecisa nel DELETE regola
- **Severity**: low · **fix_complexity**: low · **auto_fixable**: no
- **File**: `[^src5: code/app/app/api/admin/coverage-requirements/[id]/route.ts:76]`–`90`
- **rule_id (candidate)**: `drizzle.design.overbroad_guard_query`
- **Rationale**: quando la regola non ha `shiftTypeId` si usa `isNotNull(shifts.id)` (match di
  *tutti* i turni) e non si filtra mai per la `qualificationId` della regola. L'avviso RB-07 può
  scattare per turni non pertinenti (falso positivo). È solo un warning non bloccante → low.

### [L3] Nome qualifica con fallback a UUID
- **Severity**: low · **File**: `[^src5: code/app/app/api/admin/coverage/monitor/route.ts:187]`
- `qualificationName: rule.qualificationName ?? rule.qualificationId` espone un UUID come label se
  il join qualifica è null. Cosmetico.

**Verdict TSK-018**: `PASS` — nessun finding high/medium; solo hardening opzionale. Codice pronto.
(Eredita la nota cross-cutting H1 solo indirettamente: le sue pagine `/coverage` sono auto-protette
via `requireAdmin()`.)

---

## TSK-019 — Ricorrenze wizard 3-step — CONDITIONAL

**AC soddisfatti (UI)**: wizard 0→1→2 con **dati preservati** al back (stato nel `RecurrenceWizard`
orchestratore, no reset); step1 settimanale/rotativo con builder sequenza; step2 multi-select con
filtro qualifica/nome + validazione; step3 preview (turni/saltati assenza/festivi) + report conflitti
collassabile + "Genera" disabilitato finché preview non pronta; a11y stepper (`aria-current="step"`,
focus sul titolo passo). Qualità dei componenti **alta**.

### [H1'] Link `/admin/recurrence*` rotti + edit route inesistente — vedi ⛳ H1
- **Severity**: high (istanza TSK-019 del finding cross-cutting)
- Redirect post-generazione e tutti i `Link`/`router.push` puntano a `/admin/recurrence*` (404) e a
  `/admin/recurrence/${id}/edit` (pagina **inesistente**). La navigazione core del TSK non funziona.

### [M1] Intera UI costruita su endpoint BE inesistenti (GAP-RECURRENCE-API-001)
- **Severity**: medium · **fix_complexity**: high · **auto_fixable**: no
- **File**: `[^src5: code/app/hooks/useRecurrences.ts:9]`–`13`, `137`, `180`, `203`
- **rule_id (candidate)**: `process.completeness.ui_against_missing_api`
- **Rationale**: `useRecurrences`/`usePreviewRecurrence`/`useGenerateRecurrence`/`useDeactivateRecurrence`
  consumano `/api/admin/recurrences`, `/api/admin/recurrence/preview`, `/api/admin/recurrence/generate`
  che **non esistono** nel repo (esistono solo `recurrences` GET/POST/DELETE di TSK-009, non
  preview/generate). Il flusso end-to-end non è eseguibile. È debito **documentato**
  (`wiki/gaps.md — GAP-RECURRENCE-API-001`) → medium, competenza be/qa per la chiusura.

### [L1] Incoerenza URL API: `recurrences` (plurale) vs `recurrence/*` (singolare)
- **Severity**: low · **File**: `[^src5: code/app/hooks/useRecurrences.ts:141]` vs `:183`/`:208`
- **rule_id (candidate)**: `ts.nextjs.idiomaticity.inconsistent_api_pluralization`
- Mescolare `/api/admin/recurrences` e `/api/admin/recurrence/…` nello stesso hook favorisce
  errori di routing. Standardizzare (preferibile plurale REST).

### [L2] "Visualizza occorrenze" non implementa l'editing per-occorrenza (RF-E CA2 parziale)
- **Severity**: low · **File**: `[^src5: code/app/components/recurrence/RecurrenceList.tsx:351]`–`410`
- Il Dialog mostra solo il riepilogo serie + rimando alla matrice; manca il toggle "Modifica solo
  questa / Modifica serie" richiesto da RF-E CA2. Gap funzionale → verifica `qa-dev`.

### [L3] Handler con parametri inutilizzati mascherati con `void`
- **Severity**: low · **File**: `[^src5: code/app/components/recurrence/RecurrenceWizard.tsx:118]`–`127`
- **rule_id (candidate)**: `ts.idiomaticity.void_unused_param_smell`
- `handleGenerateSuccess(generated, skipped)` riceve due parametri usati solo via `void generated;`
  `void skipped;`. Se davvero inutili qui, rimuoverli dalla firma; il commento "usato nel toast step3"
  indica che il toast è già emesso a monte (step3) → parametri ridondanti.

**Verdict TSK-019**: `CONDITIONAL` — 1 high (H1' navigazione) + 1 medium (BE assente). Wizard di ottima
fattura ma non funzionante finché H1' + API non sono risolti.

---

## TSK-020 — Coda approvazioni — CONDITIONAL

**AC soddisfatti (percorso attivo)**: inbox `RequestQueue` (TanStack Table v8, sorting, filtri stato/tipo,
default `sent`); dettaglio `/requests/[id]` → `RequestDetailClient` con `RequestDetail` +
`SwapColleagueStatus` + `ApprovalImpactPanel` + `ApprovalActions`; gestione **409 RB-14** via
`ApprovalBlockedError` con violazioni + Approva disabilitato; rifiuto con motivo obbligatorio (Zod
`min(1).max(500)`, counter); fallback graceful G-009 su `/impact` (404/501 → risultato vuoto);
readonly per stati non `sent`. Gli hook `useRequests` e il percorso attivo sono **eccellenti** (error
tipizzati, query keys factory, invalidazioni mirate).

### [H1''] Collisione di route `/requests` e `/requests/[id]` — vedi ⛳ H1
- **Severity**: high (istanza TSK-020, **build breaker**)
- `app/(admin)/requests` collide con `app/(employee)/requests` sullo stesso URL → `next build`
  fallisce. È il difetto più impattante di TSK-020.

### [M1] Cluster di dead-code (~1540 LOC) in `components/requests/`
- **Severity**: medium · **fix_complexity**: low · **auto_fixable**: no
- **File**: `[^src5: code/app/components/requests/RequestForm.tsx]` (590 LOC),
  `[^src5: code/app/components/requests/ApprovalPanel.tsx]` (287),
  `[^src5: code/app/components/requests/SwapForm.tsx]` (293),
  `[^src5: code/app/components/requests/AbsenceForm.tsx]` (272),
  `[^src5: code/app/app/(admin)/requests/_components/ApprovalQueueClient.tsx]` (100)
- **rule_id (candidate)**: `ts.design.orphaned_dead_module`
- **Rationale**: `grep` su `app/` + `components/` conferma **zero** riferimenti vivi:
  - `RequestForm`/`SwapForm`/`AbsenceForm` (in `components/requests/`) non sono importati da nessuno —
    il lato employee usa `components/employee/requests/new/RequestForm{Absence,Swap,NewShift,ModifyShift}`.
  - `ApprovalQueueClient` (imported_by=0) importa `ApprovalPanel` → entrambi transitivamente morti;
    la pagina admin usa invece `RequestQueue`.
  Esistono quindi **due implementazioni parallele** dell'approvazione (attiva:
  `RequestQueue`+`ApprovalActions`; morta: `ApprovalQueueClient`+`ApprovalPanel`), con rischio di
  divergenza/manutenzione. Rimuovere il cluster morto o wire-up esplicito.

### [L1] `ApprovalQueueClient` filtra per stato `'pending'` inesistente nell'enum
- **Severity**: low (dentro codice morto) · **File**: `[^src5: code/app/app/(admin)/requests/_components/ApprovalQueueClient.tsx:15]`
- L'enum `RequestStatus` è `draft|sent|awaiting_colleague|approved|rejected|cancelled|applied` — `'pending'`
  non esiste → il filtro non restituirebbe mai nulla. Prova ulteriore che il modulo è obsoleto (evidenza a supporto di M1).

### [L2] ARIA ridondante/mispositionato su tabella nativa
- **Severity**: low · **File**: `[^src5: code/app/components/requests/RequestQueue.tsx:304]`–`345`
- **rule_id (candidate)**: `html.a11y.redundant_table_roles`
- `role="table"/"row"/"cell"/"columnheader"` su elementi `<table>/<tr>/<td>/<th>` nativi è ridondante;
  inoltre `aria-sort` è sul `<button>` interno anziché sul `<th>` columnheader (gli screen reader lo
  attendono sull'header). **Dettaglio a11y delegato a EP-007 `a11y-specialist`** (non gating qui).

**Verdict TSK-020**: `CONDITIONAL` — 1 high (collisione build) + 1 medium (dead-code). Il codice del
percorso attivo è pronto; servono la risoluzione H1 e la pulizia del cluster morto.

---

## Loop status

- Iterazione **1 / 3** (`code_quality.max_iterations: 3`) per tutti e 4 i TSK.
- Marker: `no_progress: false` · `regression: false` · `loop_exhausted: false` · `degraded: false`.
- Nessun report iter precedente in `code_quality/reports/` per questi TSK.

## Prossimo step

- **CONDITIONAL** (TSK-017, TSK-019, TSK-020) → `feedback-router` genererebbe `task_package` per
  **fe-dev** (iter 2). Priorità trasversale: **risolvere H1** (route group vs `/admin/*` +
  collisione `/requests`) — sblocca sia la build (TSK-020) sia la navigazione (TSK-019).
  Constraint: `max_diff_lines: 80` per fix, no refactor opportunistico.
- **PASS** (TSK-018) → chiusura; L1/L2/L3 opzionali.
- **Gate umano**: verdict non-`pass` NON auto-applica modifiche (R.Q2/R.Q3). H1 tocca lo scaffolding
  (TSK-001) e la Wave employee → suggerito tracciare in `wiki/gaps.md` per decisione umana.
- **Regole emergent candidate** depositabili (status `candidate`, gate umano §19.5): quelle citate
  nei finding qui sopra. Non promosse in questo run.
- **Abilitare linter deterministico**: correggere il flat-config eslint (typed-linting) per il CQRL
  automatico; popolare `code_quality/rules/canonical/ts.nextjs.*` per evitare futuri ABORT.
