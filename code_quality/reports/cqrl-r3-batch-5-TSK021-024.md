# CQRL Batch 5 — Code Review ITER-3 (FINALE) TSK-021 → TSK-024

- **Reviewer**: code-reviewer (CQRL v2.12)
- **generated_at**: 2026-07-14
- **iter**: 3 / `max_iterations` 3 → **ULTIMA ITERAZIONE. Loop ESAURITO dopo questo round.**
- **report precedente**: `code_quality/reports/cqrl-r2-batch-5-TSK021-024.md` (iter-2)
- **Scope**: verifica dei fix iter-3 applicati (TSK-021 overtime, TSK-024 seed/fixme,
  TSK-022 orfano+typo) + stato dei finding residui a chiusura loop.
- **Passate**: idiomaticità · design · robustezza · accessibilità (`passes` in config;
  a11y delegata a EP-007). Nessun pass `premortem-on-merge` (assente da `passes` → off).
- **Sicurezza**: fuori scope CQRL. Nessun secret in chiaro né CVE emersi → nessuna escalation R.Q7.

## Stack rilevato

Invariato: `typescript` · Next.js 15 App Router · React · TailwindCSS v4 · shadcn/ui (Radix) ·
TanStack Query v5 · React Hook Form + Zod · date-fns v3 · React Big Calendar · Drizzle ORM ·
Playwright. Confidence ≥ `confidence_min (0.6)` → **modalità stack-aware piena**.

> Le rule citate restano **bozze `emergent` `status: candidate`** (§19.5, gate umano). Nessuna
> promozione a `active`/`canonical` in questo run.

> **Nota di stato working tree**: il diff non committato include cancellazioni estese del route
> group `app/(admin)/**` (refactor verso `app/admin/**`), fuori dallo scope TSK-021..024
> (employee + test E2E). Non incide sui verdetti di questo batch; segnalata come osservazione di
> processo per il review del refactor admin (altro batch).

---

## Esito sintetico dei fix verificati (iter-3)

| Item | TSK | Finding | Severità | Esito iter-3 |
|---|---|---|---|---|
| Fix-021 | TSK-021 | F-021-1 overtime inline ≠ RB-06 | medium | **RISOLTO** (+ nuovo smell minore F-021-3) |
| Fix-024a | TSK-024 | F-024-3 email `luca` vs `lucia` | medium | **RISOLTO** (fixture allineata al seed) |
| Fix-024b | TSK-024 | F-024-2 `test.skip(true)` silenzioso | medium | **RISOLTO** (→ `test.fixme` + diagnostica) |
| Fix-022a | TSK-022 | F-022-3 i18n "richiestae" | low | **RISOLTO** |
| Fix-022b | TSK-022 | F-022-1 `RequestsListClient.tsx` orfano | medium | **NON RISOLTO** (3ª iter — no-progress) |
| residuo | TSK-024 | fixture header seed / DRY / swap non seminato | low | **PARZIALE** (declassato, non-bloccante) |
| residuo | TSK-023 | F-023-2 Zod locali · F-023-3 Suspense | med/low | **APERTO** (mai dispatchato — backlog) |

## Verdetto FINALE iter-3

| TSK | iter-1 | iter-2 | **iter-3 (finale)** | Blocking? | Nota di chiusura |
|---|---|---|---|---|---|
| TSK-021 Calendario | conditional | conditional | **PASSED** | no | finding primario chiuso; residuo minore a backlog |
| TSK-022 Le mie richieste | conditional | conditional | **CONDITIONAL · loop-exhausted → gate umano** | no | typo chiuso; orfano F-022-1 non chiuso in 3 iter |
| TSK-023 Wizard | conditional | conditional | **PASSED** | no | crash chiuso iter-2; design-debt mai dispatchato → backlog |
| TSK-024 E2E acceptance | conditional | conditional | **PASSED** (con handoff `qa-dev`) | no | anti-pattern skip chiuso; assert reali = competenza `qa-dev` |

Nessun `reject`. **3 PASSED, 1 CONDITIONAL** (loop esaurito → decisione umana, non nuova iterazione).
`review_iter` → **3 = max_iterations**.

---

## Dettaglio verifica fix iter-3

### Fix-021 · TSK-021 · F-021-1 — overtime per settimana ISO → RISOLTO ✅
`[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale]`

`computeHours` ora **importa e usa** la regola condivisa RB-06:
`import { calculateOvertime } from '@/lib/rules/calculateOvertime'`
`[^src5: code/app/hooks/useEmployeeCalendar.ts:21]`. La media aritmetica sul range è stata
rimossa; l'implementazione raggruppa i turni per settimana ISO (`startOfISOWeek`) e applica
`calculateOvertime(inp, existing, contractHoursPerWeek)` **per settimana**, sommando
`[^src5: code/app/hooks/useEmployeeCalendar.ts:100]`. Il docstring "ore extra su contractHours
settimanali" `[^src5: code/app/hooks/useEmployeeCalendar.ts:15]` è ora **coerente** con
l'implementazione → doc-code-mismatch chiuso. La logica è corretta: il filtro interno di
`calculateOvertime` (stesso userId, stessa settimana ISO) è ridondante col raggruppamento a
monte ma innocuo; il totale sommato per settimana è equivalente al comportamento RB-06 atteso.
**Finding primario chiuso.**

### F-021-3 · low/medium · robustezza — NUOVO (introdotto dal fix)
`[^rule: code_quality/rules/emergent/general.stringly-typed-coupling.md §Rationale]` *(bozza candidate)*

Il fix recupera il valore numerico dello straordinario **parsando la stringa di display** di
`calculateOvertime` via regex:
`result.info[0]?.message.match(/^Straordinario stimato: ([\d.]+)h/)`
`[^src5: code/app/hooks/useEmployeeCalendar.ts:125]`. `calculateOvertime` NON espone
`overtimeHours` in un campo strutturato — lo mette solo nel `message` INFO
`[^src5: code/app/lib/rules/calculateOvertime.ts:55]`. Conseguenza: qualsiasi riformulazione del
messaggio (i18n, wording) fa fallire silenziosamente il match → `overtimeHours` collassa a `0`
senza errore. Accoppiamento a una stringa human-readable per recuperare un numero già calcolato.

**Classificazione**: non-bloccante, nessun bug a runtime oggi (il formato combacia). **Fix
consigliato (backlog, NON in questo loop)**: esporre `overtimeHours: number` nel
`ValidationResult` di RB-06 (o helper dedicato) e consumarlo direttamente — evita il regex-parse.
Vincolo rispettato dal dev (max_diff_lines 80, no refactor del contratto RB-06): la scelta minima
è comprensibile, ma il debito va tracciato. Non modifica il verdetto PASSED di TSK-021.

### Fix-024a · TSK-024 · F-024-3 — email collega allineata → RISOLTO ✅
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]`

La fixture fa login del collega come **`lucia.verdi@turnly.dev`**
`[^src5: code/app/tests/e2e/fixtures/sprint2-db.ts:77]`, ora **coerente** con il seed
`[^src5: code/app/db/seed.ts:202]`. Il mismatch `luca` vs `lucia` (root cause del timeout della
fixture on-demand all'iter-2) è eliminato. Verifica aggiuntiva: `db/seed.ts` semina turni
lun-ven per **tutti** gli `employeeUsers` (incl. `mario.rossi` e `lucia.verdi`)
`[^src5: code/app/db/seed.ts:286]` → i prerequisiti "turni per entrambi gli attori" dei test
scambio esistono nel seed. **Determinismo email/turni chiuso.**

### Fix-024b · TSK-024 · F-024-2 — `test.skip` silenzioso → `test.fixme` → RISOLTO ✅
`[^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Rationale]`

In `employee-requests.spec.ts` (file target del finding) **tutte le 11** occorrenze sono passate
da `test.skip(true, …)` (verde silenzioso) a **`test.fixme(true, <diagnostica>)`**
`[^src5: code/app/tests/e2e/sprint2/employee-requests.spec.ts:102]`. Playwright riporta i
`fixme` come categoria distinta (known-broken), non come pass verde → l'anti-pattern
"hollow acceptance / silent green" è **eliminato**. Le diagnostiche sono **parlanti** e indicano
la remediation: es. `:176` "Nessun turno pianificato per mario.rossi nel DB seed — eseguire
db:seed", `:288` "Sessione collega non disponibile — verificare lucia.verdi@turnly.dev nel seed
e colleague.json in .auth/". Questo è l'idioma corretto per "test scritto, prerequisito BE non
pronto". **Anti-pattern chiuso.**

> **Handoff `qa-dev` (medium, NON bloccante CQRL)**
> `[^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Rationale]`: i test
> restano in stato `fixme` (pending), quindi **non validano ancora gli AC** finché il backend/
> endpoint non sono pronti e i `fixme` non vengono rimossi con asserzioni reali. La copertura
> effettiva è **competenza `qa-dev`**, non CQRL (§Regole: "mai scrivere test"). CQRL segnala e
> lascia il completamento a `qa-dev`. Dalla prospettiva *qualità del codice di test*, la fixture
> e le spec sono ora corrette e oneste → non blocca il verdetto CQRL.

### Fix-022a · TSK-022 · F-022-3 — i18n "richiestae" → RISOLTO ✅
`[^rule: code_quality/rules/emergent/fe.i18n.pluralization.md §Rationale]`

Ora `` `${total} richiest${total !== 1 ? 'e' : 'a'}` ``
`[^src5: code/app/components/employee/requests/MyRequestList.tsx:186]` → "1 richiesta" /
"2 richieste" / "Nessun risultato" per `total === 0`. La radice mobile (`richiest` + `e|a`)
corregge il typo "richiestae". **Chiuso.**

### Fix-022b · TSK-022 · F-022-1 — `RequestsListClient.tsx` orfano → NON RISOLTO ❌ (no-progress 3ª iter)
`[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Rationale]`

Scan aggiornato: il file **resta orfano**. Nessun import da alcun entry-point — le uniche
occorrenze del simbolo sono nel file stesso (docstring `:4` + dichiarazione `:51`)
`[^src5: code/app/app/(employee)/requests/_components/RequestsListClient.tsx:51]`. La pagina
continua a montare `MyRequestList` `[^src5: code/app/app/(employee)/requests/page.tsx:45]`. Il
file è stato ri-toccato (marcato `M` nel working tree) senza né eliminarlo né collegarlo.

Il finding proponeva una **decisione secca: eliminare OPPURE collegare**. Per la **3ª iterazione
consecutiva** (iter-1 → iter-2 → iter-3) né l'una né l'altra è stata compiuta → **no-progress
detection scattato** (R.Q4: stesso `rule_id` `general.dead-broken-code` sul medesimo target ≥ 2
volte di fila). Loop esaurito → **non è ammessa una 4ª iterazione automatica**.

---

## Stato finding residui (mai dispatchati — accepted debt / backlog)

Questi finding non erano nel set di fix di alcun round (mai consegnati al dev-agent): non
costituiscono "no-progress" (non c'è stato tentativo fallito), ma **debito di design da backlog**.
A loop esaurito e in assenza di finding bloccanti → non ostano al PASSED, sono raccomandati come
ticket di backlog.

- **F-023-2** (medium, design) — schema payload per-tipo ancora locali ai form (`swapPayloadSchema`,
  `modifyShiftPayloadSchema`), non estratti in `lib/zod/`. Backlog.
- **F-023-3** (low, idiomaticità) — `useSearchParams()` senza `<Suspense>` in `new/page.tsx`.
  Backlog.
- **TSK-024 residui low** (declassati, non-bloccanti):
  - fixture header `[^src5: code/app/tests/e2e/fixtures/sprint2-db.ts:8]` dichiara ancora "3
    coverage_requirements, 2 availability, 1 swap_operation" ma **la fixture non semina** (il seed
    reale è in `db/seed.ts`, eseguito via `db:seed`) → doc-code-mismatch residuo, ora **low**
    (la sostanza esiste in `db/seed.ts`, solo l'auto-descrizione della fixture è stale).
  - `swap_operation` **non seminato** in `db/seed.ts` (tabella `swapOperations` definita ma nessun
    `insert`). I test scambio creano lo swap via API in-test, quindi non è un blocco; la voce
    "1 swap_operation esistente" nell'header è aspirazionale/stale. Backlog.
  - DRY: `sprint2-db.ts` ri-dichiara `adminPage`/`employeePage` via `base.extend` da
    `@playwright/test` `[^src5: code/app/tests/e2e/fixtures/sprint2-db.ts:42]` invece di estendere
    il `test` base di `fixtures/index.ts` che li definisce già
    `[^src5: code/app/tests/e2e/fixtures/index.ts:27]`. Minore. Backlog.
- F-021-2 (`initialData` cross-key), F-023-4 (doppi cast), F-024-5 (T-SEC-01 200 vs 403):
  fuori dai fix di ogni round → presunti invariati, backlog.

---

## Loop status (R.Q4) — CHIUSURA

- `review_iter`: **3** / `max_iterations` 3 → **loop ESAURITO** (nessuna ulteriore iterazione
  automatica ammessa, R.Q4 non bypassabile).
- **Progresso complessivo iter-2 → iter-3**: SÌ, netto. Chiusi in questo round: F-021-1, F-022-3,
  F-024-3 (email/turni), F-024-2 (anti-pattern skip). Insieme dei finding aperti fortemente ridotto.
- **No-progress detection**: SCATTATO su **F-022-1** (`general.dead-broken-code`), stesso
  `rule_id`/target per 3 iterazioni → **escalation umana** (R.Q3 + §7 r.16).
- **Regression detection**: una **nuova** segnalazione minore (F-021-3, stringly-typed coupling)
  introdotta dal fix TSK-021 nel file toccato (`useEmployeeCalendar.ts`) — non è una regressione
  funzionale (nessun bug a runtime), è debito di robustezza. Nessuna regressione in file NON
  dichiarati dai fix.
- **Marker**: `loop-exhausted` applicato a **TSK-022** (verdict `conditional` congelato → gate
  umano). TSK-021 / TSK-023 / TSK-024 chiusi `passed` (nessun finding bloccante, no-progress
  assente).

## Prossimo step

Loop CQRL esaurito. Non si produce un nuovo `task_package` per re-Develop automatico. Azioni
umane richieste:

1. **TSK-022 · F-022-1 — GATE UMANO (R.Q3)**: decisione secca sul componente orfano
   `RequestsListClient.tsx` — *eliminare* (dead code) **oppure** *collegare* al posto di/insieme a
   `MyRequestList`. Il pattern "riparato-ma-orfano" ha consumato effort in 3 round senza chiudere
   il debito. Il code-reviewer NON auto-rimuove (R.Q2). Consigliata rimozione salvo intento
   esplicito di wiring.
2. **`qa-dev` · TSK-024**: rimuovere i `test.fixme` sostituendoli con asserzioni reali degli AC
   quando gli endpoint BE sono pronti; opzionale seed di `swap_operation` + allineamento header
   fixture. Competenza test = `qa-dev`.
3. **Backlog design-debt** (non-bloccante): F-021-3 (esporre `overtimeHours` strutturato da RB-06),
   F-023-2 (Zod condivisi in `lib/zod/`), F-023-3 (Suspense), DRY fixture, F-021-2/F-023-4/F-024-5.

> Frontmatter TSK suggerito: `review_status: passed` (TSK-021, TSK-023, TSK-024),
> `review_status: conditional` + `review_iter: 3` + marker `loop-exhausted` (TSK-022).
> `review_report: code_quality/reports/cqrl-r3-batch-5-TSK021-024.md`.

> Le rule citate sono **bozze `emergent` `status: candidate`**: promozione a `active`/`canonical`
> è gate umano (§19.5). La bozza `general.stringly-typed-coupling.md` (F-021-3) è nuova candidate.
