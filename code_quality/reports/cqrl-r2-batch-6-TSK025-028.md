# CQRL Code Review — Batch 6, Round 2 (TSK-025 → TSK-028)

- **Reviewer**: code-reviewer (CQRL v2.12, PATTERN §19)
- **Generated at**: 2026-07-14
- **Iter**: 2 (baseline: `code_quality/reports/cqrl-batch-6-TSK025-028.md`, iter 1)
- **Trigger**: comando esplicito `/review` batch (verifica fix round 1)
- **Scope round 2**: verificare i fix applicati (B5, B6) + ricontrollare i 4 finding residui dichiarati fuori-scope.
- **Passate eseguite**: robustezza → idiomaticità → design (focus mirato sui fix + residui; nessuna full-pass di regressione richiesta).
- **Ruleset**: ancora degradato (`code_quality/rules/{canonical,team-specific,emergent}/` contiene solo `.gitkeep`). I `rule_id` restano **candidate**; verdetti **advisory**. Baseline per no-progress/regression = report iter 1.

---

## Riepilogo verdetti round 2

| TSK | Fix applicati | Esito fix | Residui M | Verdict iter-2 | Δ vs iter-1 |
|---|---|---|---|---|---|
| TSK-025 | — (nessuno in scope) | n/a | M-1, M-2 invariati | **conditional** | invariato |
| TSK-026 | B5 (H-1), B6 | **entrambi corretti** | M-2 persiste (L-* residue) | **pass** | conditional → **pass** |
| TSK-027 | — (nessuno in scope) | n/a | M-1 persiste | **conditional** | invariato |
| TSK-028 | — (nessuno in scope) | n/a | M-1 persiste | **conditional** (near-pass) | invariato |

Nessun `reject`. Nessun finding di sicurezza. Nessun `loop-exhausted` (iter 2/3).
**Nessuna regressione** introdotta dai fix (verificato sui file toccati + import cross-modulo).

---

## Verifica fix applicati

### B5 — TSK-026: swap multi-write avvolto in `db.transaction` → **CORRETTO** ✅

File: `code/app/app/api/admin/swap/route.ts`

Il finding headline del batch (iter-1 **H-1**, atomicità multi-write) è **risolto correttamente**. Verifica puntuale:

1. **Le 4 write sono dentro un'unica transazione** [^src5: code/app/app/api/admin/swap/route.ts:127]:
   - `tx.update(shifts)` shift A (userId ← B) [:129]
   - `tx.update(shifts)` shift B (userId ← A) [:134]
   - `tx.insert(swapOperations)...returning()` [:140]
   - `tx.insert(auditLogs)` [:160]
2. **Tutte le operazioni usano `tx`, non `db`** — nessuna write sfugge alla transazione. Confermato: `db.transaction` è ora usato in 2 punti della codebase (swap + `absences/route.ts`), non più assente.
3. **Rollback su errore**: ogni step è `await`-ato dentro la callback; un rejection propaga, Drizzle (driver `postgres`) esegue ROLLBACK e ri-lancia. Un fallimento del 2° UPDATE, di un INSERT o un crash tra gli step **non lascia più il DB in stato parziale** (turno orfano / audit mancante). RF-F CA4 (atomicità swap ↔ riga audit) ora garantito.
4. **`insertAuditLog` correttamente inlineato** con `tx.insert(auditLogs)` [:160], con commento che ne motiva la scelta [:156]. Verifica di merito (non solo formale): la helper `insertAuditLog` **non era usabile qui** perché (a) usa `db` direttamente [^src5: code/app/lib/audit.ts:95] → connessione separata, fuori dalla transazione; (b) è fire-and-forget con `try/catch` che **ingoia** l'errore [^src5: code/app/lib/audit.ts:105] → un fallimento dell'audit non avrebbe fatto rollback, violando proprio CA4. L'inlining è quindi la scelta **giusta**, non una scorciatoia.
5. **Parità dei campi audit**: l'insert inlineato mappa gli stessi 8 campi della helper (`actorId, action, entityType, entityId, before, after, ip, userAgent`); `ip`/`userAgent` con `?? null`, `before`/`after` come oggetti non-null. Nessun campo perso.
6. **Snapshot pre-transazione**: `beforeA`/`beforeB` catturati con spread prima del `tx` [:124]; il valore di ritorno `op!` è usato fuori dalla transazione [:180]. Corretto.

**Bonus (regressione positiva)**: il vecchio iter-1 **L-6** (`as any` + `eslint-disable` sull'audit) è sparito — ora `as Record<string, unknown>` [:165, :170], esattamente la fix suggerita. L-6 **risolto** come side-effect.

**Nota minore (non bloccante, non regressione)**: non c'è `try/catch` attorno a `db.transaction` per convertire un fallimento in `ApiResponse.error(500)` pulito; un errore propaga come rejection non gestita → 500 di default Next.js. Comportamento identico a iter-1 (nessuna gestione errore prima), quindi **non è una regressione**. Advisory L: valutare un catch che ritorni una risposta strutturata.

### B6 — TSK-026*: `SelectItem value=""` → `value="__none__"` → **CORRETTO** ✅

File: `code/app/components/coverage/CoverageRuleModal.tsx`

- `shiftTypeId` [:254-263] e `dayOfWeek` [:287-296]: `SelectItem value=""` sostituito con `value="__none__"`. Nessun `SelectItem value=""` residuo nel file (Radix Select lancerebbe a runtime su value vuoto).
- Il round-trip è corretto: `value={field.value || '__none__'}` + `onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}` [:254-255, :287-288] → il form conserva `''` internamente e `onSubmit` mappa `'' → null` [:174-176]. Semantica «tutte le fasce / tutti i giorni» invariata.
- **Coerente con il pattern codebase-wide**: il sentinella `__none__` è già la convenzione in `UserForm`, `StaffModal`, `ShiftEditor`, `ConflictShiftList`, `RequestForm*` (grep conferma ≥10 usi). Il fix allinea `CoverageRuleModal` allo standard esistente.
- Grep di controllo: gli unici `value=""` residui (`ShiftSearchPanel`, `step2-RecurrenceSequenceStep`) sono su `<option>` HTML nativo, dove `value=""` è **legittimo** → non falsi positivi.

> **Discrepanza di tracciamento (segnalata, non bloccante)**: `CoverageRuleModal.tsx` è marcato **TSK-018** nell'header [:4] e **non compariva** nel report iter-1 di questo batch (TSK-025–028). B6 proviene verosimilmente dal tracking di batch-4 (TSK-017–020). Il fix è stato comunque verificato ed è corretto; segnalo l'attribuzione al TSK errato solo per igiene del report.

---

## Verifica finding residui (dichiarati fuori-scope fix — attesi ancora presenti)

Tutti e 4 i residui erano `M` in iter-1 con nota «fix consigliato nel prossimo giro». Il round 2 li ha **consapevolmente esclusi** dal task package (scope = solo B5/B6). Confermo lo stato; **non attivo no-progress detection** perché il dev-agent ha eseguito esattamente ciò che gli è stato richiesto — la persistenza non è «mancato progresso» ma «rinvio deliberato» (decisione di scoping dell'orchestratore, gate umano §7).

### TSK-025 M-1 — Doppio schema validazione FE/BE → **ANCORA PRESENTE**
`availabilityFormSchema` (flat + `superRefine`) resta «mirror» esplicito di `availabilityCreateSchema` [^src5: code/app/app/(employee)/availability/_components/AvailabilityForm.tsx:51]; il BE usa lo schema con `.refine()` [^src5: code/app/lib/zod/index.ts:374]. Nessuna base condivisa (`buildAvailabilitySchema`) estratta. Rischio di divergenza silenziosa invariato.
`[^rule: emergent/design.validation.single-source-of-truth §Rationale (candidate)]`

### TSK-025 M-2 — `window.confirm()` nativo → **ANCORA PRESENTE**
`AvailabilityCard.handleDelete` usa ancora `confirm('Eliminare questa voce di disponibilità?')` [^src5: code/app/app/(employee)/availability/_components/AvailabilityCard.tsx:91] (riga 105→91, contenuto invariato). Non migrato al wrapper `AlertDialog` del design system.
`[^rule: emergent/idiomaticity.react.native-confirm-vs-dialog §Rationale (candidate)]`

> **Correzione di attribuzione**: il residuo «`confirm()` nativo» richiesto per **TSK-026** è in realtà di **TSK-025** (`AvailabilityCard`). Il flusso swap di TSK-026 **usa correttamente `AlertDialog`** (Radix) in `SwapConfirmDialog` [^src5: code/app/app/(admin)/swap/_components/SwapConfirmDialog.tsx:41] — nessun `window.confirm` nativo lì. Verifica esplicita eseguita: nessun `confirm(` nativo nell'albero swap.

### TSK-027 M-1 — Aritmetica RB-06 riscritta invece di condivisa → **ANCORA PRESENTE**
`calculateOvertimeForPeriod` resta re-implementato nel route [^src5: code/app/app/api/admin/reports/overtime/route.ts:74]; il route **non importa** da `lib/rules`. La divergenza aritmetica persiste **ed è confermata**: il report usa `Math.round((end-start)/60_000)` [:88] mentre `lib/rules/calculateOvertime.ts` usa `differenceInMinutes` (troncamento) [^src5: code/app/lib/rules/calculateOvertime.ts:42,45] → scarto ±1 min possibile tra report e validazione turni. Nessuna primitiva pura condivisa estratta. Questo è il residuo con la maggiore componente di **correttezza** (non solo DRY) → motivo principale del `conditional` su TSK-027.
`[^rule: emergent/design.dry.duplicated-business-logic §Rationale (candidate)]`

### TSK-028 M-1 — Data-fetching notifiche non centralizzato → **ANCORA PRESENTE**
Nessun `notificationKeys` factory. `markNotificationRead` duplicato verbatim in `NotificationBell` [^src5: code/app/components/notifications/NotificationBell.tsx:49] e `NotificationItem` [^src5: code/app/app/(employee)/notifications/_components/NotificationItem.tsx:40]; `markAllRead` duplicato in `NotificationBell` [:86] e `MarkAllReadButton` [^src5: code/app/app/(employee)/notifications/_components/MarkAllReadButton.tsx:17]. La magic-string `['notifications']` resta ripetuta in ≥8 punti (incl. `useNotifications.ts`). `hooks/useNotifications.ts` è solo il subscriber SSE (TSK-008), non un modulo hook+key-factory per feature. Cross-invalidazione bell↔centro tuttora **funzionante** (partial match) → fragilità futura, non bug attuale → è il residuo più vicino a essere accettato come debito.
`[^rule: emergent/idiomaticity.data-fetching.query-key-factory §Rationale (candidate)]`

---

## Motivazione dei verdict

- **TSK-026 → `pass`**: entrambi i fix in scope (B5/B6) sono corretti; il finding **bloccante** del batch (H-1 atomicità) è risolto e verificato in profondità; L-6 risolto come bonus. Resta **M-2** (dedup prepare-validation preview↔exec — ancora duplicato verbatim, nessun `prepareSwapValidation.ts` estratto) + L-3/L-4/L-5. Poiché **nessun finding bloccante permane** e i residui sono debito di design/robustezza, promuovo a `pass` con M-2 e le L convertite a **debito tecnico tracciato** (raccomando log in `wiki/gaps.md`). Continuare il loop sul refactor DRY dello swap-prep consumerebbe iterazioni per un ritorno marginale, mentre il rischio reale (corruzione DB) è eliminato.
- **TSK-025 / TSK-027 / TSK-028 → `conditional` (invariato)**: nessun fix applicato in scope, i finding `M` (sopra la soglia advisory `L`) permangono immutati. Restano `conditional` in modo onesto: segnalano che gli M meritano ancora intervento. La decisione se schedulare un iter-3 mirato **oppure** accettarli come debito è **umana** (§7 gate; verdict `conditional` non è auto-bloccante).

---

## Loop status

- Iter **2/3** (`max_iterations = 3`) per tutti e 4 i TSK. TSK-026 esce dal loop (`pass`).
- **No-progress detection**: NON attivata. I residui M ripetono lo stesso `rule_id` di iter-1 su TSK-025/027/028, ma il dev-agent ha completato esattamente lo scope assegnato (B5/B6); la persistenza è rinvio deliberato, non stallo. Attivare l'escalation qui sarebbe un falso positivo.
- **Attenzione budget**: se un iter-3 rinviasse ancora gli M di TSK-025/027/028, il loop (max 3) sarebbe **quasi esaurito**. Raccomando che l'umano decida **ora** tra (a) task package mirato iter-3 sugli M, oppure (b) accettazione formale a debito → chiusura a `pass`. Evitare di «bruciare» iter-3 su un rinvio implicito.
- **Regression detection**: nessuna. I fix B5/B6 sono contenuti nei rispettivi file; nessun nuovo finding in file non toccati. Import cross-modulo verificati (`lib/audit`, `db/schema`, `@/components/ui/select`).
- Nessun finding di sicurezza → nessun incident, nessuno STOP `reject`.

## Note per l'orchestratore / feedback-router

- **TSK-026**: nessun ulteriore `task_package`; verdict `pass`. Consigliato aggiornare frontmatter `review_status: passed`, `review_iter: 2`, `review_report: code_quality/reports/cqrl-r2-batch-6-TSK025-028.md`. M-2 + L-3/L-4/L-5 → debito in `wiki/gaps.md`.
- **TSK-025/027/028**: decisione umana richiesta (fix mirato iter-3 vs accettazione debito). Se fix: `router.strategy = severity-tiered`, `max_diff_lines = 80`, vincolo «fix only the listed findings; no opportunistic refactor». Priorità suggerita: **TSK-027 M-1** (ha risvolto di correttezza ±1 min) > TSK-025 M-1/M-2 > TSK-028 M-1 (fragilità, non bug).
- **Blast radius pre-check**: non eseguito (`compression.context.enabled: false`, nessuno stato Graphify) → comportamento v2.14 Fase 1 standard.
- **Prerequisito ancora aperto**: popolare `code_quality/rules/` prima di attivare loop automatici; i verdetti restano advisory finché i `rule_id` citati sono `candidate`.

---

*Report generato da code-reviewer (CQRL v2.12), round 2. Fix B5/B6 verificati corretti; H-1 (atomicità) risolto; TSK-026 → pass. Residui M consapevolmente rinviati su TSK-025/027/028 → conditional, decisione umana. Nessun problema di sicurezza. Correttezza funzionale resta a `qa-dev`; pass WCAG completo ad `a11y-specialist`.*
