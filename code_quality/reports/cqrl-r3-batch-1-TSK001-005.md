# CQRL Code Review — Batch 1, Iterazione 3 (TSK-001 … TSK-005) — FINALE

- **Reviewer**: code-reviewer (CQRL v2.12) — passate: idiomaticità → design → robustezza
- **Repo**: soli-turnly · `code/app`
- **Generato**: 2026-07-14
- **Iterazione**: **3 di `max_iterations: 3` — ULTIMA iterazione consentita**
- **Report round precedente (baseline)**: aggregato `code_quality/reports/cqrl-r2-aggregate.md`
  (batch-1 iter-1: `cqrl-batch-1-TSK001-004.md`; TSK-005 iter-2: `cqrl-r2-batch-2-TSK005-009.md`)
- **Modalità**: stack-aware (sopra `confidence_min: 0.6`)
- **stack_descriptor**: `ts/next15-app/drizzle-pg/authjs5`

> **Nota di processo**: `rules/canonical` e `rules/team-specific` restano vuote (solo `.gitkeep`);
> le regole in `rules/emergent/` esistono e sono citate come tali. I `rule_id` canonici citati
> restano identificatori convenzionali proposti (gate umano per la promozione, §19.5).

> **Nota di scope**: questa iterazione **non riesamina ex-novo** TSK-001/002/003/005 (già `pass` in
> iter-2). Per essi si verifica **solo la presenza di regressioni** sui file toccati nell'iter-3
> (§19.4 regression detection). L'oggetto centrale della review è la fix del blocking aperto
> **T-SEC-05** su TSK-004.

---

## Verdict sintetico (round 3 — finale)

| TSK | Layer | Titolo | iter-2 | **iter-3 (finale)** | Blocking aperti |
|---|---|---|---|---|---|
| TSK-001 | be | Scaffolding Next.js + Drizzle + shadcn/ui | pass | **PASS** | 0 |
| TSK-002 | db | Schema DB + migrations | pass | **PASS** | 0 |
| TSK-003 | be | Auth.js v5 + RBAC middleware | pass | **PASS** | 0 |
| TSK-004 | be | API skeleton route handlers | conditional | **PASS** | 0 (T-SEC-05 RISOLTO) |
| TSK-005 | fe | Matrice Admin TanStack Table | pass | **PASS** | 0 |

> **Verdict di batch: `pass`.** Il blocker T-SEC-05 (unico finding aperto della batch-1) è **risolto e
> verificato**. Nessuna regressione HIGH/CRITICAL sui file di TSK-001/002/003/005. Nessun `reject`:
> nessun problema di sicurezza, nessun finding identico ripetuto (§19.4).
>
> ⚠️ **Escalation cross-cutting fuori batch** (vedi §Cross-cutting): il gate globale `tsc --noEmit`
> è regredito **0 → 6 errori** in iter-3, ma **tutti in file NON appartenenti a batch-1**
> (TSK-007 `ApprovalPanel.tsx`, sprint3 `reports-overtime.spec.ts`). Non altera i verdetti batch-1;
> va instradato ai batch proprietari.

---

## TSK-004 — Verifica fix T-SEC-05 · CONDITIONAL → **PASS**

**Blocking di iter-2 chiuso.** L'AC «`accept-swap` con session non-destinatario → 403 (T-SEC-05)»
era rinviata a `// TODO TSK-006` in iter-1/iter-2 (qualsiasi utente autenticato poteva accettare
qualsiasi scambio). Il fix applicato in iter-3 è **presente, idiomatico e semanticamente corretto**.

### 1. Presenza + correttezza del check ✅

`[^src5: code/app/app/api/requests/[id]/accept-swap/route.ts:38]`

```typescript
// T-SEC-05: solo il collega destinatario può accettare lo swap.
const swapPayload = existing.payload as { targetUserId?: string } | null;
if (swapPayload?.targetUserId !== session.user.id) {
  return ApiResponse.forbidden();
}
```

- Posizionato **dopo** l'auth check (`!session → 401`) e il guard di tipo (`type !== 'shift_swap'
  → 400`), **prima** del parse del body e dell'update → nessuna mutazione o side-effect prima
  dell'autorizzazione. Ordine corretto.
- **Semantica corretta**: solo l'utente il cui `id` coincide con `payload.targetUserId` (il collega
  bersaglio designato al momento della creazione dello swap) passa; chiunque altro riceve `403`.
- **Fail-safe (deny-by-default)**: `payload === null` o `targetUserId` assente → `undefined !==
  session.user.id` → `true` → `403`. Nessun bypass in caso di payload malformato.

### 2. Coerenza della chiave `targetUserId` con la convenzione end-to-end ✅

La chiave `targetUserId` nel jsonb `payload` è la stessa usata in modo consistente su tutto lo
stack — il BE ora **allinea** il check al contratto già presente lato FE:

- FE mirror identico: `SwapAcceptRejectPanel` gate «visibile SOLO se `session.user.id ===
  payload.targetUserId`» `[^src5: code/app/components/employee/requests/SwapAcceptRejectPanel.tsx:116]`
- Documentato in `useRequests.ts:327` («T-SEC-08: il componente DEVE verificare `session.user.id ===
  payload.targetUserId`») e reso in `SwapColleagueStatus.tsx:76`.
- Fixture E2E che creano lo swap valorizzano `payload.targetUserId`
  `[^src5: code/app/tests/e2e/sprint2/employee-requests.spec.ts:196]`.

Il BE non introduce una chiave nuova/divergente: la difesa server-side chiude il gap che prima era
solo lato client. `[^rule: canonical/robustness.authz-acceptance-gap §Rationale]`

### 3. `session.user.id` effettivamente popolato ✅ (dipendenza da TSK-003)

Il check dipende da un `session.user.id` non-nullo. Verificato che la fix di TSK-003 (iter-2) è
**intatta**: `session.user.id = token.sub!` nel session callback
`[^src5: code/app/auth.config.ts:56]` + augmentation `Session.user.id: string`
`[^src5: code/app/types/next-auth.d.ts:36]`. Nessuna regressione → il confronto è affidabile.

### 4. Nessun finding HIGH/CRITICAL introdotto dalla fix ✅

Il diff della route aggiunge anche il dispatch email TSK-029 (in `after()`, try/catch, non
bloccante — pattern robusto già validato in iter-2 su altre route). Il typecheck **non** riporta
errori su questo file né su alcun handler TSK-004. Nessun nuovo blocking.

### Residuo non bloccante (LOW, portato, deferito per scope)

- **[LOW · doc/design] `status: 'awaiting_colleague'` sull'accettazione + docstring divergente** —
  l'header del file dichiara «Imposta status → 'approved' e applica lo scambio (TSK-006)» ma il
  codice imposta `awaiting_colleague` con `// TODO TSK-006: eseguire lo scambio fisico`. Semantica
  di transizione ancora incompleta, **ma esplicitamente deferita a TSK-006** (esecuzione swap +
  regole RB). Coerente con lo scope «API skeleton» di TSK-004; **non blocca il pass**.
  `[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Detection]`
  `[^src5: code/app/app/api/requests/[id]/accept-swap/route.ts:7]`
  `[^src5: code/app/app/api/requests/[id]/accept-swap/route.ts:64]`

**Esito TSK-004**: il blocking T-SEC-05 non è più presente e **non è un finding identico a iter-2**
(era aperto, ora risolto) → **nessun forced reject**. Verdict **PASS**.

---

## Verifica regressioni — TSK-001 / 002 / 003 / 005 (già PASS iter-2)

Verifica limitata alle regressioni sui file toccati nell'iter-3 (§19.4). Gate `tsc --noEmit`
eseguito: i 6 errori residui **non toccano alcun file di questi TSK** (vedi §Cross-cutting).

| TSK | File chiave verificati | Regressione? | Note |
|---|---|---|---|
| **TSK-001** | `next.config.ts`, `tsconfig`, `eslint.config.mjs` | **No** | Gate integro: `typescript.ignoreBuildErrors: false` + `eslint.ignoreDuringBuilds: false` `[^src5: code/app/next.config.ts:26]`. Nessun bypass introdotto per mascherare errori altrui. |
| **TSK-002** | `db/schema.ts`, migrations 0001-0004 | **No** | `requestStatusEnum` coerente (`draft/sent/awaiting_colleague/approved/rejected/cancelled/applied`) `[^src5: code/app/db/schema.ts:56]`; nessun file schema tra gli errori tsc. |
| **TSK-003** | `auth.ts`, `auth.config.ts`, `middleware.ts`, `types/next-auth.d.ts` | **No** | `session.user.id = token.sub!` propagato `[^src5: code/app/auth.config.ts:56]`; split edge-safe intatto; augmentation intatta. |
| **TSK-005** | `components/matrix/*`, `hooks/useShifts.ts` | **No** | Nessun file matrice tra gli errori tsc; `ShiftGrid`/`ShiftEditor` non regrediti. |

Nessuna regressione HIGH/CRITICAL attribuibile a batch-1 → **PASS confermato per tutti e quattro**.

---

## Cross-cutting — regressione gate globale `tsc` (FUORI batch-1, da instradare)

Il gate CQ-000 (`tsc --noEmit`), verificato a **0 errori** in iter-2, in iter-3 riporta **6 errori**
— **tutti in file esterni a batch-1** (TSK-001..005). Non modifica i verdetti di questa batch, ma
**rompe il build globale** (`ignoreBuildErrors: false`) e va escalato ai proprietari:

| File | TSK proprietario | Errore | Causa radice |
|---|---|---|---|
| `components/requests/ApprovalPanel.tsx` (48, 87, 127, 144) | **TSK-007** (batch-2) | `'pending'` non in `Record<RequestStatus,…>`; comparison overlap; `createdAt` assente su `RequestRow` | **Dual-schema drift**: `types/index.ts:30` (hand-written) definisce `RequestStatus = 'pending'|'approved'|'rejected'|'cancelled'` (residuo prototipo), divergente dalla source-of-truth DB `requestStatusEnum` (TSK-002). Il fix `'pending'→'sent'` di TSK-012 non ha allineato il tipo hand-written. |
| `tests/visual/sprint3/reports-overtime.spec.ts:40` | sprint3 (batch-7) | `requestAnimationFrame` callback vs `Promise` executor type mismatch | Cast/tipizzazione del wrapper `requestAnimationFrame` in una promise. |

**Azione raccomandata (non batch-1)**:
- Instradare `task_package` `conditional` a **TSK-007** (batch-2): allineare `types/index.ts`
  `RequestStatus`/`RequestRow` alla `$inferSelect` del `requests` schema (eliminare il tipo
  duplicato prototipo, tema già tracciato come «dual schema» in iter-2 per TSK-025).
  `[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Detection]`
- Instradare fix di tipizzazione a **owner sprint3** per `reports-overtime.spec.ts`.

> Poiché batch-1 è chiuso a `pass`, questi due item vanno risolti nei rispettivi batch **prima** di
> considerare CQ-000 (tsc 0) globalmente ripristinato per il merge del progetto.

---

## Loop status (finale)

- **iter-3 = ultima iterazione** (`review_iter (3) == max_iterations (3)`).
- **Forced-reject §19.4 — non attivato per nessun TSK di batch-1**:
  - TSK-004: T-SEC-05 era **aperto** in iter-2, ora **risolto** → *non* è un set di `rule_id`
    identico ripetuto → nessun reject forzato.
  - TSK-001/002/003/005: già `pass` in iter-2, nessun blocking portato → nessun reject.
- **No-progress detection**: N/A (nessun finding blocking ripetuto identico in batch-1).
- **Regression detection**: 6 errori tsc rilevati ma **fuori dai file di batch-1** → non contano
  come regressione di batch-1; escalati ai batch proprietari (vedi §Cross-cutting).
- **Sicurezza**: nessun secret in chiaro, nessun CVE emerso. Il fix T-SEC-05 **chiude** una lacuna
  di autorizzazione (IDOR su accept-swap) → nessun incidente `wiki/incidents/`.
- **Verdict aggregato batch-1: `pass` (finale).** Batch-1 esce dal loop CQRL.

## Prossimo step

1. **TSK-001..005 → chiudere `review_status: passed`** nel frontmatter (batch-1 completa il loop
   entro `max_iterations`).
2. **Fuori batch-1 (blocca il build globale)**: aprire re-Develop `conditional` per **TSK-007**
   (allineamento `RequestStatus`/`RequestRow` a schema DB) e per lo **spec visual sprint3**
   `reports-overtime`. Priorità alta: `tsc` deve tornare a 0 prima del merge.
3. **Residuo LOW TSK-004** (`awaiting_colleague` + docstring): tracciabile su TSK-006 (esecuzione
   swap) — non richiede iterazione CQRL dedicata.
4. **Governance ruleset**: le `rule_id` canonical citate restano bozze da promuovere a gate umano
   (§19.5); le `emergent/*` citate esistono già su disco.
