# CQRL Code Review — Batch 2 (TSK-005 … TSK-009)

- **Reviewer**: code-reviewer (CQRL v2.12) — passate: idiomaticità → design → robustezza
- **Repo**: soli-turnly · `code/app`
- **Generato**: 2026-07-14
- **Stack rilevato**: Next.js 15 App Router · TypeScript 5 (`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`) · Drizzle · Zod · TanStack Table/Query/Virtual · date-fns v3 · Inngest · SSE nativo
- **Modalità**: stack-aware. **Nota di processo**: `code_quality/rules/{canonical,team-specific,emergent}` sono vuote (solo `.gitkeep`). I `rule_id` citati sotto sono identificatori canonici *convenzionali proposti*: andrebbero seminati in `code_quality/rules/canonical/` (gate umano). Nessuna regola è stata inventata come "attiva".

## Verdetti sintetici

| TSK | Titolo | Verdict | Blocker principali |
|---|---|---|---|
| TSK-005 | Matrice Admin TanStack Table | **conditional** | Validazione inline inerte (props non cablate) + type errors |
| TSK-006 | Business Rules Engine RB-01..17 | **conditional** | 1 test unitario fallito + `process.env` in pure fn + type error `validateNoOverlap` |
| TSK-007 | Frontend Forms + Zod | **conditional** (il più debole) | `lib/zod` non compila (Zod v4), ApprovalPanel non funzionante, parità T-INT-01 mancante sul form turno |
| TSK-008 | Notifications SSE | **conditional** (il più solido) | reconnection disabilitata + `ORDER BY` mancante |
| TSK-009 | Audit + Inngest jobs | **conditional** | i 3 job Inngest non compilano (API v4) + DST non gestito in generazione |

> Nessun verdict `reject`: nessun problema di sicurezza né loop esaurito; tutti i finding sono correggibili. Tuttavia **nessun TSK è `pass`**: un `npm run typecheck` pulito è precondizione minima e attualmente fallisce (vedi finding trasversale CQ-000).

---

## CQ-000 — Finding trasversale (blocca tutti i TSK): il progetto non compila né passa i test

- **Severity**: critical · `[^rule: deps.stability.no-latest-pinning]` · `[^rule: ts.correctness.strict-typecheck]` · `[^rule: qa.testing.suite-must-pass]`
- `npx tsc --noEmit` → **126 errori** distribuiti su tutti e 5 i TSK.
- `npx vitest run` → **34 test file falliti** (i file Playwright sotto `tests/{e2e,a11y,visual}` vengono raccolti erroneamente da Vitest) **+ 1 test unitario fallito**.
- **Causa radice**: `package.json` fissa dipendenze critiche a `"latest"` → risolte a **major diverse** da quelle per cui il codice è scritto:
  - `zod@4.4.3` (codice scritto per Zod v3: `z.record(z.unknown())` ora richiede key+value; `errorMap` sostituito da `error`) → `lib/zod/index.ts:130,133,143,334`.
  - `inngest` (API `createFunction(options, trigger, handler)` → "Expected 2 arguments, but got 3") → tutti i job in `lib/jobs/`.
- **Config test**: `vitest.config.ts` non definisce `include`/`exclude`, quindi `vitest run` raccoglie anche gli spec Playwright e va in errore → `npm run test` esce non-zero (viola l'AC "npm run test 100% pass" di TSK-006).
- **Azione**: pinnare le major (`zod@^3`, `inngest@^3`, ecc.) o adeguare il codice alle API v4; restringere `vitest.config.ts` (`include: ['**/*.test.ts']`, `exclude: ['tests/e2e/**','tests/a11y/**','tests/visual/**']`).

---

## TSK-005 — Matrice Admin (TanStack Table) — **conditional**

### Finding critici
1. **Validazione inline strutturalmente inerte** — `[^rule: react.state.wire-props]` (critical)
   `ShiftEditor` cabla correttamente il rules engine (`validateShift` da `@/lib/rules`), ma `ShiftGrid` lo istanzia **senza passare `existingShifts` né `absences`** → default `[]` `[^src5: code/app/components/matrix/ShiftGrid.tsx:587]`. Di conseguenza in `ShiftEditor.runLocalValidation` RB-01 (sovrapposizione) e RB-08 (assenza) non hanno dati e **non scattano mai**. Gli AC "Violazione RB-01 → bordo rosso + salvataggio bloccato (T-DOM-02)" e "Avviso RB-02 → bordo ambra (T-DOM-03)" non sono soddisfatti a runtime.
2. **Violazioni di cella mai calcolate** — `[^rule: code.no-stub-in-done]` (high)
   `ShiftGrid` cella: `const cellViolations: RuleViolation[] = []` con `// TODO TSK-006` `[^src5: code/app/components/matrix/ShiftGrid.tsx:326]`. TSK-006 è `done` ma il TODO non è stato chiuso: nessun bordo/badge di violazione appare mai nella griglia.
3. **Type errors (non compila)** — `[^rule: ts.correctness.no-unchecked-index-access]` (high)
   - `ShiftEditor.tsx:99` `sh/sm/eh/em` possibly undefined (destrutturazione da `split(':').map(Number)`); `ShiftEditor.tsx:122` `ShiftInput.id` viola `exactOptionalPropertyTypes`.
   - `ShiftGrid.tsx:100-101` (`parseISOWeekParam` match[1]/[2]); `ShiftGrid.tsx:173` `initialData` opzionale; `matrix/page.tsx:71-72`.

### Finding minori
- **Timezone impliciti**: `buildISODatetime`/`absenceMap`/`startOfDay` usano il fuso di sistema, non Europe/Rome, malgrado lo stack imponga `@date-fns/tz` (RB-12/T-DOM-08) — `[^rule: domain.tz.explicit-timezone]` (medium). Coerente ma fragile su deploy non-UTC.
- Errori API non mappati sui field: `ShiftEditor` mostra solo `mutation.error.message`; `useShifts` (a differenza di `useRequests`/`useUsers`) **non preserva `issues`** → nessun field-error da 400 (collegato a TSK-007) — `[^src5: code/app/hooks/useShifts.ts:124]`.

### Positivi
Buona a11y (`role="grid"`/`gridcell`, `aria-*`, focus-visible, keyboard su celle), `shiftMap` O(1), virtualizzazione righe corretta, celle-assenza non cliccabili (T-DOM-04 OK), skeleton/alert states.

---

## TSK-006 — Business Rules Engine RB-01..17 — **conditional**

### Finding critici
1. **Test unitario fallito** — `[^rule: qa.testing.test-impl-consistency]` (high, verificato)
   `lib/rules/__tests__/index.test.ts:57` ("RB-09 → blocking") fallisce: `validatePastShift` è `warning` di default (blocking solo con `PAST_SHIFT_STRICT=true`), quindi `result.valid` è `true` e `blocking` non contiene RB-09. Il test asserisce il contrario. Viola l'AC "100% pass". Fix: o RB-09 default blocking, o allineare il test (segnalato come `qa.*` → completamento a `qa-dev`).
2. **`process.env` dentro "pure function"** — `[^rule: ts.purity.no-env-read-in-pure-fn]` (high)
   `validateMinRest`, `validatePastShift`, `validateLeaveNotice` leggono `process.env` via `isStrict()`/`getNoticeHours()` `[^src5: code/app/lib/rules/validateMinRest.ts:13]` `[^src5: code/app/lib/rules/validatePastShift.ts:11]`. Rompe il contratto AC "pure function (no side effects)" e — poiché queste var non hanno prefisso `NEXT_PUBLIC_` — **su client sono sempre `undefined`**: FE e BE possono divergere sulla severity, violando la parità T-INT-01. La config dovrebbe essere iniettata via parametro/oggetto config.
3. **Type error** — `[^rule: ts.correctness.no-unchecked-index-access]` (medium)
   `validateNoOverlap.ts:42` accede a `overlapping[0]` senza guard sotto `noUncheckedIndexedAccess` (TS2532 ×3).

### Finding minori
- **Import morto**: `validateSwap.ts:16` importa `validateCoverage` mai usato — `[^rule: ts.hygiene.no-unused-imports]` (low).
- **`differenceInHours` tronca**: `validateMinRest`/`validateLeaveNotice` riportano ore intere (es. "10h" per 10h30m) e arrotondano la soglia — usare `differenceInMinutes/60` — `[^rule: domain.time.precision]` (low).
- **Confini giorno/settimana in fuso di sistema** (RB-03/04/05/11): `startOfDay`/`startOfISOWeek` + `validateRecurrence` `startOfDay(date).toISOString().slice(0,10)` producono off-by-one se il runtime non è UTC — `[^rule: domain.tz.explicit-timezone]` (medium).
- Naming fuorviante in `validateSwap` (`existingForA` valida in realtà il turno che va all'utente B) (low, leggibilità).

### Positivi
Architettura pulita (tipi condivisi, `emptyResult`/`mergeResults`/`addViolation`, barrel + `validateShift` composita), copertura test buona su RB-01/02/08/10/12, `calculateShiftDurationMinutes` DST-safe corretto (aritmetica su istanti).

---

## TSK-007 — Frontend Forms & Zod Validation — **conditional (il più debole)**

### Finding critici
1. **`lib/zod/index.ts` non compila** — `[^rule: deps.stability.no-latest-pinning]` (critical)
   Scritto per Zod v3, eseguito con Zod v4.4.3: `z.enum(..., { errorMap })` e `z.record(z.unknown())` non validi (`index.ts:130,133,143,334`). Essendo lo schema condiviso FE+BE, l'errore si propaga a tutti i consumatori.
2. **`ApprovalPanel` non funzionante + type errors** — `[^rule: api.contract.status-enum-consistency]` (high, verificato)
   Usa lo status `'pending'` che **non esiste** nell'enum `RequestStatus` (`draft|sent|awaiting_colleague|approved|rejected|cancelled|applied`):
   - `ApprovalPanel.tsx:87,127` `request.status === 'pending'` → TS2367 (no overlap) e `isPending` **sempre false** → i bottoni Approva/Rifiuta non si renderizzano mai (AC "mostra pannello impatto prima di approvare" non soddisfatto).
   - `ApprovalPanel.tsx:48` `Record<RequestStatus,string>` incompleto (TS2353); `ApprovalPanel.tsx:144` `request.createdAt` non esiste su `RequestRow` (TS2339) → `undefined` a runtime.
3. **Parità T-INT-01 non rispettata sul form turno principale** — `[^rule: react.forms.shared-validation-schema]` (high)
   `ShiftEditor` definisce uno `shiftFormSchema` locale (startTime/endTime `HH:MM`) invece di importare `shiftCreateSchema` da `@/lib/zod` (startDt/endDt ISO). L'AC #1 ("stesso file importato da FE e BE") non è soddisfatto proprio per il form più critico. (ProfileForm/RequestForm/ApprovalPanel invece usano gli schemi condivisi — bene.)
4. **Crash Radix su lista scambio vuota** — `[^rule: radix.select.no-empty-value-item]` (high)
   `RequestForm.StepShiftSwap` rende `<SelectItem value="" disabled>` quando non ci sono turni `[^src5: code/app/components/requests/RequestForm.tsx:300]`. Radix `Select.Item` con `value=""` lancia a runtime. (Il pattern corretto `__none__` è già usato in `ShiftEditor` — incoerenza interna.)

### Finding minori
- **Payload richieste non validato**: `requestCreateSchema.payload = z.record(z.unknown())` → i campi dinamici (`payload.startDate`, `payload.absenceType`, …) non hanno validazione Zod/FormMessage lato client (AC "messaggi sul campo corretto" non coperto per lo step 2). Serve un discriminated union per `type` — `[^rule: validation.request-payload-typed]` (medium).
- `RequestForm.tsx` type errors su `useForm`/`defaultValues` (`type: undefined`) e passaggio `form` ai sotto-step (TS2322 ×4 + TS2345) (medium).

### Positivi
`ProfileForm` esemplare per T-SEC-04 (schema `.strict()`, campi contrattuali in sola lettura, `aria-readonly`). Mapping `issues → form.setError` corretto in `useCreateRequest`/`usePatchMe`. Loading states e a11y coerenti.

---

## TSK-008 — Notifications SSE — **conditional (il più solido)**

### Finding critici
1. **Reconnection SSE disabilitata** — `[^rule: sse.reconnect.preserve-recovery]` (medium→high per l'obiettivo TSK)
   `useNotifications.es.onerror` chiama `es.close()` `[^src5: code/app/hooks/useNotifications.ts:114]`. Il commento afferma che "il browser riconnette", ma `close()` porta a `CLOSED` e **impedisce** la riconnessione automatica anche su blip transitori → contraddice l'obiettivo TSK "recovery su disconnessione". Va distinto il caso 401 (chiudi) dal transitorio (lascia riconnettere/`readyState`).

### Finding minori
- **`GET /api/notifications` senza `ORDER BY`** — `[^rule: api.pagination.deterministic-order-by]` (medium)
   Il docstring promette "ORDER BY readAt NULLS FIRST, createdAt DESC" ma la query non ha `.orderBy()` `[^src5: code/app/app/api/notifications/route.ts:32]` → paginazione non deterministica e "non lette per prime" non implementato.
- **Type errors `exactOptionalPropertyTypes`** in `notifications/[id]/read/route.ts:48` e `read-all/route.ts:39` (ip/userAgent) (medium).
- **Broker in-memory vs deploy Vercel**: limitazione multi-istanza ben documentata `[^src5: code/app/lib/sse/broker.ts:9]` ma incompatibile col target di deploy dichiarato (Vercel serverless): AC "multi-tab" regge solo su singola istanza — `[^rule: arch.deploy-target-consistency]` (medium, documentato).

### Positivi
Broker con cleanup delle entry vuote e `clientCount`, heartbeat 30s + evento `connected`, `cancel()` che rimuove il controller e ferma il timer, gate 401 (T-SEC-03), `emitToRole` best-effort con try/catch. I file core SSE **compilano puliti**.

---

## TSK-009 — Audit Log & Inngest Jobs — **conditional**

### Finding critici
1. **I 3 job Inngest non compilano** — `[^rule: deps.stability.no-latest-pinning]` (high)
   `generateRecurringShifts.ts:159`, `sendNotificationEmail.ts:154`, `cleanExpiredSessions.ts:36` → `createFunction` "Expected 2 arguments, but got 3" + `event`/`step` implicit `any` (cascata TS7031/TS7006). API Inngest divergente dalla versione installata.
2. **Generazione ricorrenze non DST-safe** — `[^rule: domain.tz.explicit-timezone]` (high)
   `generateRecurringShifts` costruisce `new Date("${dateStr}T${HH}:${mm}:00Z")` (UTC naive) con nota "usare fromZoned in produzione" `[^src5: code/app/lib/jobs/generateRecurringShifts.ts:261]`. Un turno "08:00 Europe/Rome" viene salvato come 08:00Z (= 09:00/10:00 locali) → offset 1-2h sui turni generati, in contrasto con RB-12/T-DOM-08 (AC T-REC-01). Inoltre `getDay()/getMonth()` locali + `toISOString()` UTC → possibile off-by-one del giorno su runtime non-UTC.

### Finding minori
- **Nome file ≠ export**: `cleanExpiredSessions.ts` esporta `cleanOldNotifications` (pivot documentato: JWT stateless, nessuna tabella `sessions`). Rinominare il file per discoverability — `[^rule: code.file-export-name-match]` (low). L'AC parlava di `cleanExpiredSessions`.
- **RB-11 festivi mai applicati**: `validateRecurrence(..., [])` sempre con lista festivi vuota (Q_001 aperta) — gap documentato (low).
- `audit-log/route.ts:95` type error su aggregate `.value` (medium, fuori path stretto ma correlato).

### Positivi
`insertAuditLog` robusto (fail-safe try/catch, non blocca la request), `extractIp`/`extractUserAgent` corretti, `AuditAction` union esaustiva. `sendNotificationEmail` con provider Resend condizionale + stub dev e gestione `exactOptionalPropertyTypes` via spread. `cleanOldNotifications` cron TZ-aware e safe su DB vuoto. Step Inngest ben decomposti e idempotenti.

---

## Prossimi step consigliati (per il dev-agent, scope-limited)

Priorità in ordine (`router: severity-tiered`, `max_diff_lines: 80` per iterazione):
1. **CQ-000**: pinnare major deps (`zod@^3`, `inngest@^3`, …) o migrare a v4 API; scoping `vitest.config.ts`. Sblocca typecheck e test.
2. **TSK-007**: allineare `ApprovalPanel` all'enum reale (`sent`→pending display, rimuovere `createdAt`→`submittedAt`), sostituire `SelectItem value=""` con sentinella.
3. **TSK-005**: passare `existingShifts`/`absences` da `ShiftGrid` a `ShiftEditor` e calcolare `cellViolations` con `@/lib/rules`.
4. **TSK-006**: allineare test/impl RB-09; estrarre config strict da `process.env` a parametro.
5. **TSK-009**: adeguare firma `createFunction`; introdurre `@date-fns/tz` nella generazione.
6. **TSK-008**: non chiudere l'EventSource su errori transitori; aggiungere `ORDER BY`.

> I test mancanti/da correggere (RB-09, payload richieste, ecc.) sono `severity: medium` con `rule_id: qa.*` e vanno completati da **qa-dev**, non dal code-reviewer.
