# CQRL Code Review — TSK-026 (Swap admin page + POST /api/admin/swap)

- **tsk_id**: TSK-026
- **title**: Swap admin page — selezione turni + anteprima impatto + implementazione POST /api/admin/swap
- **layer**: fe+be · **estimate**: L
- **stack_descriptor**: `typescript@strict / next15-app-router(RSC+client) / drizzle-orm(postgres) / @tanstack/react-query / zod / shadcn(radix) / react19`
- **stack_confidence**: alta (segnali espliciti: `package`/import verificati) — **≥ confidence_min 0.6** → review **stack-aware full** (nessuna modalità degradata)
- **iter**: ad-hoc `/review` override (TSK già `review_status: passed`, review_iter 2/3 nei batch precedenti)
- **generated_at**: 2026-07-15
- **reviewer_version**: CQRL v2.12 (PATTERN §19)
- **ruleset**: solo `emergent/*` (tutte `status: candidate`); `canonical/` e `team-specific/` vuote → **finding advisory**

---

## 1. Scope revisionato

FE (`code/app/app/admin/swap/`):
- `page.tsx` (RSC), `_components/SwapAdminPageClient.tsx`, `ShiftSearchPanel.tsx`, `SelectedShiftCard.tsx`, `SwapImpactPreview.tsx`, `SwapViolationSummary.tsx`, `SwapConfirmDialog.tsx`
- `hooks/useSwap.ts`

BE:
- `app/api/admin/swap/route.ts` (POST), `app/api/admin/swap/preview/route.ts` (GET)
- `lib/rules/validateSwap.ts` (+ regole RB-01/05/08 sotto-invocate), `lib/rules/types.ts`
- `lib/zod/index.ts` (`swapCreateSchema`), `lib/api-response.ts`, `lib/audit.ts`, `db/schema.ts` (`swap_operations`)

Test: `lib/rules/__tests__/validateSwap.test.ts` (unit puro), `tests/visual/sprint3/swap-admin.spec.ts` (visual).

---

## 2. Verdict summary

| Severità | Conteggio |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 6 |

**Verdict: `conditional`**

Il codice è ben costruito (atomicità DB già risolta in iter precedenti, tipizzazione solida `exactOptionalPropertyTypes`, a11y curata, stati loading/empty/error completi, guard admin coerenti). Tuttavia una revisione indipendente approfondita rileva **un difetto funzionale non intercettato nei giri batch precedenti** (H-1: la "parte A/B" non viene mai mostrata → AC RF-F CA1 solo parzialmente soddisfatto) più gap di robustezza/error-handling e di copertura test. Non `pass`; non `reject` (nessun problema di correttezza dato-distruttivo né di sicurezza).

---

## 3. Findings (prioritizzati)

### 🔴 H-1 — La "parte coinvolta (A/B)" non viene MAI visualizzata → AC RF-F CA1 non pienamente soddisfatto
**Pass**: design + robustezza · **Severità: High**

Il docstring di `SwapViolationSummary` dichiara che «ogni voce indica: **Parte coinvolta (A o B)**, ID regola, messaggio» [^src5: code/app/app/admin/swap/_components/SwapViolationSummary.tsx:9]. Il codice deriva `party` così:

```ts
const party = violation.affectedUserId
  ? violation.affectedUserId.includes('-') ? null : violation.affectedUserId
  : null;
```
[^src5: code/app/app/admin/swap/_components/SwapViolationSummary.tsx:58]

`affectedUserId` è **sempre** un userId (le regole lo settano a `input.userId` [^src5: code/app/lib/rules/validateNoOverlap.ts:40] [^src5: code/app/lib/rules/validateWeeklyHours.ts:55] [^src5: code/app/lib/rules/validateNoShiftOnAbsence.ts:34]) e in produzione è un UUID → `.includes('-')` è **sempre true** → `party` è **sempre `null`** → il badge `Parte {party}` non si renderizza **mai**. Anche eliminando il quirk dell'hyphen, mostrerebbe l'UUID grezzo, mai `A`/`B`.

Causa a monte: la pipeline non annota mai la violation con la parte. Lo spec TSK-026 definisce esplicitamente il contratto di risposta `blocking: [{ party: 'A'|'B', rule, message }]` [management/kanban/TSK-026.md:57], ma `RuleViolation` **non ha** il campo `party` [^src5: code/app/lib/rules/types.ts:29] e le route restituiscono le violation grezze [^src5: code/app/app/api/admin/swap/route.ts:104] [^src5: code/app/app/api/admin/swap/preview/route.ts:90]. L'informazione per mappare `affectedUserId → A/B` esiste nel client (`selectionA.user.id` / `selectionB.user.id`) ma non è cablata fino a `SwapViolationSummary`.

Impatto: RF-F CA1 richiede «UI mostra **quale parte** e quale regola». *Quale regola*: OK (badge `ruleId`). *Quale parte*: **mai mostrata**. Per uno swap in cui, es., B supererebbe l'hard cap 48h, l'admin non distingue se il problema è di A o di B — vanificando parte dello scopo dell'anteprima.

**Remediation**: annotare la violation con la parte a livello API (`party: shiftA.userId === affectedUserId ? 'A' : 'B'`) oppure passare la mappa `{ [userId]: 'A'|'B' }` a `SwapViolationSummary` e derivare il badge da lì; rimuovere la logica `.includes('-')`.
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]` (docstring dichiara "Parte A/B" non implementata; contratto `party` dello spec non realizzato)

---

### 🟠 M-1 — Esito `rejected`/`warnings` del POST ingoiato silenziosamente in `onSuccess`
**Pass**: robustezza (error-handling) · **Severità: Medium**

`useExecuteSwap` **non lancia** sul 422: restituisce il body come dato [^src5: code/app/hooks/useSwap.ts:141]. In `SwapAdminPageClient.doExecuteSwap`, `onSuccess` gestisce **solo** `outcome === 'executed'` [^src5: code/app/app/admin/swap/_components/SwapAdminPageClient.tsx:113]; i rami `rejected` e `warnings` chiudono soltanto il dialog senza mostrare nulla. In finestra TOCTOU (l'anteprima ha `staleTime: 30s` [^src5: code/app/hooks/useSwap.ts:82]) o quando lo stato server diverge, il server può rispondere 422 `rejected` o 200 `warnings` inattesi: `isError` resta `false`, il dialog si chiude e **l'admin non riceve alcun feedback** — il pulsante torna abilitato e "non succede niente".

**Remediation**: nel `onSuccess` gestire esplicitamente `rejected` (mostrare le `blocking` restituite dal server) e `warnings` (riaprire il `SwapConfirmDialog` con le warning server-side).
`[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Detection]` (rami di esito effettivamente inerti) — *pattern non pienamente coperto: candidato a nuova regola `robustness.fe.swallowed-server-outcome`*

---

### 🟠 M-2 — Preparazione input `validateSwap` duplicata verbatim tra POST e preview (DRY)
**Pass**: design · **Severità: Medium** *(già segnalato in round 1 come M-2; risulta ancora aperto)*

Il blocco «carica shifts+absences dei due utenti → `toExistingShift` → `validateSwap(...)`» è **duplicato quasi identico** tra esecuzione [^src5: code/app/app/api/admin/swap/route.ts:69] e anteprima [^src5: code/app/app/api/admin/swap/preview/route.ts:55]. Rischio insidioso: preview ed esecuzione possono **divergere** se query/mapping cambiano in un solo file, vanificando lo scopo dell'anteprima (mostrare esattamente ciò che accadrà). La preview valida inoltre gli UUID via regex manuale [^src5: code/app/app/api/admin/swap/preview/route.ts:34] mentre il POST usa `swapCreateSchema` [^src5: code/app/lib/zod/index.ts:244] → due contratti di validazione input non allineati.

**Remediation**: estrarre `lib/rules/prepareSwapValidation.ts` (o helper `lib/`) che, dati `shiftAId`/`shiftBId`, ritorni l'input di `validateSwap`; usarlo in entrambe le route. Uniformare la validazione dei parametri (uno schema Zod per la query preview).
`[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale]` (single-source-of-truth; qui duplicazione BE↔BE)
> Nota: nei round batch precedenti finding DRY analoghi (TSK-025/027) sono stati **accettati a debito per decisione umana**. Segnalo comunque per completezza; la disposizione resta scelta umana.

---

### 🟠 M-3 — Nessun test automatico per il flusso API/AC dello swap
**Pass**: robustezza (test coverage) · **Severità: Medium** · *delego a `qa-dev`, non scrivo test*

`validateSwap.test.ts` copre bene la pure function RB-10 (T-SWP-01 valido/overlap, T-SWP-02 assenza, stesso utente) [^src5: code/app/lib/rules/__tests__/validateSwap.test.ts:18]. Ma **nessun test** copre gli AC dichiarati del TSK a livello route/flow:
- POST da non-admin → 403 (AC) — logica presente [^src5: code/app/app/api/admin/swap/route.ts:38] ma non testata.
- blocking → 422 + DB invariato (RF-F CA1).
- solo warnings senza `confirm` → `requiresConfirmation` / con `confirm=true` → eseguito (RF-F CA2).
- swap eseguito → `userId` scambiati nel DB + riga `swap_operations` con `origin='admin'` (AC principale) + riga `audit_log` con `action='swap.admin'` (RF-F CA4).

Il `swap-admin.spec.ts` è **solo visual regression** (screenshot) [^src5: code/app/tests/visual/sprint3/swap-admin.spec.ts:1], senza asserzioni funzionali sul flusso.

**Remediation** (per `qa-dev`): test d'integrazione sulle due route (403/422/CA2/CA4, scambio `userId`, audit).
`[^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Detection]`

---

### 🟠 M-4 — TOCTOU / assenza di lock ottimistico sullo swap concorrente
**Pass**: robustezza · **Severità: Medium** *(bassa probabilità — admin-only; era L-5 in round 1)*

Le letture di `shiftA`/`shiftB` e di `allShifts`/`absences` avvengono **fuori** dalla transazione [^src5: code/app/app/api/admin/swap/route.ts:57]; la transazione esegue UPDATE **incondizionati** (`.where(eq(shifts.id, shiftIdA))`) [^src5: code/app/app/api/admin/swap/route.ts:129] senza `FOR UPDATE`/controllo di versione/`updatedAt`. La validazione RB-10 è quindi calcolata su dati potenzialmente stantii; in concorrenza (due admin, o admin + job ricorrenze) uno swap può sovrascrivere una modifica intermedia (lost update) e persistere uno stato che RB-10 non ha realmente validato.

**Remediation**: guardia ottimistica nell'UPDATE (`and(eq(shifts.id, shiftIdA), eq(shifts.userId, shiftA.userId))`) verificando il rowCount, oppure `SELECT ... FOR UPDATE` sui due turni dentro la transazione e ri-validazione. L'atomicità (all-or-nothing) è **già garantita** dalla `db.transaction` — manca l'**isolamento**.
`[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Rationale]` (gap robustezza; *candidato a regola `robustness.db.optimistic-lock` — non presente nel ruleset*)

---

### 🟡 Low (nit / debito minore)

- **L-1 — Path docstring & `code_path` del TSK errati (`(admin)` vs `admin/`)**: tutti i docstring dei componenti dichiarano `app/(admin)/swap/...` [^src5: code/app/app/admin/swap/page.tsx:1] ma il percorso reale è `app/admin/swap/...` (nessun route group). Anche il frontmatter TSK `code_path: code/app/app/(admin)/swap/` punta a una dir inesistente → rompe tooling che risolve `code_path` (dispatch/blast-radius). `[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Detection]`
- **L-2 — Parametri morti in `SwapInput`**: `contractHoursA`/`contractHoursB` sono dichiarati [^src5: code/app/lib/rules/validateSwap.ts:31] ma `validateSwap` non li estrae né li passa ad alcuna regola (RB-05 usa cap fissi 40/48h, non le ore contrattuali) [^src5: code/app/lib/rules/validateSwap.ts:43]. Rimuovere o cablare. `[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Detection]`
- **L-3 — "Guest shift" inerte in `validateSwap`**: `existingForA`/`existingForB` aggiungono il turno-ospite `{ ...shiftA, userId: shiftB.userId }` [^src5: code/app/lib/rules/validateSwap.ts:64], ma esso ha lo stesso `id` dell'input validato → è **sempre** escluso da tutte le regole via `s.id !== input.id` [^src5: code/app/lib/rules/validateNoOverlap.ts:22]. Codice difensivo che non contribuisce mai: semplificabile a `existingExcludingSwap` (chiarezza).
- **L-4 — `ShiftSearchPanel`: `<select>`/`<input type=date>` nativi vs spec "autocomplete + date picker"**: lo spec chiede autocomplete utenti + date picker [management/kanban/TSK-026.md:38]; l'implementazione usa controlli nativi [^src5: code/app/app/admin/swap/_components/ShiftSearchPanel.tsx:78] (sceglie di evitare il pitfall Radix empty-value — scelta legittima) ma non è un autocomplete e non usa il design system shadcn `Select`. Inoltre gli `id` contengono spazi (`user-select-Dipendente A`) [^src5: code/app/app/admin/swap/_components/ShiftSearchPanel.tsx:79] — valido in HTML5 ma sconsigliato. `[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Detection]`
- **L-5 — Semantica HTTP/UX minori**: `ApiResponse.ok({...}, 422)` usa l'helper "ok" per un 422 [^src5: code/app/app/api/admin/swap/route.ts:102] (manca un helper `unprocessableEntity` in `api-response.ts`); `redirect('/login')` per un utente **autenticato** non-admin [^src5: code/app/app/admin/swap/page.tsx:44] dovrebbe essere un 403/pagina "forbidden".
- **L-6 — Guardia ridondante**: `!validationResult.valid && validationResult.blocking.length > 0` [^src5: code/app/app/api/admin/swap/route.ts:101] — `valid` è `false` sse e solo se esiste una blocking (vedi `mergeResults` [^src5: code/app/lib/rules/types.ts:65]); la prima condizione è ridondante.

---

## 4. Verifica RB-10 (richiesta esplicita)

`validateSwap` implementa RB-10 in modo **sostanzialmente corretto**: costruisce i due input post-swap (`inputAtoB` con `userId = shiftB.userId`, `inputBtoA` con `userId = shiftA.userId`) [^src5: code/app/lib/rules/validateSwap.ts:46], esclude i due turni scambiati dagli existing [^src5: code/app/lib/rules/validateSwap.ts:61], e ri-applica RB-01/03/04/05/08 + past-shift per **entrambe** le parti [^src5: code/app/lib/rules/validateSwap.ts:70]. Le sotto-regole filtrano correttamente per `userId` ed escludono per `id`; `validateNoShiftOnAbsence` considera solo assenze `approved` [^src5: code/app/lib/rules/validateNoShiftOnAbsence.ts:19]. I test T-SWP-01/02 confermano overlap (RB-01) e assenza (RB-08) incrociati.

Riserve (già sopra): (a) `validateCoverage` è **deliberatamente esclusa** [^src5: code/app/lib/rules/validateSwap.ts:16] — accettabile se coverage non è requisito RB-10, ma da confermare vs `regole-di-business RB-10`; (b) la parte affetta (A/B) è calcolata correttamente a livello dato (`affectedUserId`) ma **non propagata in UI** (H-1); (c) le ore contrattuali (L-2) non entrano nel calcolo.

## 5. Copertura Acceptance Criteria

| AC (TSK-026) | Stato | Note |
|---|---|---|
| Swap valido → `userId` scambiati + `swap_operations origin='admin'` | ✅ implementato / ⚠️ non testato | [^src5: code/app/app/api/admin/swap/route.ts:127] |
| RF-F CA1: blocking → 422 + DB invariato + UI mostra parte e regola | ⚠️ **parziale** | 422 OK; **parte mai mostrata** (H-1) |
| RF-F CA2: solo avvisi → `SwapConfirmDialog` conferma/annulla | ✅ implementato | [^src5: code/app/app/admin/swap/_components/SwapAdminPageClient.tsx:95] |
| RF-F CA4: swap confermato → `audit_log action='swap.admin'` before/after | ✅ implementato (inline in tx) | [^src5: code/app/app/api/admin/swap/route.ts:160] |
| POST non-admin → 403 | ✅ implementato / ⚠️ non testato | [^src5: code/app/app/api/admin/swap/route.ts:38] |
| Stesso turno A/B → errore validazione | ✅ (client `sameUser` + zod refine + guard API) | [^src5: code/app/lib/zod/index.ts:250] |
| Preview auto quando entrambi selezionati | ✅ | [^src5: code/app/hooks/useSwap.ts:81] |
| Placeholder "Seleziona turno" | ✅ | [^src5: code/app/app/admin/swap/_components/SelectedShiftCard.tsx:43] |
| Layout mobile in colonna | ✅ (`lg:grid-cols-2`) | [^src5: code/app/app/admin/swap/_components/SwapAdminPageClient.tsx:184] |

## 6. Già risolto / verificato (no regressione)

- **Atomicità multi-write (round 1 H-1) → risolto e preservato**: le 4 write (2× UPDATE shift, INSERT `swap_operations`, INSERT `audit_log` inline) sono in un'unica `db.transaction` su `tx` [^src5: code/app/app/api/admin/swap/route.ts:127]; snapshot `beforeA`/`beforeB` pre-transazione [^src5: code/app/app/api/admin/swap/route.ts:124]. Scelta di inlinare l'audit (invece di `insertAuditLog`, che è fire-and-forget su `db` [^src5: code/app/lib/audit.ts:93]) documentata e corretta.
- Guard admin coerenti su POST, preview e RSC. Nessun IDOR. Zod condiviso FE+BE per il payload.
- **Sicurezza**: nessun secret in chiaro, nessuna SQLi (query parametriche Drizzle), nessuna CVE evidente → **nessun incident aperto**.

## 7. Loop status

- **No-progress detection**: N/A per questo `/review` ad-hoc. H-1 è un **finding nuovo** (non presente nei report iter 1-3); M-1/M-2/M-4 riecheggiano finding round-1 non chiusi (M-2/M-4 tolleranti-a-debito, M-1 ancora aperto).
- **Regression detection**: nessuna regressione sul fix H-1 storico (transazione integra).
- **max_iterations (3)**: non superato in questo flusso (override una-tantum).

## 8. Prossimo step (task_package suggerito per dev-agent)

Priorità: **H-1** (cablare la parte A/B fino alla UI) → **M-1** (gestire `rejected`/`warnings` in `onSuccess`) → **M-2** (estrarre `prepareSwapValidation`) → **M-4** (guardia ottimistica). **M-3** a `qa-dev` (test route). Constraint router: `max_diff_lines: 80`, "fix only findings; no opportunistic refactor".

> **Aggiornamento frontmatter TSK / `wiki/log.md`**: **deferito a decisione umana/orchestratore**. Questo verdetto `conditional` sovrascrive un `passed` già accettato dall'umano nei batch — la modifica di `review_status` non va applicata silenziosamente (R.Q3, gate umano). Il presente report resta l'artefatto autoritativo della revisione.

---

**verdict: conditional**

Findings prioritizzati: H-1 (parte A/B mai mostrata — AC RF-F CA1 parziale) · M-1 (esito server ingoiato in `onSuccess`) · M-2 (duplicazione preview/POST) · M-3 (nessun test route/flow) · M-4 (TOCTOU/lock ottimistico) · L-1..L-6 (nit doc/dead-code/UX).

*Report generato da code-reviewer (CQRL v2.12). Ruleset `emergent` (candidate) → finding advisory. Nessun problema di sicurezza. Nessuna auto-modifica del codice, nessuna auto-approvazione.*
