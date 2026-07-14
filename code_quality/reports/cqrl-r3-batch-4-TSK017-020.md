# CQRL Batch 4 — Round 3 (iter-3, FINALE) — Verifica fix TSK-017 / TSK-018 / TSK-019 / TSK-020

- **Reviewer**: code-reviewer@2.12.0 (CQRL v2.12)
- **Generato**: 2026-07-14T16:20:00Z
- **Iterazione**: **3 / 3** (`code_quality.max_iterations: 3`) — **ULTIMA** (oltre = escalation forzata, R.Q3 + §7 r.16)
- **Report precedente**: `code_quality/reports/cqrl-r2-batch-4-TSK017-020.md` (iter-2)
- **Stack rilevato**: TypeScript 5.x (strict) / Next.js 15 (App Router) + React 19 · TanStack Query v5 + Table v8 · Drizzle ORM · Zod · react-hook-form · Auth.js v5 — confidence ~0.95 ≥ `confidence_min: 0.6` → **stack-aware NON degradato**
- **Passate attive** (`code_quality.passes`): idiomaticity · design · robustness · accessibility. `premortem-on-merge`: **assente → 4° pass OFF** (default, R.P3).
- **Ruleset**: `canonical/` + `team-specific/` **vuoti**; `emergent/` **ora popolato** (10 regole `status: candidate`). I finding citano regole `emergent` candidate (gate umano §19.5).
- **Blast radius pre-check**: skip (`compression.context.enabled: false`, `.graphify-state` assente).

> Fuori scope: sicurezza (R.Q7). Nessun secret/CVE rilevato. Il code-reviewer non ha
> modificato codice (R.Q2) né eseguito `tsc --noEmit`/`next build` (gate build → competenza `qa-dev`;
> vedi §7 nota sul diff ampio).

---

## Esito sintetico — delta iter-2 → iter-3 (FINALE)

| TSK | Verdict iter-2 | **Verdict iter-3 (finale)** | Δ | Note |
|---|---|---|---|---|
| **TSK-017** | CONDITIONAL (1 med / 2 low) | **REJECT** (gate umano) | ✗ blocco irrisolto | Fix M3 **INCORRETTO**: mismatch enum Zod ↔ `absence_types.code` seed → il flusso core resta **rotto al 100%** (500 → 400). 3° giro sullo stesso blocco → `loop_exhausted` |
| **TSK-018** | PASS | **PASS** | = | Nessuna regressione dal rename route-group. Coverage page intatta |
| **TSK-019** | CONDITIONAL (1 high parziale / 1 med) | **PASS** | ▲▲ chiuso | Edit route creata + handler `PATCH` esistente + endpoint `preview`/`generate` **ora presenti** (GAP-RECURRENCE-API-001 chiuso) |
| **TSK-020** | CONDITIONAL (1 med) | **PASS** (accept-as-debt) | ▲ | ~1098 LOC dead-code **rimossi**; residuo ~385 LOC (coppia orfana) **accettato come debito** dall'umano → non conta come finding aperto |

**Marker loop**: `no_progress: true` (limitato a **TSK-017/M3**: 3 iter, outcome invariato) ·
`regression: true` (limitato a **TSK-017/M3**: il fix ha introdotto un nuovo modo di fallimento) ·
`loop_exhausted: true` (**TSK-017**, `review_iter = max_iterations = 3` con blocco irrisolto) ·
`degraded: false`.

**Un verdict `reject` (TSK-017) → gate umano (R.Q3).** Nessun auto-revert / auto-close / riapertura
Develop. Nessun incident di sicurezza. Gli altri 3 TSK sono chiusi (`PASS`).

---

## 0. Cross-cutting §6 iter-2 → **RISOLTO** (major positive, fuori dallo scope stretto dei fix)

Il dev-agent ha adottato la **direzione #1** raccomandata iter-1/iter-2 §6: rinomina dell'intero
route group `app/(admin)/` → **segmento letterale `app/admin/`**. Conseguenze verificate:

- Gli URL admin sono ora **letterali `/admin/*`** (era: path *bare* per route group URL-trasparente).
- `middleware.ts` (protezione `/admin/*` + redirect post-login `/admin/dashboard`, `[^src5: code/app/middleware.ts:47]`/`:71`),
  `[^src5: code/app/app/page.tsx:25]` (`redirect('/admin/dashboard')`), dashboard quick-actions
  (`/admin/matrix`, `/admin/absences`), users (`/admin/users*`), suite `tests/**` (attendono `**/admin/*`):
  **ora tutti coerenti** con le route reali. Lo showstopper "404 all'atterraggio post-login admin"
  di iter-2 §6 è **chiuso**.
- **Nessun import pendente** dopo rename + delete (verifica su tutto il tree: zero `from '@/app/(admin)…'`
  e zero import verso i file rimossi).
- **Nessuna nuova collisione di route**: `/requests` ← `app/(employee)/requests` vs `/admin/requests`
  ← `app/admin/requests` non collidono. Il rename `admin-requests` di iter-2 è stato **riassorbito**
  (ora `app/admin/requests`), correttamente.

**Caveat (non gating)**: il rename tocca ~40+ file. Le verifiche mirate del reviewer (import,
collisioni, esistenza route) sono pulite, **ma il gate di build definitivo (`tsc --noEmit` / `next build`)
è competenza `qa-dev`**: raccomandato eseguirlo prima del merge dato l'ampiezza del diff.

**Residuo cosmetico (low, batch-wide)**: molti docblock d'intestazione recitano ancora il vecchio
path route-group (es. `[^src5: code/app/app/admin/layout.tsx:2]` «app/(admin)/layout.tsx», idem
`providers.tsx`, `absences/page.tsx`, `shift-types`, `swap`, `coverage`, `recurrence/*`). Non funzionale.
- **rule_id (candidate)**: `[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Detection]` — severity **low**, cleanup per follow-up.

---

## 1. TSK-017 — verifica fix M3 → **REJECT** (blocco irrisolto, gate umano)

### M1 (transazione) / M2 (fail-safe dry-run) — confermati FIXED ✓ (invariati da iter-2)
Nessuna regressione: le write restano atomiche in `db.transaction(...)`
`[^src5: code/app/app/api/admin/absences/route.ts:103]`; il dry-run conflitti resta fail-safe.

### [M3] `absenceTypeId` — fix applicato ma **INCORRETTO** → il flusso core resta rotto al 100% ✗
- **Severity**: medium (di fatto **guaranteed-failure** sul flusso core) · **fix_complexity**: medium (cross-file) · **auto_fixable**: no
- **rule_id (candidate)**: `[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Detection]`
  (percorso di codice non eseguibile / disallineato al modello dati) + aspetto contratto
  `[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]`.
- **Fix applicato**: la label enum non viene più scritta sulla colonna UUID; ora si risolve l'id via
  lookup `[^src5: code/app/app/api/admin/absences/route.ts:86]`–`91`
  (`eq(absenceTypes.code, absenceType)`) e si inserisce `absenceTypeId: absType.id`
  `[^src5: code/app/app/api/admin/absences/route.ts:153]`. Il cast UUID (500) è evitato.
- **Ma il join è sulla chiave sbagliata → 400 garantito su ogni richiesta valida**:
  - Enum Zod `absenceType`: `['ferie', 'malattia', 'permesso', 'maternita-paternita', 'altro']`
    `[^src5: code/app/lib/zod/index.ts:319]` (label minuscole per esteso).
  - Seed `absence_types.code`: `'FER'`, `'MAL'`, `'PER'` — **3 righe, codici a 3 lettere maiuscoli**
    `[^src5: code/app/db/seed.ts:250]`–`252`.
  - `eq(absenceTypes.code, 'ferie')` → **0 righe** → `if (!absType) return ApiResponse.badRequest('Tipo assenza non valido')`
    `[^src5: code/app/app/api/admin/absences/route.ts:91]`. **Ogni** `POST /api/admin/absences`
    con un tipo valido ritorna **400**.
  - Aggravante 1: nessuna colonna di `absence_types` contiene la label enum — `code` = FER/MAL/PER,
    `name` = 'Ferie'/'Malattia'/'Permesso' `[^src5: code/app/db/schema.ts:185]`–`186`. Il join non
    ha una chiave corretta as-is.
  - Aggravante 2: l'enum ha **5 valori**, il seed **3 righe** → `maternita-paternita` e `altro`
    non hanno riga `absence_types` → 400 anche con chiave allineata.
- **Netto**: il fix ha **spostato** il fallimento (500 cast UUID → 400 "tipo non valido"), **non lo ha
  risolto**. L'AC "l'admin registra un'assenza" resta **non eseguibile**. Sullo stesso blocco core
  M3 è ora al **3° giro** (iter-1 → iter-2 → iter-3): outcome invariato → `no_progress: true` (M3);
  il nuovo modo di fallimento introdotto dal fix → `regression: true` (M3).
- **Remediation (per l'umano — NON applicata dal reviewer, R.Q2)**: una tra
  (a) mappa esplicita enum→code nell'API prima del lookup **e** estendere il seed a tutti i 5 tipi;
  (b) allineare contratto (Zod) ↔ seed ↔ schema su una **chiave stabile** condivisa. Decisione
  cross-file (Zod + seed + eventualmente schema) → **eccede `max_diff_lines: 80`** → **gate umano**.

### Low residui (non gating, invariati)
- **L1** `[^src5: code/app/components/absences/ConflictShiftList.tsx:257]` — filtro `user.id !== conflict.id` (id turno vs id utente).
- **L2** `[^src5: code/app/app/api/admin/absences/route.ts:45]` — `statusParam as 'pending'` senza Zod.

**Verdict TSK-017 iter-3**: **`REJECT`**. Blocco core M3 irrisolto al termine del loop
(`review_iter = max_iterations = 3`) → marker `loop-exhausted`, **escalation umana** (R.Q3 + §7 r.16).
La decisione (correzione mapping + seed, o revert) spetta all'umano; il reviewer non revert/close/riapre.

---

## 2. TSK-018 — **PASS** (confermato, nessuna regressione)

Coverage page trasferita in `app/admin/coverage/page.tsx` come parte del rename route-group. Verificato:
import risolti (`CoverageRuleTable`/`CoverageRuleModal`/`CoverageMonitorGrid`
`[^src5: code/app/app/admin/coverage/_components/CoveragePageClient.tsx:19]`–`21`), URL `/admin/coverage`
coerente con `tests/visual/sprint2/coverage-monitor.spec.ts` e middleware. Unico rilievo: docblock
d'intestazione stale (`general.doc-code-mismatch`, low, §0). **Verdict invariato: PASS.**

---

## 3. TSK-019 — verifica fix edit route + gap BE → **PASS**

### H1' — edit route `/recurrence/[id]/edit` (era 404) → **FIXED ✓**
- Creato `[^src5: code/app/app/admin/recurrence/[id]/edit/page.tsx:29]` — Server Component con
  `auth()` + guard ruolo admin (defense-in-depth), validazione UUID + `notFound()`
  `[^src5: code/app/app/admin/recurrence/[id]/edit/page.tsx:36]`–`43`, delega a `RecurrenceEditForm`.
- Catena end-to-end **completa**: `RecurrenceEditForm` → `usePatchRecurrence`
  `[^src5: code/app/components/recurrence/RecurrenceEditForm.tsx:38]` → `PATCH /api/admin/recurrences/:id`;
  il handler **`PATCH` esiste** `[^src5: code/app/app/api/admin/recurrences/[id]/route.ts:27]` (iter-2
  ne rilevava solo `DELETE`). Redirect di ritorno `/admin/recurrence` (route esistente).
- Tutti i link ricorrenza ora `/admin/recurrence*` e le route esistono
  (`page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`).

### [M1] GAP-RECURRENCE-API-001 (preview/generate) → **CHIUSO ✓**
- `[^src5: code/app/app/api/admin/recurrence/preview/route.ts]` e
  `[^src5: code/app/app/api/admin/recurrence/generate/route.ts]` **ora presenti** → gli hook
  `usePreviewRecurrence`/`useGenerateRecurrence` `[^src5: code/app/hooks/useRecurrences.ts:217]`/`:240`
  non puntano più a route inesistenti. Il gap funzionale documentato è risolto.

### Low residui (non gating)
- Doppio cast `recurrence as unknown as RecurrenceRow`
  `[^src5: code/app/app/admin/recurrence/[id]/edit/page.tsx:65]` — code smell idiomatico TS (allineare
  il tipo di ritorno Drizzle a `RecurrenceRow`), low. Docblock stale (`general.doc-code-mismatch`, §0).

**Verdict TSK-019 iter-3**: **`PASS`**. Entrambi i blocchi iter-2 (edit 404 + gap BE) chiusi; catena
UI→hook→route→redirect coerente. Validazione payload PATCH end-to-end resta ambito `qa-dev` (non gating).

---

## 4. TSK-020 — dead-code → **PASS** (accept-as-debt)

### H1'' collisione build → confermata FIXED ✓
`app/admin/requests/page.tsx` renderizza il percorso **attivo** `RequestQueue`
`[^src5: code/app/app/admin/requests/page.tsx:38]`. Nessuna collisione (§0).

### [M1] cluster dead-code → **PARZIALMENTE RIMOSSO** (contrariamente a quanto dichiarato nel task, il codice mostra rimozione reale)
- **Rimossi (git `D`)** — verificato: nessun import entrante residuo (no build-break):
  | Modulo rimosso | LOC (iter-2) |
  |---|---|
  | `components/requests/RequestForm.tsx` | 551 |
  | `components/requests/SwapForm.tsx` | 288 |
  | `components/requests/AbsenceForm.tsx` (dead twin) | 259 |
  | **Totale rimosso** | **~1098** |
- **Residuo orfano (~385 LOC) — ACCEPT-AS-DEBT (umano)**:
  | Modulo residuo | LOC | Importatori |
  |---|---|---|
  | `[^src5: code/app/components/requests/ApprovalPanel.tsx]` | ~287 | 1 (solo `ApprovalQueueClient`, morto) |
  | `[^src5: code/app/app/admin/requests/_components/ApprovalQueueClient.tsx]` | ~98 | **0** |
- La coppia `ApprovalQueueClient`+`ApprovalPanel` (implementazione approvazione **morta**) è stata
  **trascinata** nel nuovo path `app/admin/requests/_components/` durante il rename, senza aggancio →
  resta orfana. Il percorso **attivo** è `RequestQueue` + `ApprovalActions`.
- **rule_id (candidate)**: `[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Rationale]`.
- Per **decisione umana ACCEPT-AS-DEBT**: il residuo ~385 LOC **non conta come finding aperto** in
  questo verdict. Raccomandato tracciarlo in `wiki/gaps.md` come debito (rimozione o wire-up esplicito
  in un TSK dedicato). Nota di igiene: il commento d'intestazione di `ApprovalQueueClient` cita ancora
  «status=pending» (`'pending'` non è in `RequestStatus`) — ulteriore prova di obsolescenza.

### [L2] ARIA ridondante su `RequestQueue` — invariato, delegato a EP-007 `a11y-specialist` (non gating).

**Verdict TSK-020 iter-3**: **`PASS`** (accept-as-debt). Progresso reale (~1098 LOC rimossi), collisione
chiusa, nessun import pendente; residuo ~385 LOC accettato come debito tracciato.

---

## 5. Loop status (FINALE)

- **Iterazione 3 / 3 — ultima.** Loop CQRL esaurito per questo batch.
- **TSK-017**: `no_progress: true` · `regression: true` · `loop_exhausted: true` → **REJECT**, marker
  `loop-exhausted`, escalation umana obbligatoria (R.Q3 + §7 r.16). Il set di `rule_id` sul blocco core
  (creazione assenza non eseguibile) è invariato per 3 iter.
- **TSK-018 / TSK-019 / TSK-020**: chiusi (`PASS`; TSK-020 accept-as-debt). Nessuna regressione tra loro.
- `degraded: false` (stack-aware pieno). `premortem-on-merge`: off (nessun 4° pass).

## 6. Prossimo step (feedback-router — gate umano, nessuna auto-modifica)

- **TSK-017 → REJECT / gate umano (bloccante)**: correggere il mapping `absenceType` (enum Zod) ↔
  `absence_types` (allineare `code`/`name`/seed o introdurre mappa esplicita) **e** completare il seed
  a tutti i 5 tipi. Decisione cross-file (Zod + seed + schema) fuori da `max_diff_lines: 80`. Consigliato
  aggiungere un test d'integrazione `POST /api/admin/absences` sul DB seed (competenza `qa-dev`,
  `[^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md]`) — il reviewer non scrive test.
- **TSK-018 → chiuso (PASS)**.
- **TSK-019 → chiuso (PASS)**. Follow-up low: rimuovere il doppio cast `as unknown as RecurrenceRow`.
- **TSK-020 → chiuso (PASS, accept-as-debt)**. Tracciare in `wiki/gaps.md` la rimozione del residuo
  ~385 LOC (ApprovalPanel + ApprovalQueueClient).
- **Batch-wide (low)**: allineare i docblock d'intestazione al nuovo path `app/admin/*`
  (`general.doc-code-mismatch`) + far girare `next build`/`tsc --noEmit` (qa-dev) come gate di build
  definitivo dato l'ampio rename.
- **Regole `emergent` citate** restano `status: candidate` (promozione = gate umano §19.5 step 4).
