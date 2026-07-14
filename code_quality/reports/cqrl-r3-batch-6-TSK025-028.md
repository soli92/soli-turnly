# CQRL Code Review — Batch 6, Round 3 (TSK-025 → TSK-028) — ITER FINALE

- **Reviewer**: code-reviewer (CQRL v2.12, PATTERN §19)
- **Generated at**: 2026-07-14
- **Iter**: 3 / 3 (`max_iterations = 3`) — **ULTIMA ITERAZIONE**
- **Baseline**: `code_quality/reports/cqrl-r2-batch-6-TSK025-028.md` (iter 2)
- **Trigger**: comando esplicito `/review` batch (verifica fix round 3)
- **Scope round 3**: verificare i fix applicati agli M residui + regressione su TSK-026 (già `pass`).
- **Passate eseguite**: robustezza → idiomaticità → design (focus mirato sui fix + regressione sui file toccati).
- **Ruleset**: `code_quality/rules/emergent/` è ora **popolato** (non più solo `.gitkeep`); i `rule_id` citati esistono con `status: candidate` → verdetti ancora **advisory** finché non promossi a `active`/`canonical` (gate umano §19.5). `canonical/` e `team-specific/` restano vuoti.
- **Decisioni umane recepite (input orchestratore)**: TSK-025 M-1 e TSK-027 M-1 (componente DRY) **accettati come debito tecnico** → NON contano come finding aperti bloccanti in questo giro.

---

## Riepilogo verdetti round 3 (FINALE)

| TSK | Finding tracciato iter-2 | Fix iter-3 | Esito | Verdict iter-3 | Δ vs iter-2 |
|---|---|---|---|---|---|
| TSK-025 | M-1 (doppio schema), M-2 (`window.confirm`) | M-2 → `AlertDialog`; M-1 → accept-as-debt | M-2 **corretto**, M-1 **debito** | **pass** | conditional → **pass** |
| TSK-026 | (già pass) | — | **nessuna regressione** | **pass** | invariato |
| TSK-027 | M-1 (overtime duplicata + ±1 min) | arithmetic allineata a `differenceInMinutes`; DRY → accept-as-debt | correttezza **risolta**, DRY **debito** | **pass** | conditional → **pass** |
| TSK-028 | M-1 (key-factory assente + mutation duplicate) | `useNotificationMutations.ts` + `notificationKeys` | **corretto** | **pass** | conditional → **pass** |

**Esito batch: 4/4 `pass`.** Nessun `reject`. Nessun finding di sicurezza. Nessuna regressione. Loop chiuso a iter 3/3 **senza** attivare `loop-exhausted` (non è stato necessario forzare alcun reject).

---

## Verifica fix applicati

### TSK-025 M-2 — `window.confirm()` → `AlertDialog` (Radix) → **CORRETTO** ✅

File: `code/app/app/(employee)/availability/_components/AvailabilityCard.tsx`

- Il `confirm('Eliminare questa voce di disponibilità?')` nativo è **sparito**; sostituito con `AlertDialog` del design system [^src5: code/app/app/(employee)/availability/_components/AvailabilityCard.tsx:168] + stato locale `confirmOpen` (`useState`) [:100].
- Flusso corretto: bottone elimina → `onClick={() => setConfirmOpen(true)}` [:132]; `AlertDialogAction` → `deleteAvailability.mutate(row.id, { onSettled: () => setConfirmOpen(false) })` [:180-181]; `AlertDialogCancel` per annullare [:177].
- Import puliti da `@/components/ui/alert-dialog` (componente esistente, verificato: `code/app/components/ui/alert-dialog.tsx`). Nessun import morto.
- A11y preservata/migliorata: `AlertDialogTitle` + `AlertDialogDescription` con il dettaglio della voce [:171-174]; bottoni con `disabled={deleteAvailability.isPending}`.
- **Grep di controllo**: nessun `window.confirm` / `confirm(` / `alert(` / `prompt(` nativo residuo in `app/`, `components/`, `hooks/`. Il finding è chiuso a livello codebase, non solo nel file.

> **Nota advisory (L, non bloccante)**: `AlertDialogAction` di Radix agisce da *close trigger* di default → il dialog si chiude immediatamente al click, quindi lo stato `isPending` sui bottoni (`disabled`) non è visibile durante la mutation (chiusura ottimistica). Comportamento accettabile per un delete; se in futuro si volesse mostrare lo spinner dentro il dialog, servirebbe `onSelect={(e) => e.preventDefault()}` e chiusura esplicita in `onSettled`. Non blocca il `pass`.

### TSK-028 M-1 — Data-fetching notifiche centralizzato → **CORRETTO** ✅

Nuovo file: `code/app/hooks/useNotificationMutations.ts`

- **`notificationKeys` factory** [^src5: code/app/hooks/useNotificationMutations.ts:22]: `all()` → `['notifications']`, `list()` → `['notifications','list']`, `center()` → `['notifications','center']`, tutte `as const` (immutabili, componibili). La magic-string `['notifications']` è ora definita **in un solo punto**.
- **`useMarkRead()`** [:54] e **`useMarkAllRead()`** [:68]: `useMutation` con `mutationFn` privato (`markNotificationReadApi` / `markAllReadApi`) + `onSuccess` che invalida `notificationKeys.all()` → aggiorna sia campanella sia centro (partial-match). Le due `fetch` PATCH duplicate verbatim in iter-2 sono state accentrate qui.
- **Consumatori migrati (tutti)**:
  - `components/notifications/NotificationBell.tsx` → usa `notificationKeys.all()`, `useMarkRead`, `useMarkAllRead` [^src5: code/app/components/notifications/NotificationBell.tsx:26,60,66-67]. Le mutation inline sono sparite.
  - `app/(employee)/notifications/_components/NotificationItem.tsx` → `useMarkRead` [^src5: code/app/app/(employee)/notifications/_components/NotificationItem.tsx:19,45].
  - `app/(employee)/notifications/_components/MarkAllReadButton.tsx` → `useMarkAllRead` [^src5: code/app/app/(employee)/notifications/_components/MarkAllReadButton.tsx:14,18].
  - `app/(employee)/notifications/_components/NotificationCenterClient.tsx` → `notificationKeys.center()` [^src5: code/app/app/(employee)/notifications/_components/NotificationCenterClient.tsx:21,62].
  - `hooks/useNotifications.ts` (SSE subscriber) → tutte le invalidazioni notifiche usano `notificationKeys.all()` [^src5: code/app/hooks/useNotifications.ts:26,51].
- **Grep di controllo**: nessuna occorrenza residua di `['notifications']` come literal fuori dalla factory (le uniche restanti sono in commenti descrittivi). Cross-invalidazione bell↔centro **corretta**: `center()` è un sottoinsieme di `all()`, quindi `invalidateQueries(all())` propaga a entrambi.

> **Nota advisory (L, non bloccante)** `[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Detection (candidate)]`: `notificationKeys.list()` è definito ma **mai usato** — `NotificationBell` interroga con `all()` invece di `list()` (funzionalmente corretto, ma il membro `list()` è orfano e il commento della factory lo descrive come «chiave preview campanella»). Suggerito: usare `list()` nel Bell **oppure** rimuovere il membro. Micro-debito, non blocca il `pass`.

### TSK-027 M-1 — Aritmetica RB-06 nel report overtime → correttezza **RISOLTA**, DRY **a debito** ✅/📌

File: `code/app/app/api/admin/reports/overtime/route.ts`

- Il route **non importa** una pure function condivisa da `lib/rules/` — mantiene il proprio `calculateOvertimeForPeriod` [:74]. La **duplicazione strutturale** persiste.
- **MA la componente di correttezza — il motivo principale del `conditional` iter-2 — è risolta**: il route ora calcola i minuti con `Math.max(0, differenceInMinutes(shift.endDt, shift.startDt))` [:88], con commento esplicito che ne dichiara l'allineamento a `calculateOvertime.ts` [:86-87]. In iter-2 usava `Math.round((end-start)/60_000)` → scarto ±1 min. Ora **entrambi** (report + `lib/rules/calculateOvertime.ts:42,45`) usano `differenceInMinutes` (troncamento): lo scarto ±1 min tra report e validazione turni è **eliminato**. Verifica incrociata: `startOfISOWeek` + soglia `contractHours*60` coerenti tra i due.
- **Sul residuo DRY (accettato come debito)**: va notato che le due funzioni non sono un vero copia-incolla — `calculateOvertime` (`lib/rules`) è validazione *incrementale per singolo turno* su una settimana ISO, mentre il route è *aggregazione di periodo* per report. Condividono la primitiva (bucket settimana ISO + `differenceInMinutes` + soglia contrattuale), non l'intero corpo. Ora che l'aritmetica è unificata, il rischio di divergenza silenziosa è ridotto al minimo; l'estrazione di una primitiva comune in `lib/` resta la remediation ideale ma è un miglioramento marginale.
- **Debito da tracciare** `[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Remediation (candidate)]`: incapsulare in `lib/rules/` (o `lib/`) il bucketing settimanale ISO come primitiva pura riusata da entrambi i call-site. → `wiki/gaps.md`.

### TSK-025 M-1 — Doppio schema Zod FE/BE → **ACCETTATO COME DEBITO** 📌

- `availabilityFormSchema` (FE, flat + `superRefine`) resta un mirror esplicito di `availabilityCreateSchema` (BE, `.refine()`); nessuna base condivisa (`buildAvailabilitySchema`) estratta. Stato invariato rispetto a iter-2 — **come da decisione umana**.
- Recepita l'accettazione a debito (input orchestratore): **non conta come finding aperto bloccante** in iter-3. Verdict TSK-025 non ne è vincolato.
- **Debito da tracciare** `[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale (candidate)]`: estrarre lo schema payload in `lib/zod/` e riusarlo sia nel form (`zodResolver`) sia nel Route Handler (invariante T-INT-01 dello stack). → `wiki/gaps.md`.

---

## Regressione — TSK-026 (già `pass` in iter-2)

Controllo mirato sui file del finding headline del batch (H-1 atomicità), **nessuna regressione**:

- `code/app/app/api/admin/swap/route.ts`: le 4 write restano avvolte in un'unica `db.transaction` [^src5: code/app/app/api/admin/swap/route.ts:127] — 2× `tx.update(shifts)` [:129,:134], `tx.insert(swapOperations)...returning()` [:140], `tx.insert(auditLogs)` inline [:160]. Tutte su `tx`, non `db`. Snapshot `beforeA`/`beforeB` pre-transazione [:124-125] intatto.
- Il fix bonus di iter-2 (`as Record<string, unknown>` al posto di `as any`) è **preservato** [:165,:170]. Il commento che motiva l'inlining dell'audit resta [:156-159].
- `CoverageRuleModal.tsx` (B6, sentinella `__none__`): non toccato in iter-3, nessuna regressione attesa né rilevata.

---

## Motivazione dei verdict (finale)

- **TSK-025 → `pass`**: l'unico finding con azione richiesta in scope (M-2, `window.confirm`) è **risolto** e verificato codebase-wide. M-1 è **debito accettato dall'umano** → non bloccante. Nessun finding aperto sopra soglia advisory. Le due note L (chiusura ottimistica del dialog) sono cosmetiche.
- **TSK-026 → `pass`** (invariato): nessun fix in scope; **nessuna regressione** sui file del finding critico già risolto.
- **TSK-027 → `pass`**: il residuo era un M «ibrido» (DRY + correttezza). La **componente di correttezza** (scarto ±1 min, la parte che teneva il verdict a `conditional`) è **risolta** con l'allineamento a `differenceInMinutes`. La sola **componente DRY** resta come **debito accettato**. Con la correttezza garantita, non c'è motivo di trattenere il verdict.
- **TSK-028 → `pass`**: la key-factory + mutation hooks eliminano la duplicazione verbatim e la magic-string ripetuta; tutti i consumatori migrati; cross-invalidazione corretta. Resta solo un micro-debito L (`list()` orfano).

---

## Loop status (chiusura)

- Iter **3/3** — **ultima**. Tutti e 4 i TSK escono dal loop con verdict `pass`. **Nessun `loop-exhausted`**, **nessun `reject` forzato**: il budget si chiude perché i finding sono risolti o accettati a debito, non perché esaurito.
- **No-progress detection**: NON attivata. Gli M che persistevano (TSK-025 M-1, TSK-027 M-1 DRY) sono ora **accettazioni formali a debito** (decisione umana §7), non stallo del dev-agent. I finding con azione richiesta (M-2, key-factory, correttezza overtime) hanno **progredito e sono chiusi**.
- **Regression detection**: nessuna. Fix contenuti nei rispettivi file/modulo; `db.transaction` di TSK-026 preservato; import cross-modulo verificati (`@/hooks/useNotificationMutations`, `@/components/ui/alert-dialog`, `date-fns`, `@/db/schema`). Nessun nuovo finding in file non toccati dalle fix.
- **Blast radius pre-check**: non eseguito (`compression.context.enabled: false`, nessuno stato Graphify) → comportamento v2.14 Fase 1 standard.
- Nessun finding di sicurezza → nessun incident, nessuno STOP `reject`.

---

## Note per l'orchestratore / feedback-router

- **Nessun ulteriore `task_package`**: batch chiuso. Aggiornare i frontmatter dei 4 TSK:
  - `review_status: passed`, `review_iter: 3`, `review_report: code_quality/reports/cqrl-r3-batch-6-TSK025-028.md`, `updated: 2026-07-14` (TSK-026: `review_iter: 2` invariato oppure allineato a 3 per coerenza batch — a discrezione dell'orchestratore).
- **Debito tecnico da loggare in `wiki/gaps.md`** (nessuno bloccante):
  1. TSK-025 M-1 — schema Zod FE/BE non condiviso (`fe.domain.shared-rule-duplication`).
  2. TSK-027 M-1 — bucketing settimana ISO non estratto come primitiva `lib/` (`fe.domain.shared-rule-duplication`); correttezza già allineata.
  3. TSK-028 — `notificationKeys.list()` orfano (`general.dead-broken-code`): usarlo nel Bell o rimuoverlo.
  4. TSK-025 — `AlertDialogAction` chiusura ottimistica (nessun `isPending` visibile in-dialog): cosmetico.
- **Promozione regole**: `emergent/*` citate restano `candidate`. Valutazione promozione a `canonical` è **gate umano** (§19.5 step 4) — fuori scope di questo run.
- **Correttezza funzionale** (test) resta a `qa-dev`; **pass WCAG completo** ad `a11y-specialist` (il migrato `AlertDialog` andrà ricoperto dagli acceptance/a11y spec).

---

*Report generato da code-reviewer (CQRL v2.12), round 3 (finale). TSK-025/027/028 promossi a `pass`: M-2 (dialog) e M-1 overtime (correttezza) risolti; TSK-025 M-1 e TSK-027 M-1 (DRY) accettati a debito per decisione umana; TSK-028 key-factory corretta. TSK-026 `pass` senza regressioni. Nessun problema di sicurezza. Verdetti advisory (ruleset `emergent` candidate).*
