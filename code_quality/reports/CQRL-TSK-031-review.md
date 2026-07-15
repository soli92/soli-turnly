# CQRL Code Review — TSK-031 (.ics export endpoint — verifica, dipendenze npm, integration test)

- **Reviewer**: code-reviewer (CQRL v2.12, PATTERN §19)
- **Generato**: 2026-07-15
- **Trigger**: comando esplicito `/review TSK-031` (override una-tantum). Il batch precedente
  (`cqrl-r3-batch-7-TSK029-031.md`) aveva chiuso a **PASS iter 3/3**; questa è una **re-review indipendente**
  con verdict autonomo (nessun `loop-exhausted`, iter counter non incrementato).
- **Layer**: be (+ tocco fe su `CalendarToolbar`, + qa/e2e)
- **Passate eseguite**: idiomaticità · design · robustezza
- **Modalità**: **stack-aware** (non degradata)

---

## Stack rilevato

- **TypeScript 5.x** (`strict` + `exactOptionalPropertyTypes` — cfr. commento a route:88)
- **Next.js 15** Route Handler (`GET`)
- **Drizzle ORM** (`shifts` + `shiftTypes`, `leftJoin`, `and/eq/gte/lte`, colonna `date` in **string mode**)
- **`ics` `^3.12.0`** (`createEvents`, `EventAttributes`, `EventStatus`) — dipendenza diretta presente in
  `package.json` [^src5: code/app/package.json:50] → **AC1 soddisfatto**
- **Playwright** integration/e2e (`tests/e2e/sprint3/ics-export.spec.ts` + fixture `sprint3-db.ts`)
- **Confidence ≈ 0.9** (`raw/tech_stack.md` + `package.json`) → sopra `confidence_min: 0.6`.

**Nota ruleset**: `emergent/*` tutte `status: candidate` (gate umano §19.5); `canonical/`/`team-specific/` vuoti →
**verdetti advisory**. Finding senza rule_id corrispondente etichettati *advisory (nessuna rule esistente — non inventata)*.

---

## Verdetto

> **verdict: conditional**

Il route è **corretto sulla sicurezza** (auth 401, filtro sempre su `session.user.id`, nessun IDOR, `Cache-Control:
no-store`) e soddisfa gli AC del percorso felice (200 `text/calendar`, `BEGIN:VCALENDAR`, `Content-Disposition`,
range vuoto → 0 VEVENT). Il pulsante `CalendarToolbar` e la dipendenza `ics` sono a posto. Restano un **finding
medium di robustezza** (parametri `from`/`to` non validati → 500 su input malformato + riflessione nell'header) e un
**finding medium di qualità test** (asserzione T-SEC-01 monodirezionale + AC `?userId=altro` non testato
direttamente). Nessuna security incident, codice compilabile → **non `reject`** → `conditional`.

---

## Finding (prioritizzati)

### [M-1] `from`/`to` non validati → 500 su input malformato + riflessione in `Content-Disposition` — **robustezza**
- **File**: `code/app/app/api/users/me/shifts/export/route.ts` [^src5: code/app/app/api/users/me/shifts/export/route.ts:31-37] [:103] [:109]
- `from`/`to` letti da `searchParams` e passati **verbatim** a `gte(shifts.date, from)` / `lte(shifts.date, to)`
  su colonna `date`. Con un valore non-`YYYY-MM-DD` (es. `?from=abc`), PostgreSQL solleva `invalid input syntax
  for type date`; il route **non ha try/catch** → risale come **500** invece di 400. Superficie triggerabile da
  qualsiasi client.
- Gli stessi valori non validati vengono **riflessi** nell'header `Content-Disposition:
  attachment; filename="turni_${from}_${to}.ics"` [:109]. Il runtime (undici/Web `Response`) rigetta caratteri di
  header invalidi (niente response-splitting classico), ma è comunque input non validato che finisce in un header
  e può produrre 500 o filename malformati.
- **Remediation**: validare `from`/`to` con `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` (o `z.coerce.date`) e
  rispondere `ApiResponse.badRequest(...)` prima della query; usare i valori validati anche per il filename.
- **rule_id**: *advisory — nessuna rule emergent esistente*. Candidabile a `be.robustness.unvalidated-query-param`
  (non creata in questo run — gate umano §19.5).

### [M-2] Test T-SEC-01 con asserzione monodirezionale + AC `?userId=altro` non testato — **qualità test / delega `qa-dev`**
- **File**: `code/app/tests/e2e/sprint3/ics-export.spec.ts` [^src5: code/app/tests/e2e/sprint3/ics-export.spec.ts:109-121]
- Il test di sicurezza asserisce **solo** `expect(icsText).not.toContain(otherUserShiftId)` [:120]. Passerebbe
  **vacuamente** anche se l'export fosse completamente rotto e restituisse zero turni (assenza banale). Per non
  essere hollow, deve asserire **anche** la presenza di ≥1 turno **proprio** di mario.rossi (prova che l'export
  funziona *e* filtra) — l'anti-pattern è esattamente quello descritto dalla regola candidate.
- Inoltre l'AC di TSK-031 recita «il file non contiene turni di altri utenti **anche se passato `?userId=altro`**».
  Il test esegue un GET **senza** `?userId` [:113]; il route ignora del tutto il param (safe), ma l'AC non è
  verificato: manca un caso `?userId=<luciaId>` che dimostri che il param è ignorato.
- **Remediation** (a cura di `qa-dev`): rafforzare l'asserzione (own-present + others-absent) e aggiungere il caso
  `?userId=altro`. Manca anche un test per input malformato (`?from=abc` → atteso 400 dopo il fix M-1).
- **rule_id**: [^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Rationale] (candidate).
  Severity medium → completamento a `qa-dev` (§19.6, il code-reviewer non scrive test).

### [L-1] `.limit(500)` — troncamento silenzioso su export senza range — **robustezza (advisory)**
- **File**: `route.ts` [^src5: code/app/app/api/users/me/shifts/export/route.ts:52]
- Per l'export mensile il tetto è irrilevante (≤31 turni). Ma il route consente il GET **senza** `from`/`to`
  (l'export completo, usato anche dal test T-SEC-01): un utente con >500 turni storici vedrebbe i turni eccedenti
  **scomparire silenziosamente** dal .ics, senza alcun segnale. Considerare paginazione/warning o richiedere un
  range obbligatorio per l'export completo. Carried dai report precedenti (L1).

### [L-2] Dead code dopo `testInfo.fixme(true, …)` nella fixture — **manutenibilità (advisory)**
- **File**: `code/app/tests/e2e/fixtures/sprint3-db.ts` [^src5: code/app/tests/e2e/fixtures/sprint3-db.ts:93] [:105] [:126] [:136]
- `testInfo.fixme(true, …)` lancia per abortire il test; le righe successive `await use('__fixture_unavailable__');
  return;` sono **irraggiungibili**. Innocue ma fuorvianti (suggeriscono un fallback che non viene mai usato).
  Rimuoverle o sostituire `fixme(true)` con un pattern di skip esplicito se il fallback è desiderato.
- **rule_id**: [^rule: code_quality/rules/emergent/general.dead-broken-code.md §Detection] (candidate). Carried (L).

### [L-3] Filename generico quando è fornito solo uno tra `from`/`to` — **robustezza minore (advisory)**
- **File**: `route.ts` [:103] — `const filename = from && to ? … : 'turni.ics'`
- Con `?from=X` senza `to` (o viceversa) la query filtra comunque per il singolo estremo, ma il filename ricade
  su `turni.ics` generico. Coerenza minore; l'AC7 richiede il filename ricco solo quando **entrambi** sono presenti,
  quindi non viola l'AC — solo un'incoerenza cosmetica. Low.

### [Informativo] Eventi emessi in UTC (`startInputType: 'utc'`) — **nessun finding**
- **File**: `route.ts` [:69-84]. L'uso di componenti UTC + `startInputType: 'utc'` produce `DTSTART` con suffisso
  `Z`, **non ambiguo**: i client calendario convertono al fuso locale dell'utente. È una scelta **corretta** per
  l'.ics (a differenza del display FE, che deve invece essere Europe/Rome). Nessuna azione richiesta — annotato per
  evitare falsi positivi tz in future review.

---

## Cosa è corretto (per bilanciare)

- **Sicurezza**: `auth()` → 401 se non autenticato [:27-28]; filtro **sempre** `eq(shifts.userId, session.user.id)`
  [:35]; nessun param `userId` letto (T-SEC-01 rispettato a livello route); `Cache-Control: no-store` [:110] evita
  caching di dati personali. Difesa in profondità: anche `middleware.ts` blocca `/api/*` non autenticato.
- **AC coperti**: AC1 (`ics` in `package.json`), AC2 (200 `text/calendar` + `BEGIN:VCALENDAR`), AC3 (range vuoto →
  0 VEVENT, testato con `2000-01`), AC7 (`Content-Disposition` con filename), AC8 (pulsante `CalendarToolbar`
  `data-testid="export-ics-btn"` con `getPeriodRange` per vista month/week/day) [^src5: code/app/components/employee/calendar/CalendarToolbar.tsx:59-63] [:133-143].
- **Mapping status** `planned→TENTATIVE / confirmed→CONFIRMED / cancelled→CANCELLED` [:59-64] coerente con l'enum
  `shift_status`; `description` aggiunta solo se `notes` presenti (rispetta `exactOptionalPropertyTypes`) [:89-91].
- **Gestione errore `createEvents`**: `if (error || !value)` → 500 con log [:96-101]. `leftJoin` con fallback
  `shiftTypeName ?? 'Turno'` [:68] evita eventi senza titolo.
- **Test**: la fixture `otherUserShiftId` è **deterministica** (crea/teardown il turno di lucia se assente) — niente
  auto-skip silenzioso; il testid dell'export button è stabile (non brittle).

---

## Loop status

- **Re-review indipendente** su `/review` esplicito. Il batch precedente era chiuso a **PASS iter 3/3**; questo run
  non incrementa l'iter counter e non attiva `loop-exhausted` (R.Q3).
- **No-progress**: n/a (run isolato). **Regression**: nessuna — il route è invariato rispetto al batch 7; M-1
  emerge da un'analisi robustezza sull'input non validato che i giri precedenti (focalizzati sui fix dei test
  self-skip) non avevano isolato.
- **Blast radius pre-check**: non eseguito (`compression.context.enabled: false`) → v2.14 Fase 1.
- **Sicurezza**: CQRL non copre security scanning; l'osservazione IDOR conferma che il **route è sicuro** (filtro su
  `session.user.id`). Nessun secret, nessuna CVE emersa → nessun incident, nessuno STOP `reject`.

## Prossimo step (per orchestratore / feedback-router)

1. `task_package` al dev-agent, scope ristretto a **M-1** (validare `from`/`to` + usare i valori validati nel
   filename), `max_diff_lines: 80`, no refactor opportunistici.
2. Delega a **`qa-dev`** per M-2 (asserzione T-SEC-01 bidirezionale + caso `?userId=altro` + caso `from` malformato →
   400) e per L-2 (pulizia dead code fixture).
3. L-1/L-3 in `wiki/gaps.md` come debito minore (non bloccanti).
4. Verdetti advisory (ruleset `emergent` = candidate). Nessuna regola creata/promossa (gate umano §19.5).
5. Nessun file di codice modificato, nessun test scritto (invarianti §19.6 R.Q2).

---

> **verdict: conditional**
> Finding bloccante-soft: **M-1** (500 su `from`/`to` malformati + input riflesso nell'header). Qualità test:
> **M-2** (T-SEC-01 monodirezionale + AC `?userId=altro` non testato → delega `qa-dev`). Low: L-1 (limit 500),
> L-2 (dead code fixture), L-3 (filename fallback). Route sicuro (no IDOR), AC principali soddisfatti, `ics` presente.

*Report generato da code-reviewer (CQRL v2.12). Verdetti advisory: ruleset `emergent` interamente `status: candidate`.*
