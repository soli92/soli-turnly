# CQRL Code Review — Batch 6 (TSK-025 → TSK-028)

- **Reviewer**: code-reviewer (CQRL v2.12, PATTERN §19)
- **Generated at**: 2026-07-14
- **Sprint / Wave**: Sprint 3, Wave 1–2
- **Code path**: `code/app` (monorepo, layers be+fe+db+qa)
- **Iter**: 1 (nessun report precedente per questi TSK)
- **Trigger**: comando esplicito batch `/review` (override una-tantum; i TSK non hanno ancora `review_status` in frontmatter)
- **Passate eseguite**: idiomaticità → design → robustezza (3 passate primarie). A11y toccata solo dove interseca robustezza; il pass WCAG dedicato resta a carico di `a11y-specialist` (EP-007).

## Stack rilevato

| Dimensione | Valore | Confidence |
|---|---|---|
| Language | TypeScript | alta |
| Framework | Next.js 15 (App Router / RSC) + React 19 | alta |
| Data layer | Drizzle ORM + `postgres` | alta |
| Auth | next-auth v5 (beta) | alta |
| Client state | TanStack Query v5 / Table v8 / Virtual | alta |
| Validation | Zod + react-hook-form | alta |
| UI | Radix UI + shadcn wrappers + Tailwind v4 | alta |

`stack_descriptor`: `ts/next15-rsc/drizzle-pg/tanstack-query/zod`. Confidence stack ≥ `confidence_min (0.6)` → **modalità stack-aware piena** (nessun degrado di linguaggio).

## ⚠️ Modalità RULESET DEGRADATA (importante)

L'albero `code_quality/rules/{canonical,team-specific,emergent}/` contiene **solo `.gitkeep`**: nessuna regola attiva è definita. Per non violare l'invariante «mai inventare», ogni finding qui sotto cita un **`rule_id` candidato** nel namespace `emergent/` con `status: candidate`. Questi `rule_id` **non sono ancora regole attive**: sono proposte tracciabili in attesa di promozione umana (§19.5 step 3–4). Nessuna bozza è stata scritta su disco in questo run per non ampliare il footprint oltre il report richiesto; l'elenco dei candidati proposti è in fondo al documento (sezione «Regole emergent proposte»).

Conseguenza operativa: i verdetti sotto sono **advisory** finché il ruleset non viene popolato. Consiglio di popolare almeno le regole citate prima di far girare i loop automatici (altrimenti la no-progress/regression detection §19.4 non ha baseline).

---

## Riepilogo verdetti

| TSK | Titolo | Verdict | Finding (H/M/L) | Nota |
|---|---|---|---|---|
| TSK-025 | Disponibilità dipendente | **conditional** | 0 / 2 / 3 | Duplicazione schema validazione + `confirm()` nativo |
| TSK-026 | Swap admin | **conditional** | 1 / 1 / 4 | **Swap multi-write senza transazione DB** (priorità) |
| TSK-027 | Report straordinari | **conditional** | 0 / 1 / 4 | Aritmetica RB-06 riscritta invece di condivisa |
| TSK-028 | Centro notifiche | **conditional** | 0 / 1 / 2 | Data-fetching notifiche non centralizzato (inconsistenza) |

Nessun verdict `reject`: nessun finding di sicurezza (secret/CVE), nessun loop esaurito, nessun difetto critico non risolvibile. Tutti i TSK **soddisfano funzionalmente i propri acceptance criteria** (la correttezza resta di competenza `qa-dev`); i finding riguardano design, idiomaticità e robustezza.

Severità: **H** = va risolto prima del pass; **M** = fix consigliato nel prossimo giro; **L** = advisory / debito tecnico tracciato.

---

## TSK-025 — Disponibilità dipendente → `conditional`

### File in review
- `code/app/app/api/users/me/availability/route.ts`
- `code/app/hooks/useAvailability.ts`
- `code/app/app/(employee)/availability/**`
- `code/app/lib/zod/index.ts` (schema condiviso, contesto)

### Finding

**[M-1] Doppia sorgente di verità per la validazione (form vs BE)** — `design`
Il form definisce un proprio `availabilityFormSchema` con `superRefine` [^src5: code/app/app/(employee)/availability/_components/AvailabilityForm.tsx:56], dichiarato esplicitamente «mirror di availabilityCreateSchema». Il BE usa invece `availabilityCreateSchema` con due `.refine()` (scope↔definition e endDate≥startDate) [^src5: code/app/lib/zod/index.ts:393]. Le due implementazioni codificano la stessa logica RB-13 in forme diverse (flat+superRefine vs union+refine). Se una cambia, l'altra diverge silenziosamente: il form potrebbe accettare payload che il BE rifiuta (o viceversa), producendo errori 400 non mappati su un campo. Raccomandazione: derivare i due schema da una singola base (es. un factory `buildAvailabilitySchema()` in `lib/zod`) o mappare i campi del form sullo schema condiviso.
`[^rule: emergent/design.validation.single-source-of-truth §Rationale (candidate)]`

**[M-2] Conferma eliminazione via `window.confirm()` nativo** — `idiomaticità`
`AvailabilityCard.handleDelete` usa `confirm(...)` [^src5: code/app/app/(employee)/availability/_components/AvailabilityCard.tsx:105]. Il progetto ha `@radix-ui/react-alert-dialog` e un wrapper shadcn `AlertDialog`, usato correttamente in `SwapConfirmDialog` (TSK-026). `confirm()` blocca il main thread, non è stilizzabile, non rispetta il design system, ed è difficile da testare (Playwright/interaction-test EP-005 deve stubbarlo). Inconsistente con il pattern già presente nella stessa codebase.
`[^rule: emergent/idiomaticity.react.native-confirm-vs-dialog §Rationale (candidate)]`

**[L-3] Errore di eliminazione visibile solo agli screen reader** — `robustezza`
In caso di fallimento del `DELETE`, l'errore è reso solo come `role="alert"` **`sr-only`** [^src5: code/app/app/(employee)/availability/_components/AvailabilityCard.tsx:167]. Lo spinner si ferma ma l'utente vedente non riceve feedback visivo del fallimento. Rendere l'errore percepibile anche visivamente (toast o testo inline).
`[^rule: emergent/robustness.ui.invisible-error-feedback §Rationale (candidate)]`

**[L-4] Cast di tipo evitabili nel route handler** — `idiomaticità`
`definition as Record<string, unknown>` [^src5: code/app/app/api/users/me/availability/route.ts:68] e `session.user.id as string` (ripetuto in tutti i route). Il secondo è risolvibile con un'augmentation dei tipi di next-auth (`Session['user']['id']: string`) applicata una volta sola, eliminando il cast in ~10 handler.
`[^rule: emergent/idiomaticity.ts.avoid-any-cast §Rationale (candidate)]`

**[L-5] Parsing di date-string che bypassa `lib/date`** — `robustezza / consistenza`
`formatDefinition` usa `new Date(def.startDate).toLocaleDateString(...)` [^src5: code/app/app/(employee)/availability/_components/AvailabilityCard.tsx:68]. Il progetto ha un modulo `lib/date` DST-safe esplicito (T-DOM-08) con `formatInTimeZone`. Su `Europe/Rome` l'impatto è nullo (offset positivo), ma l'uso diretto di `new Date('YYYY-MM-DD')` (parse UTC) è la convenzione che `lib/date` esiste per evitare. Finding cross-cutting (vedi anche TSK-026/027).
`[^rule: emergent/idiomaticity.date.dst-safe-helper-bypass §Rationale (candidate)]`

### Verificato NON problematico (per trasparenza)
- Il BE **valida correttamente** sia la coerenza scope↔definition sia `endDate ≥ startDate` via `.refine()` [^src5: code/app/lib/zod/index.ts:432]. Il body del TSK mostrava uno schema `z.union` senza cross-field; l'implementazione reale è più robusta. Nessun gap di validazione server-side.
- Ownership `DELETE` corretta: 404 se assente, 403 se altrui, `WHERE id AND userId` sull'eliminazione [^src5: code/app/app/api/users/me/availability/route.ts:94] → AC RB-13/T-SEC-05 soddisfatto.

### Prossimo step
Task package (M-1, M-2) al dev-agent; L-3/L-4/L-5 come debito tracciato. Diff atteso < `max_diff_lines (80)`. `review_status` consigliato: `conditional`.

---

## TSK-026 — Swap admin → `conditional` (priorità alta sul finding H-1)

### File in review
- `code/app/app/api/admin/swap/route.ts`
- `code/app/app/api/admin/swap/preview/route.ts`
- `code/app/hooks/useSwap.ts`
- `code/app/app/(admin)/swap/**`

### Finding

**[H-1] Mutazione swap multi-write SENZA transazione DB** — `robustezza` (headline del batch)
L'esecuzione dello swap effettua **quattro scritture non atomiche**: UPDATE shift A [^src5: code/app/app/api/admin/swap/route.ts:126], UPDATE shift B [^src5: code/app/app/api/admin/swap/route.ts:131], INSERT `swap_operations` [^src5: code/app/app/api/admin/swap/route.ts:137], INSERT `audit_log` [^src5: code/app/app/api/admin/swap/route.ts:154]. Nessuna `db.transaction(...)`. Se una qualsiasi fallisce (secondo UPDATE, insert, crash tra le due):
- lo stato DB resta **corrotto**: il turno A cambia proprietario ma B no (o viceversa) → doppia assegnazione / turno orfano;
- oppure lo swap avviene ma **manca la riga `audit_log`**, violando l'atomicità richiesta da **RF-F CA4** («ogni swap confermato produce una riga in audit_log»).

`grep` conferma che `db.transaction` **non è usato in nessun punto** della codebase — quindi è un pattern assente a livello di progetto, ma qui è massimamente critico perché le due UPDATE sono accoppiate per definizione. Fix: avvolgere gli step 6 in `await db.transaction(async (tx) => { ... })` (Drizzle lo supporta nativamente col driver `postgres`). Valutare inoltre un lock ottimistico (vedi L-5).
`[^rule: emergent/robustness.db.transaction-atomicity §Rationale (candidate)]`

**[M-2] Preparazione validazione swap duplicata tra POST e preview** — `design / DRY`
Il blocco «carica shifts+absences dei due utenti → `toExistingShift` → `validateSwap(...)`» è **duplicato verbatim** tra il route di esecuzione [^src5: code/app/app/api/admin/swap/route.ts:69] e quello di anteprima [^src5: code/app/app/api/admin/swap/preview/route.ts:55]. Rischio concreto e insidioso: preview ed esecuzione possono **divergere** (query o mapping cambiati in un solo file), vanificando lo scopo stesso dell'anteprima (mostrare esattamente ciò che accadrà). Estrarre in `lib/rules/prepareSwapValidation.ts` una funzione condivisa che ritorni l'input di `validateSwap`.
`[^rule: emergent/design.dry.duplicated-business-logic §Rationale (candidate)]`

**[L-3] Esiti `rejected`/`warnings` inghiottiti in fase di esecuzione** — `robustezza / UX`
`useExecuteSwap` **non lancia** sul 422: restituisce il body come dato [^src5: code/app/hooks/useSwap.ts:142]. In `SwapAdminPageClient.doExecuteSwap` l'`onSuccess` gestisce solo `outcome === 'executed'` [^src5: code/app/app/(admin)/swap/_components/SwapAdminPageClient.tsx:112]. Se all'esecuzione compare una blocking violation non presente in anteprima (TOCTOU) o un `requiresConfirmation` inatteso, il dialog si chiude, `isError` è false e **l'utente non vede nulla**. Gestire esplicitamente i rami `rejected`/`warnings` nell'`onSuccess`.
`[^rule: emergent/robustness.ui.silent-mutation-outcome §Rationale (candidate)]`

**[L-4] 422 inviato tramite `ApiResponse.ok(data, 422)`** — `idiomaticità`
Uso dell'helper `ok` (semanticamente «successo») per uno status 4xx [^src5: code/app/app/api/admin/swap/route.ts:103]. Aggiungere `ApiResponse.unprocessable(...)` a `lib/api-response.ts` e usarlo, per non nascondere errori dietro un helper `ok`.
`[^rule: emergent/idiomaticity.api.semantic-status-helper §Rationale (candidate)]`

**[L-5] TOCTOU / assenza di lock ottimistico** — `robustezza`
Tra la lettura di `shiftA`/`shiftB` e la UPDATE nessun controllo di versione/`updatedAt`. In concorrenza (due admin, o admin + job ricorrenze) lo swap può sovrascrivere una modifica intermedia. Bassa probabilità (admin-only) ma da valutare insieme a H-1 (stessa transazione).
`[^rule: emergent/robustness.db.transaction-atomicity §Rationale (candidate)]`

**[L-6] `as any` + eslint-disable non necessari sull'audit** — `idiomaticità`
`before`/`after` sono castati a `any` con `eslint-disable` [^src5: code/app/app/api/admin/swap/route.ts:159]. La firma `insertAuditLog` accetta già `before?: unknown` / `after?: unknown` [^src5: code/app/lib/audit.ts:61]: il cast (e la soppressione lint) è superfluo, basta rimuoverlo o usare `Record<string, unknown>`.
`[^rule: emergent/idiomaticity.ts.avoid-any-cast §Rationale (candidate)]`

### Verificato NON problematico
- Role check admin presente e coerente su POST [^src5: code/app/app/api/admin/swap/route.ts:39], preview [^src5: code/app/app/api/admin/swap/preview/route.ts:23] e RSC page [^src5: code/app/app/(admin)/swap/page.tsx:44] → AC 403 soddisfatto.
- Flusso warnings→conferma corretto lato client (dialog RF-F CA2) e verifica «dipendenti diversi» presente su client e server.

### Prossimo step
Task package prioritario **H-1** (transazione) + **M-2** (dedup preview/exec) al dev-agent. Se il TSK fosse taggato `tiger-*` (risk_classification), suggerire `/premortem` prima del re-Develop (touchpoint #3, non automatico). `review_status` consigliato: `conditional`.

---

## TSK-027 — Report straordinari → `conditional`

### File in review
- `code/app/app/api/admin/reports/overtime/route.ts`
- `code/app/hooks/useOvertimeReport.ts`
- `code/app/app/(admin)/reports/**`
- `code/app/lib/rules/calculateOvertime.ts` (contesto)

### Finding

**[M-1] Aritmetica RB-06 riscritta invece di condivisa** — `design / DRY`
Il route implementa `calculateOvertimeForPeriod` [^src5: code/app/app/api/admin/reports/overtime/route.ts:74] con la logica per-settimana `min(week, contract)` / `max(0, week-contract)`, mentre `lib/rules/calculateOvertime.ts` implementa la **stessa** regola RB-06 [^src5: code/app/lib/rules/calculateOvertime.ts:23].
Nota di equità: la funzione esistente **non era riusabile così com'è** — ha firma single-week e ritorna un `ValidationResult` con messaggi `info`, non `{ ordinaryMinutes, overtimeMinutes }` come suggeriva (erroneamente) il body del TSK. La riscrittura dell'aggregazione multi-settimana è quindi in parte giustificata. **Ma** il cuore aritmetico RB-06 resta duplicato e già **diverge**: il report usa `Math.round((end-start)/60000)` [^src5: code/app/app/api/admin/reports/overtime/route.ts:86] mentre la rule usa `differenceInMinutes` (troncamento) [^src5: code/app/lib/rules/calculateOvertime.ts:41] → possibili scarti di ±1 min tra report e validazione turni. Estrarre una primitiva pura condivisa (es. `weeklyOvertimeMinutes(weekMinutes, contractMinutes)` + una funzione minuti-turno unica) usata da entrambi.
`[^rule: emergent/design.dry.duplicated-business-logic §Rationale (candidate)]`

**[L-2] Paginazione in-memory dopo fetch totale** — `robustezza / performance`
Il route carica **tutti** i turni del range, aggrega **tutti** gli utenti e poi fa `results.slice(offset, offset+limit)` [^src5: code/app/app/api/admin/reports/overtime/route.ts:231]. Ogni richiesta di pagina rilegge e ricalcola l'intero dataset. Accettabile per org piccole (limit ≤ 200), ma non scala. Documentare il limite o spostare l'aggregazione a livello SQL/window.
`[^rule: emergent/robustness.perf.in-memory-pagination §Rationale (candidate)]`

**[L-3] Soglia «mensile» confrontata con somma su range arbitrario** — `design / chiarezza`
`overtimeExceedsThreshold = overtimeHours > MAX_STRAORDINARIO_MENSILE_ORE (40)` [^src5: code/app/app/api/admin/reports/overtime/route.ts:223], ma `overtimeHours` è la somma su **tutte** le settimane ISO del range scelto dall'admin. Se il range ≠ 1 mese, confrontare la somma con una soglia «mensile» è semanticamente incoerente (un report trimestrale segnala «sopra soglia» quasi sempre). Chiarire l'intento (soglia sul totale del range? per-mese? per-settimana?) e allineare nome/UI.
`[^rule: emergent/design.reports.threshold-period-mismatch §Rationale (candidate)]`

**[L-4] Export CSV senza guardia contro formula injection** — `robustezza (hardening)`
`exportCsv` cita valori con doppi apici ma **non neutralizza** celle che iniziano con `=`, `+`, `-`, `@` [^src5: code/app/app/(admin)/reports/overtime/_components/OvertimeFilters.tsx:84]. `firstName`/`lastName`/`qualificationName` sono dati controllabili dall'utente: un nome tipo `=HYPERLINK(...)` può eseguire in Excel/Sheets. Nota: **non** è un secret né una CVE → non attiva lo STOP di sicurezza CQRL; resta un hardening dell'export. Fix: prefissare le celle a rischio con apice singolo / spazio.
`[^rule: emergent/robustness.export.csv-formula-injection §Rationale (candidate)]`

**[L-5] Separatore decimale CSV non localizzato** — `robustezza / i18n`
Il CSV usa `.` come separatore decimale (`toFixed(2)`) [^src5: code/app/app/(admin)/reports/overtime/_components/OvertimeFilters.tsx:90]; Excel in locale IT si aspetta `,`, quindi i numeri vengono re-interpretati come testo/date all'import. Valutare `,` + separatore campo `;`, oppure documentare.
`[^rule: emergent/robustness.export.csv-formula-injection §Rationale (candidate)]`

### Verificato NON problematico
- Durata turno via `end.getTime() - start.getTime()` è **DST-corretta** (tempo reale trascorso), coerente con RB-12.
- Validazione `from`/`to`, cap `limit ≤ 200`, ordinamento `overtimeHours desc`, empty state e skeleton: tutti presenti → AC soddisfatti.
- Role check admin su RSC [^src5: code/app/app/(admin)/reports/overtime/page.tsx:30] e route [^src5: code/app/app/api/admin/reports/overtime/route.ts:116].

### Prossimo step
Task package **M-1** (estrarre primitiva RB-06 condivisa) al dev-agent; L-2..L-5 come debito. `review_status` consigliato: `conditional`.

---

## TSK-028 — Centro notifiche → `conditional` (bassa priorità)

### File in review
- `code/app/app/api/notifications/read-all/route.ts`
- `code/app/components/notifications/NotificationBell.tsx`
- `code/app/app/(employee)/notifications/**`

### Finding

**[M-1] Data-fetching notifiche non centralizzato / query key magic-string** — `design / idiomaticità`
Tutte le altre feature del repo hanno un modulo hook con key factory (`shiftKeys` [^src5: code/app/hooks/useShifts.ts:30], `availabilityKeys`, `swapKeys`, `overtimeReportKeys`). Le notifiche **no**: 
- `markNotificationRead` è duplicato verbatim in `NotificationBell` [^src5: code/app/components/notifications/NotificationBell.tsx:49] e `NotificationItem` [^src5: code/app/app/(employee)/notifications/_components/NotificationItem.tsx:40];
- `markAllRead` duplicato in `NotificationBell` [^src5: code/app/components/notifications/NotificationBell.tsx:54] e `MarkAllReadButton` [^src5: code/app/app/(employee)/notifications/_components/MarkAllReadButton.tsx:17];
- la key `['notifications']` è una magic string ripetuta in ≥5 punti, e la sincronizzazione bell↔centro dipende **implicitamente** dal partial-match di `invalidateQueries` (vedi «verificato» sotto).
Rischio: una futura ristrutturazione della key (es. `['notifications','bell']` per motivi legittimi) romperebbe **silenziosamente** l'AC di cross-invalidazione, senza errori di compilazione. Centralizzare in `hooks/useNotifications*` con un `notificationKeys` factory e helper di mutazione unici.
`[^rule: emergent/idiomaticity.data-fetching.query-key-factory §Rationale (candidate)]`

**[L-2] Mutazioni mark/mark-all senza feedback d'errore** — `robustezza`
Nel `NotificationBell` le mutation non espongono stato d'errore in UI [^src5: code/app/components/notifications/NotificationBell.tsx:78]: un fallimento del PATCH è silenzioso (il badge semplicemente non si aggiorna). Aggiungere almeno un toast su `onError`.
`[^rule: emergent/robustness.ui.invisible-error-feedback §Rationale (candidate)]`

**[L-3] `role="status"` su badge statico (cross-cutting con TSK-027)** — `a11y / idiomaticità`
`OvertimeRowBadge` usa `role="status"` (live region) su un badge di tabella non dinamico [^src5: code/app/app/(admin)/reports/overtime/_components/OvertimeRowBadge.tsx:22]. Su liste lunghe gli screen reader possono annunciare ogni badge al render. Per contenuto statico basta uno `<span>` con testo/`aria-label`; `role="status"`/`aria-live` va riservato agli aggiornamenti asincroni. (Finding di dettaglio a11y; conferma finale a `a11y-specialist` EP-007.)
`[^rule: emergent/idiomaticity.react.native-confirm-vs-dialog §Rationale (candidate)]`

### Verificato NON problematico (diligenza)
- **La cross-invalidazione bell↔centro FUNZIONA**: `invalidateQueries({ queryKey: ['notifications'] })` usa il partial match di default, quindi invalida sia `['notifications']` (bell) sia `['notifications','center']` (centro) [^src5: code/app/app/(employee)/notifications/_components/NotificationCenterClient.tsx:68]. AC «badge torna a 0 sia in pagina sia in bell» **soddisfatto**. Il rischio in M-1 è di fragilità futura, non un bug attuale.
- `read-all` filtra sempre per `userId = session.user.id` [^src5: code/app/app/api/notifications/read-all/route.ts:31] → RF-N CA3 (no IDOR) soddisfatto; audit inserito solo se ci sono righe aggiornate.
- `MarkAllReadButton` cablato nella page RSC [^src5: code/app/app/(employee)/notifications/page.tsx:42]; empty state, `<time datetime>`, `role="list"/"listitem"`, entity routing → AC soddisfatti.

### Prossimo step
Task package **M-1** (centralizzazione hook notifiche) al dev-agent, bassa priorità; L-2/L-3 debito. `review_status` consigliato: `conditional` (non bloccante).

---

## Loop status

- Iter 1/`max_iterations (3)` per tutti e 4 i TSK. Nessun report precedente → **no-progress detection** e **regression detection** non applicabili (nessuna baseline).
- Nessun finding di sicurezza → nessuno STOP `reject` / incident aperto.
- Nessun TSK ha raggiunto `review_iter ≥ max_iterations` → nessun marker `loop-exhausted`.

## Note per l'orchestratore / autore (feedback-router)

- I 4 verdict `conditional` producono altrettanti `task_package` per il dev-agent. `router.strategy = severity-tiered`, `max_diff_lines = 80`. Vincolo consigliato per ogni package: «fix only the findings listed; no opportunistic refactor».
- Blast radius pre-check **non eseguito**: `compression.context.enabled: false` e nessuno stato Graphify → comportamento v2.14 Fase 1 standard (nessun constraint downstream calcolato).
- **Priorità di sequenza**: TSK-026 **H-1** (transazione) prima di tutto; poi le tre M di design (TSK-025 M-1, TSK-026 M-2, TSK-027 M-1) che condividono il tema «single source of truth / DRY».
- **Prerequisito**: popolare `code_quality/rules/` (almeno le regole citate) prima di attivare i loop automatici, altrimenti i verdetti restano advisory e la detection anti-loop non ha baseline.

## Tema trasversale del batch

Il filo conduttore dei finding M è la **duplicazione di logica che dovrebbe avere un'unica fonte di verità**: schema di validazione (TSK-025), preparazione validazione swap (TSK-026), aritmetica RB-06 (TSK-027), key/mutazioni notifiche (TSK-028). Il codice è di buona qualità (tipizzazione solida, a11y curata, stati loading/empty/error completi, sicurezza IDOR/ownership corretta), ma tende a **ri-derivare** invece di **riusare** i moduli condivisi già presenti (`lib/zod`, `lib/rules/*`, pattern `*Keys`). Vale la pena codificare questo come regola team-specific una volta popolato il ruleset.

---

## Regole emergent proposte (candidate — gate umano per la promozione)

Elenco dei `rule_id` citati sopra, da creare in `code_quality/rules/emergent/<id>.md` con `status: candidate` (nessuno è stato scritto in questo run):

| rule_id (emergent) | Tier proposto | Sintesi |
|---|---|---|
| `robustness.db.transaction-atomicity` | canonical | Scritture DB multiple correlate devono essere in `db.transaction`. |
| `design.dry.duplicated-business-logic` | canonical | Logica di business (regole RB-*) non va ri-implementata: estrarre primitiva condivisa. |
| `design.validation.single-source-of-truth` | canonical | Schema di validazione FE/BE derivati da un'unica base. |
| `idiomaticity.data-fetching.query-key-factory` | team-specific | Data-fetching per feature centralizzato in hook + key factory; niente key magic-string. |
| `idiomaticity.react.native-confirm-vs-dialog` | team-specific | Conferme/dialoghi via componente del design system, non `window.confirm`; live-region solo per contenuto dinamico. |
| `robustness.ui.silent-mutation-outcome` | canonical | Ogni esito di mutation (incl. 4xx restituiti come dato) deve avere gestione UI esplicita. |
| `robustness.ui.invisible-error-feedback` | canonical | Gli errori devono essere percepibili anche visivamente, non solo `sr-only`. |
| `robustness.export.csv-formula-injection` | canonical | Export CSV: neutralizzare formula injection + localizzare separatori. |
| `idiomaticity.api.semantic-status-helper` | team-specific | Helper di risposta HTTP coerenti con lo status (no `ok()` per 4xx). |
| `design.reports.threshold-period-mismatch` | canonical | Soglie temporali confrontate solo con aggregati sullo stesso periodo. |
| `robustness.perf.in-memory-pagination` | team-specific | Evitare paginazione in-memory su dataset non limitati a monte. |
| `idiomaticity.ts.avoid-any-cast` | team-specific | Niente `as any`/eslint-disable quando la firma accetta `unknown`; augmentare i tipi di sessione. |
| `idiomaticity.date.dst-safe-helper-bypass` | team-specific | Usare `lib/date` per parse/format date; niente `new Date('YYYY-MM-DD')` diretto. |

---

*Report generato da code-reviewer (CQRL v2.12). I finding citano `rule_id` candidati (ruleset degradato). Verdetti advisory: nessun `reject`, nessun problema di sicurezza. La correttezza funzionale resta a `qa-dev`; il pass WCAG completo ad `a11y-specialist` (EP-007).*
