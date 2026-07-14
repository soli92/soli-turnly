# CQRL Batch 7 — Code Review TSK-029 / TSK-030 / TSK-031

- **Reviewer**: code-reviewer@2.12.0 (CQRL v2.12)
- **Generato**: 2026-07-14T12:21:54Z
- **Stack rilevato**: TypeScript 5.x / Next.js 15 (App Router) + Drizzle + React Email + Playwright — confidence ~0.9 (da `raw/tech_stack.md`, `package.json`)
- **Passate eseguite**: idiomaticità · design · robustezza (accessibility delegata a EP-007 / TSK-030 stesso)
- **Sprint**: 3 (finale) · Wave 1/2/3

---

## ⚠️ Meta-finding di processo (BLOCCANTE per il flusso CQRL automatico)

Il ruleset locale `code_quality/rules/{team-specific,emergent,canonical}/` di soli-turnly è
**vuoto** (solo `.gitkeep`). L'unico rule pack disponibile è nel repo factory padre
(`code_quality/rules/canonical/design-complexity.md`, solo regole di complessità
language-agnostiche, non pertinenti a questi 3 TSK).

Secondo `code-review-protocol §Regole anti-corner-case`, con ruleset vuoto il CQRL
automatico farebbe **ABORT** ("Popola `code_quality/rules/canonical/...` o disabilita CQRL").
Poiché questa review è stata **richiesta esplicitamente dall'umano** con path report custom
(override tipo `/review`), procedo in **modalità degradata/bootstrapping**:

- **Nessun finding cita una `rule_id` attiva** (non esistono).
- Ogni finding propone una `rule_id` **candidate** (tier `emergent`, `status: candidate`)
  secondo la convenzione `{language}.{framework}.{context}.{slug}`.
- **L'attivazione di queste regole è gate umano** (§19.5 step 3-4). Le proposte NON sono
  applicate né promosse in questo run.

**Azione raccomandata all'owner**: popolare `code_quality/rules/canonical/ts.nextjs.*`,
`ts.react-email.*`, `playwright.*`, `qa.testing.*` (o promuovere le candidate qui sotto)
prima di affidarsi al dispatch CQRL automatico, altrimenti ogni futura review andrà in ABORT.

---

## Verdetti (sintesi)

| TSK | Layer | Verdict | High | Medium | Low | Note |
|---|---|---|---|---|---|---|
| **TSK-029** | be | **CONDITIONAL** | 2 | 3 | 3 | Dispatch/template funzionanti; robustezza serverless + timezone da correggere |
| **TSK-030** | qa | **CONDITIONAL** | 1 | 3 | 2 | Test corretti ma baseline visive assenti + duplicazione fixture |
| **TSK-031** | be | **CONDITIONAL (light)** | 0 | 2 | 2 | Endpoint production-ready; solo hardening della test-suite |

Nessun marker rosso (`no_progress`, `regression`, `loop_exhausted`) — iter 1/3 per tutti.
Nessun problema di sicurezza rilevato (endpoint `.ics` correttamente vincolato a
`session.user.id`, T-SEC-01 rispettato a livello di codice).

---

## TSK-029 — Email templates React Email + dispatch Inngest — CONDITIONAL

**AC verificati come soddisfatti**: template React Email tipizzati creati (4 + base-layout +
barrel), `render()` con fallback prop → HTML non vuoto, stub senza `RESEND_API_KEY`, dispatch
`notification/email.send` cablato in tutti e 4 gli handler (approve/reject/accept-swap/shifts)
con try/catch, `SwapRequestEmail` completo (richiedente + turni + CTA).

### [H1] Fire-and-forget non affidabile in ambiente serverless (Vercel)
- **Severity**: high · **fix_complexity**: low · **auto_fixable**: no
- **File**: `code/app/app/api/shifts/route.ts:156`,
  `code/app/app/api/requests/[id]/approve/route.ts:89`,
  `code/app/app/api/requests/[id]/reject/route.ts:88`,
  `code/app/app/api/requests/[id]/accept-swap/route.ts` (blocco dispatch)
- **rule_id (candidate)**: `ts.nextjs.robustness.serverless_fire_and_forget`
- **Rationale**: il dispatch usa `void (async () => { ... })()` **dopo** che la funzione
  ritorna la `Response`. Su Vercel (deploy dichiarato in `tech_stack.md`) il runtime può
  congelare/terminare l'invocazione appena la risposta è inviata → l'`inngest.send()` pendente
  viene droppato in modo silenzioso. In dev (processo Node persistente) funziona e i test
  passano; in produzione l'email può **non partire mai**. Idiomatico Next.js 15: `after()` da
  `next/server` (o `waitUntil()` da `@vercel/functions`) per lavoro post-risposta garantito.
- **Verificato**: nessun `after`/`waitUntil`/`runtime` presente nei 4 route (grep).

### [H2] Orari/date email non timezone-safe — viola vincolo normativo Europe/Rome
- **Severity**: high · **fix_complexity**: low · **auto_fixable**: no
- **File**: `code/app/app/api/shifts/route.ts:82-90` (`formatDateIt`), `:95-97` (`formatTime`)
- **rule_id (candidate)**: `ts.robustness.timezone_unsafe_datetime`
- **Rationale**: `new Date(isoDate + 'T00:00:00')` e `dt.toLocaleTimeString('it-IT', {...})`
  **senza** `timeZone: 'Europe/Rome'` usano il fuso del server (UTC su Vercel). L'email
  "turno assegnato" mostrerà orari sfalsati di 1-2h rispetto al turno reale. `tech_stack.md`
  impone esplicitamente `date-fns v3 + @date-fns/tz` Europe/Rome DST-safe (RB-12 / T-DOM-08)
  e "no moment.js / no Date raw". Qui si usa `Date` nativo + `toLocale*` senza tz → deriva dallo
  stack normativo e produce un dato utente errato. Riusare l'utility date-fns già in stack.

### [M1] Duplicazione del blocco dispatch tra i tre handler `requests/[id]/*`
- **Severity**: medium · **fix_complexity**: medium · **auto_fixable**: no
- **File**: `approve/route.ts:88-118`, `reject/route.ts:87-119`, `accept-swap/route.ts` (dispatch)
- **rule_id (candidate)**: `ts.design.duplication_across_handlers`
- **Rationale**: approve e reject sono quasi identici (stessa lookup `requester`, stesso
  `period = submittedAt.toLocaleDateString`, stesso IIFE try/catch, stesso `humanizeRequestType`
  duplicato per file). Un tech lead che manutiene 2 anni dovrà correggere il bug timezone/period
  in ≥3 punti. Estrarre `dispatchRequestOutcomeEmail(request, outcome, notes)` in `lib/` (unico
  punto di verità per lookup, formatting, guardia email-presente).

### [M2] Campo `period` semanticamente errato nelle email approvazione/rifiuto
- **Severity**: medium · **fix_complexity**: low · **auto_fixable**: no
- **File**: `approve/route.ts:107`, `reject/route.ts` (analogo)
- **rule_id (candidate)**: `ts.design.semantic_field_mismatch`
- **Rationale**: si passa `period: existing.submittedAt?.toLocaleDateString('it-IT')`, cioè la
  **data di invio** della richiesta, ma il template `RequestApprovedEmail` la etichetta
  "**Periodo**" (inteso come intervallo ferie/permesso). L'utente vede la data di submission
  sotto l'etichetta "Periodo" → informazione fuorviante. Ricavare il periodo reale dal
  `payload`/date della richiesta. (Anche qui `toLocaleDateString` senza timeZone, cfr. H2.)

### [M3] Prop mancanti degradate silenziosamente a stringa vuota
- **Severity**: medium · **fix_complexity**: low · **auto_fixable**: no
- **File**: `code/app/lib/jobs/sendNotificationEmail.ts:83-135` (`buildEmailHtml`)
- **rule_id (candidate)**: `ts.robustness.silent_empty_defaults`
- **Rationale**: ogni prop assente fa fallback a `''`. Soddisfa l'AC "render non lancia", ma
  un payload malformato produce email reali con "Ciao ," / "Data: ". Meglio validare il payload
  con uno schema Zod per-template e **non inviare** (o loggare warning) se mancano campi
  obbligatori, invece di spedire un'email vuota al cliente.

### [L1] Default branch dello switch espone il payload grezzo
- **Severity**: low · **File**: `sendNotificationEmail.ts:137-140`
- **rule_id (candidate)**: `ts.react-email.idiomaticity.exhaustive_switch_assertnever`
- **Rationale**: il `default` ritorna `<p>${JSON.stringify(payload)}</p>`. Irraggiungibile con
  l'unione `EmailTemplate` attuale, ma un futuro template dimenticato spedirebbe JSON grezzo in
  un'email. Sostituire con `assertNever(template)` (exhaustiveness check a compile-time).

### [L2] Non-null assertion ripetute su `newShift!`
- **Severity**: low · **File**: `shifts/route.ts:142,151-152,186-188`
- **rule_id (candidate)**: `ts.idiomaticity.non_null_assertion`
- **Rationale**: `newShift!` dopo `.returning()` sopprime il tipo `T | undefined`. Se l'insert
  non ritorna righe → `TypeError` opaco. Preferire un check esplicito con errore parlante.

### [L3] `subject` hardcoded nel route invece che nel template
- **Severity**: low · **File**: `approve/route.ts:102`, `shifts/route.ts:182`, ecc.
- **rule_id (candidate)**: `ts.design.subject_colocation`
- **Rationale**: l'oggetto email vive nel route handler, il corpo nel template: due fonti di
  verità per lo stesso messaggio. Co-locare subject + preview + body nel modulo template.

---

## TSK-030 — Visual regression + A11y — CONDITIONAL

**AC verificati come soddisfatti**: spec visual per tutte le pagine Sprint 2/3, spec a11y
sprint2/sprint3 con axe-core (tag wcag2a→wcag22aa, filtro critical+serious, test negativo di
sanity, check dedicato `color-contrast`), progetti `visual-desktop`/`visual-mobile` in
`playwright.config.ts`, fixture `visual-db.ts` con seed documentato.

### [H1] Nessuna baseline screenshot committata — AC esplicito non soddisfatto
- **Severity**: high · **fix_complexity**: medium · **auto_fixable**: no
- **File**: `code/app/tests/visual/__snapshots__/{desktop,mobile}/` (solo `.gitkeep`)
- **rule_id (candidate)**: `qa.testing.missing_visual_baseline`
- **Rationale**: `git ls-files` → **0 PNG** tracciati. L'AC richiede "screenshot baseline
  commitati in `tests/visual/__snapshots__/`". Senza baseline la suite di visual regression ha
  **valore protettivo nullo** (niente con cui confrontare); in CI Playwright **fallisce** su
  snapshot mancante (a meno di `--update-snapshots`), quindi l'AC "0 failed dopo generazione
  baseline" non è dimostrabile. Serve un run seed+app per generare e committare le baseline
  (o documentare il perché dell'assenza). Route a `qa-dev`.

### [M1] Strategia viewport ambigua: doppio meccanismo desktop/mobile
- **Severity**: medium · **fix_complexity**: medium · **auto_fixable**: no
- **File**: `playwright.config.ts:56-78` + `tests/visual/**/*.spec.ts` (es.
  `coverage-monitor.spec.ts:60-64`, `swap-admin.spec.ts:46-56`)
- **rule_id (candidate)**: `playwright.design.viewport_strategy_conflict`
- **Rationale**: i progetti `visual-desktop` (1280) e `visual-mobile` (375) eseguono **entrambi
  tutti** gli spec in `tests/visual`, ma gli spec impostano anche `page.setViewportSize(375)`
  manualmente per i test "mobile". Risultato: un test "mobile light" gira sotto il progetto
  desktop (nome file → `__snapshots__/desktop/`) forzando 375px, e un test "desktop light" gira
  anche sotto il progetto mobile (375px) col nome `...-desktop-light.png`. Baseline
  ridondanti/fuorvianti e tempo CI raddoppiato. Scegliere **una** strategia: viewport dal
  progetto (rimuovere `setViewportSize`, nominare via `testInfo.project.name`) **oppure** un
  solo progetto con viewport manuale.

### [M2] Fixture `adminPage`/`setTheme` costruite ma non usate (astrazione morta)
- **Severity**: medium · **fix_complexity**: low · **auto_fixable**: no
- **File**: `tests/visual/fixtures/visual-db.ts:71-123` vs consumatori (es.
  `coverage-monitor.spec.ts:12`, `swap-admin.spec.ts:12`)
- **rule_id (candidate)**: `playwright.design.unused_fixture_abstraction`
- **Rationale**: gli spec importano `test` da `visual-db` (che espone `adminPage`,
  `employeePage`, `colleaguePage`, `setTheme`) ma poi usano il `page` base + inline
  `test.use({ storageState: 'tests/e2e/.auth/admin.json' })` e ripetono il toggle tema con
  `document.documentElement.setAttribute('data-theme','dark')` invece di `setTheme`. L'helper
  `setTheme` gestisce anche il ramo `light` (rimozione classe) che gli spec inline **saltano** →
  possibile leakage di stato dark tra screenshot. Usare le fixture fornite o rimuoverle.

### [M3] Screenshot condizionale che non può fallire (falso positivo di copertura)
- **Severity**: medium · **fix_complexity**: low · **auto_fixable**: no
- **File**: `tests/visual/sprint2/coverage-monitor.spec.ts:19-26`
- **rule_id (candidate)**: `qa.testing.conditional_assertion_noop`
- **Rationale**: `if ((await monitorTab.count()) > 0) { click }` — se il tab "Monitor copertura"
  non esiste, il test **salta il click e fotografa la pagina sbagliata** senza fallire. L'AC
  "screenshot cattura la cella sotto-coperta con sfondo rosso" non è garantito: il test dà
  confidenza falsa. Asserire la presenza del tab (o della cella rossa) come precondizione hard.

### [L1] `waitForTimeout` arbitrari (anti-pattern flakiness)
- **Severity**: low · **File**: `coverage-monitor.spec.ts:23,49,56`, `swap-admin.spec.ts:39`
- **rule_id (candidate)**: `playwright.idiomaticity.hardcoded_wait_timeout`
- **Rationale**: `waitForTimeout(500|200)` è sconsigliato ufficialmente da Playwright (flaky,
  rallenta la suite). Attendere una condizione deterministica (locator visibile, classe
  `data-theme` applicata, `toHaveScreenshot` con `animations:'disabled'`).

### [L2] Discrepanza dependencies a11y/e2e sul progetto `setup`
- **Severity**: low · **File**: `playwright.config.ts:31-50`
- **rule_id (candidate)**: `playwright.robustness.missing_project_dependency`
- **Rationale**: i progetti `a11y`, `visual-*` dichiarano `dependencies: ['setup']`, ma
  `chromium`/`firefox` (e2e) no. Convive un `globalSetup` separato: la doppia via (globalSetup +
  progetto `setup`) è confusa e rischia auth-state non generata se si esegue un singolo progetto.
  Chiarire un'unica sorgente di bootstrap dello storageState.

**Nota a11y**: la suite blocca su `critical || serious` mentre `factory.config.yaml` fissa
`severity_threshold: critical` — più stretto della config, accettabile e coerente con l'AC. La
delega a11y (EP-007) è rispettata; nessun finding a11y aggiuntivo dal code-review.

---

## TSK-031 — Export .ics endpoint — CONDITIONAL (light)

**Endpoint production-ready.** Verificato empiricamente `createEvents([])` del pacchetto `ics`
→ `{ error: null, value: '<VCALENDAR valido>' }`, quindi **AC3 (range vuoto → 200) è
soddisfatto** (nessun rischio di 500 sul ramo `!value`). T-SEC-01 corretto: filtro sempre su
`session.user.id`, `?userId` ignorato. Header `Content-Type`/`Content-Disposition`/`Cache-Control`
corretti. `ics ^3.12.0` presente in `package.json`. `CalendarToolbar` ha
`[data-testid="export-ics-btn"]` che chiama l'endpoint. **Nessun finding sul codice
dell'endpoint** — i rilievi sono tutti nella test-suite.

### [M1] Test che si auto-skippano silenziosamente (inclusa la verifica di sicurezza IDOR)
- **Severity**: medium · **fix_complexity**: medium · **auto_fixable**: no
- **File**: `tests/e2e/sprint3/ics-export.spec.ts:66-69` (AC2),
  `tests/e2e/fixtures/sprint3-db.ts:85-110` (`otherUserShiftId`)
- **rule_id (candidate)**: `qa.testing.self_skipping_test`
- **Rationale**: il test AC2 fa `test.skip(true, ...)` se non trova `BEGIN:VEVENT`, quindi le
  asserzioni `DTSTART`/`SUMMARY` possono **non eseguirsi mai** (dipendono dal seed). Più grave:
  la fixture `otherUserShiftId` fa `testInfo.skip(true, ...)` in 4 punti (users endpoint KO,
  lucia.verdi assente, shifts KO, 0 turni) → il test **T-SEC-01 (IDOR)** si auto-neutralizza in
  silenzio. Una regressione di sicurezza passerebbe come "skipped = verde". Rendere il seed
  deterministico e trasformare gli skip in fallimenti espliciti (o `fixme`) sui test critici.

### [M2] Fixture temporali accoppiate al "seed della settimana corrente"
- **Severity**: medium (borderline low) · **fix_complexity**: low · **auto_fixable**: no
- **File**: `ics-export.spec.ts:36-37,60-61,129-131`
- **rule_id (candidate)**: `qa.testing.time_coupled_fixture`
- **Rationale**: i test usano il range fisso `2026-07-01`/`2026-07-31`, ma il commento indica un
  seed "settimana corrente". Combinato con lo skip [M1], AC2 asserisce davvero solo finché
  "oggi" cade a luglio 2026; eseguito in un altro mese → 0 VEVENT → skip perpetuo. Allineare
  range del test e finestra del seed (entrambi derivati da una data-ancora condivisa).

### [L1] `.limit(500)` tronca silenziosamente export ampi
- **Severity**: low · **File**: `route.ts:52`
- **rule_id (candidate)**: `ts.robustness.silent_query_truncation`
- **Rationale**: un export con range annuale per un dipendente molto attivo può superare 500
  turni → eventi persi senza avviso. Improbabile ma silenzioso: paginare/streamare o alzare il
  limite documentandolo, oppure rifiutare range troppo ampi con 400.

### [L2] Cast `session.user.id as string` ripetuto
- **Severity**: low · **File**: `route.ts:35`
- **rule_id (candidate)**: `ts.idiomaticity.session_id_cast`
- **Rationale**: il cast `as string` compare in molti route. Estendere il tipo della sessione
  Auth.js (`declare module`) così `session.user.id` è già `string`, eliminando i cast sparsi.

---

## Loop status & prossimi step

- Iterazione **1/3** per tutti e tre i TSK. Nessun marker rosso.
- **TSK-029** → `task_package` per `be-dev`: priorità H1 (serverless `after()`), H2 (timezone
  Europe/Rome via date-fns), poi M1-M3. `max_diff_lines: 80` per finding; niente refactor
  opportunistico.
- **TSK-030** → `task_package` per `qa-dev`: priorità H1 (generare + committare baseline),
  poi M1 (strategia viewport unica), M2 (usare fixture), M3 (assert hard sul tab).
- **TSK-031** → `task_package` per `qa-dev`: hardening test (M1 skip → fail, M2 anchor date).
  Il **codice dell'endpoint non richiede modifiche**.

I `task_package` NON sono stati dispatchati automaticamente: `reject`/`conditional` con dispatch
al dev-agent richiedono conferma umana (gate §7 r.16 / router Fase 5). Le `rule_id` proposte
sono **candidate** e la loro promozione a `canonical`/`team-specific` è **gate umano** (§19.5).

---

## Note di trasparenza

- Review in **modalità degradata** per ruleset locale vuoto (vedi Meta-finding). Le severità
  sono assegnate con giudizio ingegneristico su convenzioni note, non su soglie di regole attive.
- CQRL **non copre la sicurezza** (SAST/secret/CVE — §19.6 R.Q7): l'osservazione su T-SEC-01
  riguarda l'**integrità del test** (M1 TSK-031), non un difetto di sicurezza del codice, che
  risulta corretto.
- Nessun test è stato scritto e nessun file di codice è stato modificato (invarianti R.Q2).
