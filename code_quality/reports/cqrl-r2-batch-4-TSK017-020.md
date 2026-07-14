# CQRL Batch 4 — Round 2 (iter-2) — Verifica fix TSK-017 / TSK-018 / TSK-019 / TSK-020

- **Reviewer**: code-reviewer@2.12.0 (CQRL v2.12)
- **Generato**: 2026-07-14T00:00:00Z
- **Iterazione**: **2 / 3** (`code_quality.max_iterations: 3`)
- **Report precedente**: `code_quality/reports/cqrl-batch-4-TSK017-020.md` (iter-1)
- **Stack rilevato**: TypeScript 5.x (strict) / Next.js 15 (App Router) + React 19 · TanStack Query v5 + Table v8 · Drizzle ORM · Zod · react-hook-form · Auth.js v5 — confidence ~0.95 → **stack-aware NON degradato**
- **Scope**: verifica dei fix applicati (B2 route collision, B5 TSK-017) + stato dei finding residui
- **Blast radius pre-check**: skip (`compression.context.enabled: false`, `.graphify-state` assente)

> **Meta-finding di processo (invariato da iter-1)**: ruleset locale
> `code_quality/rules/{team-specific,emergent,canonical}/` vuoto. Review in **modalità
> bootstrapping**; le `rule_id` citate restano `candidate` (tier `emergent`, gate umano §19.5).
> Fuori scope: sicurezza (R.Q7). Nessun secret/CVE rilevato.

---

## Esito sintetico — delta iter-1 → iter-2

| TSK | Verdict iter-1 | Verdict iter-2 | Δ | Note |
|---|---|---|---|---|
| **TSK-017** | CONDITIONAL (3 med / 2 low) | **CONDITIONAL** (1 med / 2 low) | ▲ progresso | M1 (tx) ✓ · M2 (fail-open) ✓ · **M3 (FK placeholder) ANCORA PRESENTE** |
| **TSK-018** | PASS (light) | **PASS** | = | Non toccato dai fix; nessuna regressione. Confermato |
| **TSK-019** | CONDITIONAL (1 high / 1 med) | **CONDITIONAL** (1 high parziale / 1 med) | ~ parziale | Link `/recurrence` e `/recurrence/new` ✓ · **edit route `/recurrence/[id]/edit` ANCORA 404** · BE preview/generate ancora assenti (gap) |
| **TSK-020** | CONDITIONAL (1 high / 1 med) | **CONDITIONAL** (1 med) | ▲ progresso | **Collisione build ✓ RISOLTA** · dead-code ~1487 LOC ANCORA PRESENTE (fuori scope fix) |

**Marker loop**: `no_progress: false` (progresso reale su tutti i TSK toccati) ·
`regression: false` (vedi nota cross-cutting: la rottura `/admin/*` è pre-esistente, già
segnalata iter-1 §H1) · `loop_exhausted: false` · `degraded: false`.

Nessun verdict `reject`. Nessun incident di sicurezza.

---

## 1. Verifica fix B2 — Collisione di route → RISOLTA ✓

**Fix applicato**: `app/(admin)/requests/` → `app/(admin)/admin-requests/`.

- **Collisione build eliminata** ✓ — gli URL non collidono più:
  - `/admin-requests` ← `app/(admin)/admin-requests/page.tsx`
  - `/admin-requests/[id]` ← `app/(admin)/admin-requests/[id]/page.tsx`
  - `/requests` ← `app/(employee)/requests/page.tsx` (nessuna sovrapposizione)
  - `next build` non fallirà più su *"two parallel pages resolve to the same path"*. **Build breaker H1'' (TSK-020) chiuso.**
- **Nessun riferimento residuo a `/admin/requests`** ✓ — `grep` su `code/app/**/*.{ts,tsx}`: zero occorrenze.
- **Link interni aggiornati** ✓ — coerenti col nuovo path:
  `[^src5: code/app/components/requests/RequestQueue.tsx:206]` (`/admin-requests/${id}`),
  `[^src5: code/app/app/(admin)/admin-requests/[id]/_components/RequestDetailClient.tsx:75]` e `:94` (`/admin-requests`),
  `[^src5: code/app/components/dashboard/InboxBadge.tsx:61]` (`/admin-requests`) + suite test allineata (`tests/e2e/**`, `tests/a11y/**`, `tests/visual/**`).

**⚠️ Limite del fix (cross-cutting, vedi §5)**: la direzione scelta è la **#2** di iter-1
(mantenere il route group `(admin)` URL-trasparente → path *bare*). È corretta e coerente
**per TSK-019/020**, ma **NON è stata "applicata ovunque"** come raccomandato in iter-1 §H1.
La claim del fix «Tutti i link aggiornati» vale per `requests`/`recurrence`, **non** a livello
applicativo. Il resto dell'app admin continua ad assumere il prefisso letterale `/admin/*`
(file di TSK-010 e TSK-014, fuori dal batch) → dettaglio in §5.

---

## 2. TSK-017 — verifica fix B5 — CONDITIONAL (▲ progresso)

### M1 — Scrittura multi-entità non transazionale → **FIXED ✓**
- `[^src5: code/app/app/api/admin/absences/route.ts:95]`–`173`
- Tutte le write (delete/update turni per `conflictResolutions` + insert assenza + audit log)
  ora avvolte in `db.transaction(async (tx) => { … })`. Ogni operazione usa `tx`, non `db`.
- Qualità del fix **alta**: commento che motiva l'atomicità e — nota idiomatica corretta —
  spiega perché **non** si usa l'helper `insertAuditLog()` (usa `db` diretto e ingoia gli
  errori, entrambi sbagliati dentro una transazione). Errore in qualsiasi step → rollback
  completo. Rilievo `drizzle.robustness.non_transactional_multi_write` chiuso.

### M2 — Fail-open sul dry-run conflitti → **FIXED ✓**
- `[^src5: code/app/components/absences/AbsenceForm.tsx:154]`–`163`
- Il `catch` del dry-run `check-conflicts` ora fa **`console.error` + `toast.error(...)` + `return`**:
  il submit è bloccato quando la verifica di sicurezza fallisce (fail-safe). Non prosegue più
  con la creazione diretta senza risoluzioni. Rilievo `ts.react.robustness.fail_open_on_safety_check`
  chiuso. Il commento aggiornato («fail-safe … rischierebbe corruzione dati») documenta la scelta.
- Nota: il fix è sul componente **attivo** `components/absences/AbsenceForm.tsx` (corretto);
  l'omonimo `components/requests/AbsenceForm.tsx` è dead-code non collegato (vedi §4).

### [M3] `absenceTypeId` valorizzato con la label enum → **ANCORA PRESENTE ✗ (unico must-fix TSK-017)**
- **Severity**: medium (di fatto **guaranteed-failure**, vedi sotto) · **fix_complexity**: medium · **auto_fixable**: no
- **File**: `[^src5: code/app/app/api/admin/absences/route.ts:151]`
- **rule_id (candidate)**: `drizzle.robustness.placeholder_fk_value`
- **Stato**: **invariato**. La riga è ancora `absenceTypeId: absenceType, // placeholder — da sostituire con UUID reale post-seed`.
- **Aggravante confermata a schema**: `[^src5: code/app/db/schema.ts:203]`–`205` definisce
  `absenceTypeId: uuid('absence_type_id').notNull().references(() => absenceTypes.id)`.
  `absenceType` è la stringa enum (`'ferie'`, `'malattia'`, …), **non** un UUID. Postgres
  rifiuta l'insert (`invalid input syntax for type uuid`) → **ogni** `POST /api/admin/absences`
  fallisce a runtime su DB reale/seed. Non è "latente": è un **500 garantito** sul flusso core
  del TSK (registrazione assenza). Il rollback M1 ora lo gestisce in modo pulito, ma l'AC resta
  non eseguibile.
- **Fix atteso (dentro la stessa transazione)**: risolvere l'id via lookup
  `tx.select().from(absenceTypes).where(eq(absenceTypes.code, absenceType))` → `absenceTypeId = row.id`
  (404/400 se il code non esiste). ~15-25 LOC, entro `max_diff_lines: 80`.

### Low residui (non gating, non toccati dai fix)
- **L1** `[^src5: code/app/components/absences/ConflictShiftList.tsx:257]` — filtro
  `users.filter((u) => u.id !== conflict.id)` confronta `user.id` con id del **turno**: invariato.
- **L2** `[^src5: code/app/app/api/admin/absences/route.ts:45]` — `statusParam as 'pending'`
  senza validazione Zod: invariato.

**Verdict TSK-017 iter-2**: `CONDITIONAL`. 2/3 medium risolti (must-fix iter-1 M1+M2 chiusi).
**Unico blocco residuo: M3** — hard failure sul flusso core → deve essere risolto prima del PASS.

---

## 3. TSK-018 — PASS (confermato)

Non incluso negli scope dei fix B2/B5. Nessuna modifica, nessuna regressione introdotta dal
rename `admin-requests` (le sue pagine restano a `/coverage`, auto-protette via `requireAdmin()`).
L1/L2/L3 di iter-1 restano hardening opzionale. **Verdict invariato: PASS.**

---

## 4. TSK-020 — verifica fix + residui — CONDITIONAL (▲ progresso)

### H1'' — Collisione di route (build breaker) → **FIXED ✓**
Vedi §1. Il difetto più impattante di TSK-020 è chiuso; `admin-requests/page.tsx` renderizza il
percorso attivo `RequestQueue` `[^src5: code/app/app/(admin)/admin-requests/page.tsx:38]`.

### [M1] Cluster dead-code (~1487 LOC) → **ANCORA PRESENTE ✗ (fuori scope dei fix di questo giro)**
- **Severity**: medium · **fix_complexity**: low · **auto_fixable**: no
- **rule_id (candidate)**: `ts.design.orphaned_dead_module`
- Confermato via `grep` importatori (esclusi self-reference nei commenti d'intestazione):
  | Modulo | LOC | Importatori |
  |---|---|---|
  | `[^src5: code/app/components/requests/RequestForm.tsx]` | 551 | 0 |
  | `[^src5: code/app/components/requests/ApprovalPanel.tsx]` | 291 | 1 (solo `ApprovalQueueClient`, a sua volta morto) |
  | `[^src5: code/app/components/requests/SwapForm.tsx]` | 288 | 0 |
  | `[^src5: code/app/components/requests/AbsenceForm.tsx]` | 259 | 0 |
  | `[^src5: code/app/app/(admin)/admin-requests/_components/ApprovalQueueClient.tsx]` | 98 | **0** |
  | **Totale** | **1487** | — |
- Il rename B2 ha **trascinato** `ApprovalQueueClient.tsx` in `admin-requests/_components/` senza
  aggiornarne il commento d'intestazione (recita ancora `app/(admin)/requests/_components/…`) né
  agganciarlo: resta orfano. Persiste la **doppia implementazione** dell'approvazione
  (attiva: `RequestQueue`+`ApprovalActions`; morta: `ApprovalQueueClient`+`ApprovalPanel`).
- **L1 (evidenza a supporto)**: `[^src5: code/app/app/(admin)/admin-requests/_components/ApprovalQueueClient.tsx:6]`–`7`
  il commento dichiara ancora «Filtra per status=pending» (`'pending'` non è nell'enum
  `RequestStatus`) — prova ulteriore di obsolescenza.
- **Nota**: era **esplicitamente fuori** dallo scope dei fix di questo giro. Segnalato invariato;
  resta il must-fix per il PASS di TSK-020 (rimozione del cluster o wire-up esplicito).

### [L2] ARIA ridondante su tabella nativa `RequestQueue`
Invariato → delegato a EP-007 `a11y-specialist`, non gating.

**Verdict TSK-020 iter-2**: `CONDITIONAL`. High (build) risolto; **unico blocco residuo: M1
dead-code**.

---

## 5. TSK-019 — verifica fix link + residui — CONDITIONAL (parziale)

### H1' — Link `/admin/recurrence*` → **PARZIALMENTE FIXED**
- **Corretti ✓** (prefisso `/admin` rimosso, path bare risolvibili):
  - `[^src5: code/app/components/recurrence/RecurrenceWizard.tsx:122]` e `:147` → `router.push('/recurrence')` (route `app/(admin)/recurrence/page.tsx` esiste ✓)
  - `[^src5: code/app/components/recurrence/RecurrenceList.tsx:150]` → `/recurrence/new` (route `app/(admin)/recurrence/new/page.tsx` esiste ✓)
- **ANCORA ROTTO ✗**: `[^src5: code/app/components/recurrence/RecurrenceList.tsx:249]` →
  `<Link href={`/recurrence/${rec.id}/edit`}>`. Il prefisso è ora corretto **ma la route di
  destinazione non esiste**: sotto `app/(admin)/recurrence/` ci sono solo `page.tsx` e
  `new/page.tsx`, **nessun `[id]/edit/page.tsx`**. Il link produce ancora un **404**.
  Questa è la componente "edit route inesistente" del finding H1' di iter-1: **non risolta**.
- **Fix atteso**: creare `app/(admin)/recurrence/[id]/edit/page.tsx` (allineato a RF-E CA2
  editing serie/occorrenza) **oppure** rimuovere/disabilitare il link finché la funzione non
  esiste. Da coordinare con L2 iter-1 (editing per-occorrenza mancante → `qa-dev`).

### [M1] UI su endpoint BE inesistenti (GAP-RECURRENCE-API-001) → **ANCORA APERTO (gap documentato)**
- `[^src5: code/app/hooks/useRecurrences.ts:183]` (`/api/admin/recurrence/preview`) e `:208`
  (`/api/admin/recurrence/generate`): route confermate **assenti**. Esistono solo
  `[^src5: code/app/app/api/admin/recurrences/route.ts]` (GET/POST) e
  `[^src5: code/app/app/api/admin/recurrences/[id]/route.ts]` (DELETE) — TSK-009.
- Come da iter-1: **non è un finding code-reviewer** ma un **gap funzionale documentato**
  (`wiki/gaps.md — GAP-RECURRENCE-API-001`), competenza be-dev/qa. Persiste anche l'incoerenza
  L1 `recurrences` (plurale) vs `recurrence/*` (singolare) nello stesso hook.

### Low residui (L3 `void` param) — invariati, non gating.

**Verdict TSK-019 iter-2**: `CONDITIONAL`. Navigazione list/new sbloccata; **residuo high-parziale:
edit route `/recurrence/[id]/edit` ancora 404** + gap BE preview/generate (be/qa).

---

## 6. Cross-cutting — H1 route-group `(admin)` vs prefisso `/admin/*` — ESCALATION (fuori batch)

La direzione #2 (path *bare*), adottata dai fix B2/recurrence, **rende ora definitiva** una
convenzione che larga parte dell'app **non rispetta**. Nessuno di questi file è in TSK-017..020
(li elenco per l'handoff — sono **pre-esistenti**, già segnalati iter-1 §H1 Conseguenze 2/3 →
`regression: false`):

- **TSK-010** `[^src5: code/app/middleware.ts:39]` — redirect **post-login** admin a
  `/admin/dashboard`, e `[^src5: code/app/app/page.tsx:25]` `redirect('/admin/dashboard')`: la
  pagina reale è `/dashboard` (route group URL-trasparente) → **404 all'atterraggio dopo il login
  admin**. Showstopper runtime dell'esperienza admin end-to-end.
- **TSK-014** `[^src5: code/app/components/dashboard/QuickActionsBar.tsx:38]` (`/admin/matrix`),
  `:45` (`/admin/absences`), `[^src5: code/app/components/dashboard/AbsenceCountCard.tsx:53]`
  (`/admin/absences`), `ViolationSummary.tsx:55` (`/admin/matrix`): quick-action verso 404.
- **Users** `app/(admin)/users/page.tsx:28`, `UsersListClient.tsx:42`/`:95`, `users/new/page.tsx:26`/`27`
  (`/admin/users*`): idem.
- **Suite E2E/a11y/visual** (`tests/**`) codifica il prefisso `/admin/*` (es.
  `tests/e2e/global-setup.ts:36` attende `**/admin/dashboard`): incoerente con i path bare
  → test destinati a fallire (competenza `qa-dev`).

**Osservazione di design**: la maggioranza del codice pre-esistente (middleware, dashboard, users,
test) assumeva già `/admin/*`. La direzione **#1** di iter-1 (rinominare `app/(admin)` → `app/admin`
segmento letterale) avrebbe risolto **in un colpo** collisione + recurrence + users + redirect
post-login, allineandosi al resto dell'app. La direzione #2 scelta risolve solo le istanze
TSK-019/020 e lascia l'app **non navigabile per l'admin**. Entro il constraint `max_diff_lines: 80`
la scelta è comprensibile, ma la decisione di convenzione **app-wide** resta aperta.

**Handoff (gate umano, come già raccomandato iter-1)**: tracciare in `wiki/gaps.md` la decisione
sulla convenzione di routing admin e allineare TSK-010 (middleware/redirect), TSK-014 (dashboard),
users + suite test. **Il code-reviewer non modifica codice né questi file** (R.Q2). Non è un blocco
di *questo* batch, ma è il **critical path** per la release admin.

---

## 7. Loop status

- **Iterazione 2 / 3.** Restano al massimo 1 giro prima dell'escalation forzata (R.Q3).
- Marker: `no_progress: false` · `regression: false` · `loop_exhausted: false` · `degraded: false`.
- Confronto rule-set iter-1 → iter-2 (no-progress check): il set di `rule_id` è **cambiato** per
  ogni TSK toccato (M1/M2 TSK-017 chiusi, H1'' TSK-020 chiuso, H1' TSK-019 ridotto) → **nessun**
  no-progress.

## 8. Prossimo step (feedback-router — gate umano, nessuna auto-modifica)

- **TSK-017 → iter-3, must-fix unico M3**: risolvere `absenceTypeId` via lookup
  `absenceTypes.code → id` dentro la transazione. Constraint `max_diff_lines: 80`, no refactor.
- **TSK-020 → iter-3, must-fix unico M1**: rimuovere il cluster dead-code (1487 LOC) o wire-up
  esplicito. Constraint invariato.
- **TSK-019 → iter-3**: creare/guardare la route `recurrence/[id]/edit`; endpoint BE
  preview/generate → be-dev (gap GAP-RECURRENCE-API-001, competenza funzionale/qa).
- **TSK-018 → chiuso (PASS)**.
- **Escalation cross-cutting (§6)** → decisione umana su convenzione routing admin in
  `wiki/gaps.md`; allineamento TSK-010/TSK-014/users/test fuori da questo batch.
- **Regole emergent candidate** depositabili (`status: candidate`): quelle citate. Non promosse.
