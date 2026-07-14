# CQRL Batch 7 — Code Review ROUND 2 · TSK-029 / TSK-030 / TSK-031

- **Reviewer**: code-reviewer@2.12.0 (CQRL v2.12)
- **Generato**: 2026-07-14 (iter 2/3)
- **Stack rilevato**: TypeScript 5.x / Next.js 15 (App Router `^15.0.0`) + Drizzle + React Email + Playwright — confidence ~0.9 (`raw/tech_stack.md`, `code/app/package.json`)
- **Passate eseguite**: idiomaticità · design · robustezza
- **Iter precedente**: `code_quality/reports/cqrl-batch-7-TSK029-031.md` (iter 1/3, tutti CONDITIONAL)
- **Nota di processo**: ruleset locale ancora vuoto → review in **modalità degradata/bootstrapping**; le `rule_id` restano **candidate** (gate umano §19.5). Nessuna regola applicata/promossa in questo run.

---

## Verdetti (sintesi round 2)

| TSK | Layer | Verdict iter 1 | Verdict iter 2 | Δ | High res. | Marker |
|---|---|---|---|---|---|---|
| **TSK-029** | be | CONDITIONAL | **CONDITIONAL** | H1 risolto · **H2 aperto** | 1/2 | — |
| **TSK-030** | qa | CONDITIONAL | **CONDITIONAL** | nessun fix applicato | 0/1 | **no_progress** (deferral acked) |
| **TSK-031** | be/qa | CONDITIONAL | **CONDITIONAL (light)** | fixture IDOR risolta · M1(AC2)+M2 aperti | n/a | — |

Nessun `regression` marker (i fix `after()` non introducono nuovi finding in file esterni allo scope). Nessun `loop_exhausted` (iter 2 < max 3). Nessun problema di sicurezza sul codice.

---

## TSK-029 — Email templates + dispatch Inngest — CONDITIONAL

### [H1] Fire-and-forget serverless → `after()` — ✅ RISOLTO
Verificato per-file: `void (async () => {})()` completamente rimosso (grep `void (async` → **0 match** in `app/`+`lib/`). Tutti e 4 gli handler migrano a `after()` importato correttamente da `next/server`:

- `code/app/app/api/shifts/route.ts` — import :15, `after(async () => {...})` :158 (con `const createdShift = newShift!` catturato prima della Response :157)
- `code/app/app/api/requests/[id]/approve/route.ts` — import :11, `after()` :91
- `code/app/app/api/requests/[id]/reject/route.ts` — import :10, `after()` :89
- `code/app/app/api/requests/[id]/accept-swap/route.ts` — import :12, `after()` :79 (con `currentUserId` catturato :78)

I dispatch `inngest.send()` girano ora dopo la Response con esecuzione garantita su Vercel; `try/catch` con `console.error` preservato in tutti. Le closure catturano i dati necessari prima del ritorno → nessuna race col freeze del runtime. `rule_id` candidate `ts.nextjs.robustness.serverless_fire_and_forget` → **soddisfatta**.

> Caveat basso (verify-only, non blocca): `after` è API **stabile solo da Next 15.1**; in 15.0.x era `unstable_after`. `package.json` pinna `"next": "^15.0.0"`. Verificare che il lockfile risolva a **≥ 15.1** o l'import fallirà al build. Nessuna azione se già ≥15.1.

### [H2] Date/orari email non timezone-safe (Europe/Rome) — ❌ NON RISOLTO (carried forward)
- **Severity**: high · **fix_complexity**: low · **auto_fixable**: no
- **File**: `code/app/app/api/shifts/route.ts:83-91` (`formatDateIt`), `:96-98` (`formatTime`); `approve/route.ts:109` e `reject/route.ts:107` (`period: existing.submittedAt?.toLocaleDateString('it-IT')`)
- **rule_id (candidate)**: `ts.robustness.timezone_unsafe_datetime`
- **Stato**: il fix **non è stato applicato**. `formatDateIt` usa ancora `new Date(isoDate + 'T00:00:00')` + `toLocaleDateString` **senza** `timeZone`; `formatTime` usa `toLocaleTimeString` senza `timeZone` (il commento :94 dichiara esplicitamente "timezone locale del server"). L'unico riferimento a Europe/Rome nel file è un `// TODO TSK-006` (:122).
- **Aggravante (nuova evidenza)**: esiste già in stack l'utility DST-safe `code/app/lib/date/index.ts` che espone `formatLocal`/`formatDate`/`formatTime`/`formatISODate` basate su `TZDate` + `APP_TIMEZONE = 'Europe/Rome'` (T-DOM-08/RB-12). Il route **la ignora** e ridefinisce localmente un `formatTime` che ne **shadowa il nome** con implementazione tz-unsafe. Su Vercel (server UTC) l'email "turno assegnato" mostrerà orari sfalsati di 1-2h.
- **task_package be-dev (iter 3)**: sostituire `formatDateIt`/`formatTime` locali con `formatISODate`/`formatLocal`/`formatTime` da `@/lib/date`; per `period` usare la stessa utility (o le date reali del payload, cfr. M2). Scope: solo H2, `max_diff_lines: 80`, niente refactor opportunistico.

### Finding non in scope round 1 (non toccati, ancora aperti)
`M1` duplicazione dispatch (`humanizeRequestType` duplicato in approve+reject), `M2` `period` = data di submission etichettata "Periodo", `M3` fallback silenzioso a `''`, `L1` default switch con `JSON.stringify`, `L2` `newShift!`, `L3` subject hardcoded nel route. Restano da valutare (deferiti); non bloccano ma da tracciare.

**Verdict TSK-029: CONDITIONAL** — progresso reale (H1 chiuso, migrazione pulita), ma **1 high (H2) resta aperto** su vincolo normativo. Non `reject` (iter 2/3). Re-Develop mirato su H2.

---

## TSK-030 — Visual regression + A11y — CONDITIONAL (no_progress)

### [H1] Baseline screenshot assenti — ❌ ANCORA ASSENTI
- `git ls-files tests/visual/__snapshots__/` → **0 PNG**. Su disco solo `desktop/.gitkeep` e `mobile/.gitkeep`.
- Il fix non era in scope questo round (deferral esplicitamente acknowledged dall'umano). La suite di visual regression resta a **valore protettivo nullo** finché non si generano+committano le baseline (o si documenta il perché). Route a `qa-dev`. `rule_id` candidate `qa.testing.missing_visual_baseline`.

### [M1] Viewport strategy conflict — ❌ ANCORA PRESENTE
- **File**: `code/app/playwright.config.ts:57-79` + i 15 spec sotto `tests/visual/**`
- Confermato invariato: i progetti `visual-desktop` (viewport 1280×800, :58-66) e `visual-mobile` (375×812, :70-79) hanno **entrambi** `testDir: './tests/visual'` → eseguono **tutti** gli spec. In parallelo 15 spec chiamano ancora `page.setViewportSize({ width: 375, height: 812 })` manualmente (grep: 15 occorrenze, es. `coverage-monitor.spec.ts:63`, `swap-admin.spec.ts:47`, `dashboard.spec.ts:57,71`). Un test "desktop light" gira anche sotto `visual-mobile` a 375px producendo una baseline `...-desktop-light.png` fuorviante; un test "mobile" forza 375 anche sotto `visual-desktop`. Baseline ridondanti + tempo CI ~raddoppiato. `rule_id` candidate `playwright.design.viewport_strategy_conflict`.

### Altri residui iter 1 (non toccati)
`M2` fixture `adminPage`/`setTheme` costruite ma non usate, `M3` screenshot condizionale no-op (`coverage-monitor.spec.ts:19-26`), `L1` `waitForTimeout` arbitrari, `L2` discrepanza `dependencies: ['setup']`. Tutti ancora aperti.

**Verdict TSK-030: CONDITIONAL — marker `no_progress`.** Il set di `rule_id` è **identico** a iter 1: nessun fix applicato in questo round. Il `no_progress` è tecnicamente attivo (§19.4) e accelera l'escalation, **ma** con contesto: il deferral (baseline fuori scope) è stato dichiarato dall'umano, quindi non è un loop bloccato per incapacità del dev-agent. **Raccomandazione**: decisione umana esplicita — o (a) generare le baseline + scegliere una strategia viewport unica al prossimo giro, oppure (b) declassare formalmente TSK-030 e tracciare i residui in `wiki/gaps.md`, per non consumare la terza iterazione a vuoto (iter 3 forzerebbe `reject`/`loop_exhausted`).

---

## TSK-031 — Export .ics endpoint — CONDITIONAL (light)

### [M1] Test auto-skippanti — ⚠️ PARZIALMENTE RISOLTO
**Metà critica (IDOR / T-SEC-01) — ✅ RISOLTA.** `code/app/tests/e2e/fixtures/sprint3-db.ts` è ora deterministica:
- Cerca `lucia.verdi@turnly.dev` via `GET /api/admin/users` (:87-107).
- Usa un turno esistente se presente (:110-117), **altrimenti lo crea** via `POST /api/shifts` (`date: '2099-01-15'`, futuro remoto, :140-161).
- Teardown `DELETE /api/shifts/:id` in `finally` best-effort solo se creato qui (:164-172).
- I 4 rami d'errore usano ora `testInfo.fixme(true, ...)` con diagnostica parlante (non più `testInfo.skip`) → gli skip scattano solo su **failure infrastrutturali reali** (endpoint down / seed mancante), non nel caso normale "lucia senza turni". Il test **T-SEC-01 (IDOR) ora esegue davvero** invece di auto-neutralizzarsi in silenzio. `rule_id` candidate `qa.testing.self_skipping_test` → soddisfatta per la parte sicurezza.

**Metà residua (AC2) — ❌ ANCORA APERTA.** `code/app/tests/e2e/sprint3/ics-export.spec.ts:65-68`: il test "AC2: VEVENT contiene DTSTART e SUMMARY" fa ancora `if (!body.includes('BEGIN:VEVENT')) { test.skip(true, ...); return; }`. Le asserzioni `DTSTART`/`SUMMARY` possono ancora **non eseguirsi mai** se il seed non ha turni nel range luglio 2026. Meno grave dell'IDOR (funzionale, non sicurezza) ma da chiudere: asserire hard la presenza di ≥1 VEVENT come precondizione, o derivare il range da una data-ancora del seed.

> Nota tecnica (low, non blocca): dopo `testInfo.fixme(true, ...)` — che lancia per abortire — le righe `await use('__fixture_unavailable__'); return;` sono **codice morto** (irraggiungibili). Innocue, ma semplificabili. Chiamare `testInfo.fixme()` da una fixture è supportato da Playwright.

### [M2] Fixture temporali accoppiate al "seed settimana corrente" — ❌ ANCORA APERTA
`ics-export.spec.ts:35-36, 60-61, 128-129`: range fissi `2026-07-01`/`2026-07-31` mentre i commenti parlano di seed "settimana corrente". Combinato con lo skip AC2 [M1], AC2 asserisce davvero solo se "oggi" cade nella finestra seedata. Allineare range test e finestra seed a una data-ancora condivisa. `rule_id` candidate `qa.testing.time_coupled_fixture`.

### Codice endpoint
Invariato e production-ready (nessun finding sul route iter 1). `L1` `.limit(500)` e `L2` cast `session.user.id as string` restano low, non toccati.

**Verdict TSK-031: CONDITIONAL (light).** Il fix più importante (integrità del test di sicurezza IDOR) è **atterrato correttamente**. Restano due medium di sola igiene test (AC2 self-skip + anchor date temporale): vicino al `pass`. `task_package qa-dev`: chiudere AC2 self-skip (M1 residuo) + anchor date (M2). Il codice non richiede modifiche.

---

## Loop status & prossimi step

- **Iter 2/3** per tutti e tre. Nessun `regression`, nessun `loop_exhausted`.
- **TSK-029** → `task_package` be-dev, priorità unica **H2** (timezone via `@/lib/date`). Restano M1-M3/L1-L3 da decidere.
- **TSK-030** → `no_progress`: **decisione umana richiesta** prima di consumare iter 3 (generare baseline + strategia viewport unica, oppure declassare + `wiki/gaps.md`).
- **TSK-031** → `task_package` qa-dev, chiusura M1(AC2)+M2; poi candidabile a `pass`.
- Dispatch **non** automatico: `conditional` con dispatch dev-agent richiede conferma umana (gate §7 r.16 / router Fase 5). `rule_id` restano **candidate**.

## Note di trasparenza
- Modalità degradata (ruleset locale vuoto) invariata dall'iter 1; severità per giudizio ingegneristico.
- CQRL non copre sicurezza: l'osservazione IDOR riguarda l'**integrità del test** (ora risolta), non un difetto del codice (già corretto, filtro sempre su `session.user.id`).
- Nessun test scritto, nessun file di codice modificato (invarianti R.Q2). Nessuna promozione di regole (§19.5).
