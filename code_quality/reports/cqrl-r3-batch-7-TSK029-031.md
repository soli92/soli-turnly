# CQRL Batch 7 — Code Review ROUND 3 (FINALE) · TSK-029 / TSK-030 / TSK-031

- **Reviewer**: code-reviewer@2.12.0 (CQRL v2.12)
- **Generato**: 2026-07-14 (iter **3/3 — ultima iterazione consentita**, `code_quality.max_iterations: 3`)
- **Stack rilevato**: TypeScript 5.x / Next.js 15 (App Router `^15.0.0`) + Drizzle ORM + React Email + Playwright — confidence ~0.9 (`raw/tech_stack.md`, `code/app/package.json`). Sopra `confidence_min: 0.6` → review **stack-aware** (non degradata per stack).
- **Passate eseguite**: idiomaticità · design · robustezza (accessibility n/a per finding aperti di questo batch — delega EP-007/EP-008)
- **Iter precedente**: `code_quality/reports/cqrl-r2-batch-7-TSK029-031.md` (iter 2/3)
- **Nota di processo**: il ruleset locale ora contiene 10 regole in `code_quality/rules/emergent/` tutte con `status: candidate` (gate umano §19.5). I finding citano queste `rule_id` come riferimento, ma **nessuna è `active`** → nessuna regola applicata/promossa in questo run. `team-specific/` e `canonical/` restano vuoti.
- **Modalità review**: pre-merge **working-tree review** (le modifiche del batch sono ancora non committate: `118 M`, `12 D`, `112 ??` in `code/app`). Vedi Nota di trasparenza sul commit gate.

---

## Verdetti (sintesi round 3 — FINALE)

| TSK | Layer | iter 1 | iter 2 | iter 3 | Δ round 3 | High res. | Marker |
|---|---|---|---|---|---|---|---|
| **TSK-029** | be | CONDITIONAL | CONDITIONAL | **✅ PASS** | **H2 risolto** (tz via `@/lib/date`) | 2/2 | — |
| **TSK-030** | qa | CONDITIONAL | CONDITIONAL (no_progress) | **✅ PASS** | **H1 risolto** (96 baseline) · **M1 risolto** (viewport) | 1/1 | no_progress **cleared** |
| **TSK-031** | be/qa | CONDITIONAL | CONDITIONAL (light) | **✅ PASS** | **M1(AC2)+M2 risolti** | n/a | — |

**Esito batch: tutti e tre PASS all'iterazione finale.** Nessun `reject`, nessun `loop_exhausted`, nessun `regression`, nessun problema di sicurezza. Residui aperti sono medium/low deferiti (tracciati sotto) che non bloccano il verdict.

---

## TSK-029 — Email templates + dispatch Inngest — ✅ PASS

### [H2] Date/orari email non timezone-safe (Europe/Rome) — ✅ RISOLTO
- **Severity**: high · **rule_id (candidate)**: `ts.robustness.timezone_unsafe_datetime`
- Le utility locali tz-unsafe (`formatDateIt` con `new Date(iso + 'T00:00:00')`, `formatTime` con `toLocaleTimeString` senza `timeZone`) sono state **rimosse** e sostituite dall'utility canonica DST-safe `@/lib/date` (T-DOM-08/RB-12, basata su `TZDate` + `APP_TIMEZONE = 'Europe/Rome'`):
  - `code/app/app/api/shifts/route.ts:25` — `import { formatISODate, formatTime, APP_TIMEZONE } from '@/lib/date'`; usata a `:168` (`date: formatISODate(createdShift.date, APP_TIMEZONE, 'EEEE d MMMM yyyy')`), `:169` (`startTime: formatTime(createdShift.startDt)`), `:170` (`endTime: formatTime(createdShift.endDt)`).
  - `code/app/app/api/requests/[id]/approve/route.ts:21` + `:110` — `period: existing.submittedAt ? formatDate(existing.submittedAt) : ''` (era `.toLocaleDateString('it-IT')`).
  - `code/app/app/api/requests/[id]/reject/route.ts:20` + `:108` — idem.
- **Verifica per-file**: `grep -rn "toLocaleDateString|toLocaleTimeString|formatDateIt|T00:00:00"` su `shifts/route.ts` + `requests/**` → **0 match**. `accept-swap/route.ts` non formatta date (nessun rischio tz).
- **Verifica tipi (no regression)**: `shifts.date` è colonna Drizzle `date()` (mode string → `'YYYY-MM-DD'`), quindi `formatISODate` riceve una ISO string valida per `parseISO`; `startDt`/`endDt`/`submittedAt` sono `timestamp({ withTimezone: true })` → oggetti `Date`, coerenti con `formatTime`/`formatDate`. La sostituzione **non introduce type mismatch** (`db/schema.ts:159-161`, `:236`). `rule_id` candidate soddisfatta.

### High risolti: 2/2 (H1 in iter 2, H2 in iter 3). Il vincolo normativo tz è ora onorato.

### Residui aperti (medium/low, deferiti — non bloccanti)
- **M1** `humanizeRequestType` duplicato verbatim in `approve/route.ts:26-34` e `reject/route.ts:25-33` — duplicazione mapping dominio; candidabile a estrazione (`@/lib/i18n` o `@/lib/requests`). Affine a `fe.domain.shared-rule-duplication` (candidate; qui è label BE, non regola RB — severità low/medium).
- **M2** `period: formatDate(existing.submittedAt)` etichettato "Periodo" nel template ma è la **data di submission**, non il periodo della richiesta. Il fix ha reso il valore tz-safe ma il **mismatch semantico persiste** (medium, deferito): valutare l'uso delle date reali del payload della richiesta.
- **M3** fallback silenzioso a `''` per `shiftTypeName`/`period`; **L1** `default` switch con `JSON.stringify`; **L2** `newShift!` non-null assertion (`shifts/route.ts:124,132,137`); **L3** subject email hardcoded nel route. Tutti carried forward, non bloccanti.
- **Caveat (verify-only, carried da iter 2)**: `after` è API stabile solo da **Next 15.1** (`unstable_after` in 15.0.x); `package.json` pinna `^15.0.0`. Confermare che il lockfile risolva a **≥15.1** o l'import fallirà al build.
- **Nota low (nuova, non-blocking)**: `formatISODate(createdShift.date, ...)` fa `parseISO('YYYY-MM-DD')` → mezzanotte del **runtime** poi ri-zonata a Rome. Corretto su Vercel (runtime UTC, il target del finding originale); solo teorico off-by-one su runtime molto a est di UTC. Nessuna azione richiesta per il deploy target.

**Verdict TSK-029: PASS.** Entrambi gli high chiusi con migrazione pulita alla single-source-of-truth `@/lib/date`. Residui M1-M3/L1-L3 da tracciare in backlog (non bloccano).

---

## TSK-030 — Visual regression + A11y — ✅ PASS (no_progress cleared)

### [H1] Baseline screenshot assenti — ✅ RISOLTO
- `find code/app/tests/visual/__snapshots__ -name "*.png" | wc -l` → **96** (era 0). Distribuzione bilanciata: **48 `desktop/` + 48 `mobile/`** — coerente con la strategia dual-run (ogni spec ha baseline sia 1280px sia 375px). Criterio di accettazione dell'iter-3 (`> 0`) **soddisfatto**. `rule_id` candidate `qa.testing.missing_visual_baseline` soddisfatta per la parte generazione.
- **Caveat obbligatorio (release gate, non code-quality)**: le 96 PNG sono **untracked** (`git status` → `?? tests/visual/__snapshots__/`, `git ls-files` → 0). Su disco sono già protettive per run locali, ma **hanno valore CI nullo finché non vengono committate**. Questo rientra nel commit gate dell'intero batch (l'intero working-tree è non committato); non è un difetto isolato di TSK-030 → non declassa il verdict, ma è **prerequisito di merge** (vedi Prossimi step).

### [M1] Viewport strategy conflict — ✅ RISOLTO
- Le chiamate manuali `page.setViewportSize({ width: 375, ... })` negli spec (15 occorrenze in iter 2) sono state **rimosse**: `grep -rln setViewportSize tests/visual/` → **solo `tests/visual/README.md`** (riga documentale che vieta esplicitamente l'uso). Gli spec ora ereditano il viewport dal progetto (`visual-desktop` 1280×800 `playwright.config.ts:68`, `visual-mobile` 375×812 `:81`), eliminando le baseline fuorvianti/ridondanti.
- Assertion overflow resa **condizionale al viewport** (fix collaterale): `tests/visual/sprint2/employee-calendar.spec.ts:57-60` — `const vp = page.viewportSize(); if (vp && vp.width <= 500) { expect(scrollWidth)... }`. Non fallisce più sotto `visual-desktop` (1280px) dove l'assenza di overflow orizzontale non è un AC. `rule_id` candidate `playwright.design.viewport_strategy_conflict` soddisfatta.

### High risolti: 1/1. Marker `no_progress` di iter 2 **cleared** (fix reali atterrati questo round: baseline + rimozione setViewportSize + scrollWidth condizionale). Il set di `rule_id` **non** è più identico a iter 1-2.

### Residui aperti (low, deferiti)
- Entrambi i progetti condividono `testDir: './tests/visual'` (`:65`, `:78`) → ogni spec gira due volte. In iter 2 era penalizzato come conflitto; **ora è la strategia intenzionale documentata** (README) — accettato, non finding.
- **M2** fixture `adminPage`/`setTheme` costruite ma non usate; **M3** screenshot condizionale no-op (`coverage-monitor.spec.ts`); **L1** `waitForTimeout` arbitrari (es. `employee-calendar.spec.ts:42`), affine a `qa.testing.brittle-selectors` (candidate); **L2** discrepanza `dependencies`. Tutti low, non bloccanti.

**Verdict TSK-030: PASS.** Il blocking H1 è risolto secondo il criterio dell'iter-3, l'M1 viewport è chiuso con strategia coerente e documentata. **Prerequisito di merge**: committare le baseline (`git add tests/visual/__snapshots__/`).

---

## TSK-031 — Export .ics endpoint — ✅ PASS

### [M1] Test auto-skippanti (AC2) — ✅ RISOLTO
- La metà critica (IDOR/T-SEC-01) era già risolta in iter 2 (fixture deterministica `tests/e2e/fixtures/sprint3-db.ts`). La metà residua (AC2) è ora **chiusa**: `tests/e2e/sprint3/ics-export.spec.ts:74-84` non contiene più lo skip-guard; asserisce **hard** la presenza di `BEGIN:VEVENT` (:81, con commento "fallisce esplicitamente se assente"), `DTSTART` (:82), `SUMMARY` (:83). Il test non può più passare in modo vacuo. `rule_id` candidate `qa.testing.hollow-acceptance` (`code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Rationale`) soddisfatta.

### [M2] Fixture temporali accoppiate a data hardcoded — ✅ RISOLTO
- Il range non è più `2026-07-01`/`2026-07-31` hardcoded. `ics-export.spec.ts:27-34` deriva `SEED_MONTH_FROM`/`SEED_MONTH_TO` **dinamicamente dal mese corrente** (`new Date()` → primo/ultimo giorno del mese), con commento che spiega l'allineamento al seed "settimana corrente" (:20-25). Il test non è più accoppiato a un istante fisso. `rule_id` candidate `qa.testing.time_coupled_fixture` soddisfatta.

### Residui aperti (low, deferiti — non bloccanti)
- **L (dead code)**: dopo `testInfo.fixme(true, ...)` (che lancia per abortire) le righe `await use('__fixture_unavailable__'); return;` nei 4 rami d'errore della fixture (`sprint3-db.ts:93,105,126,136`) sono **irraggiungibili**. Innocue ma semplificabili. Affine a `general.dead-broken-code` (`code_quality/rules/emergent/general.dead-broken-code.md`; candidate).
- **L (edge case temporale)**: il range è derivato dal **mese** mentre il seed usa `startOfWeek(new Date())`. Al confine di mese, se la settimana corrente (Lun-Ven) cade interamente nel mese precedente E "oggi" è a inizio mese, i turni seedati possono cadere **fuori** dal range → l'hard-assert AC2 (:81) potrebbe fallire. Finestra molto stretta; per robustezza piena derivare il range dalla stessa `startOfWeek` del seed. Non blocca (nettamente migliore del hardcode precedente).

### Codice endpoint
Invariato e production-ready (nessun finding sul route). `L1` `.limit(500)`, `L2` cast `session.user.id as string` restano low, non toccati.

**Verdict TSK-031: PASS.** Entrambi i medium (AC2 self-skip + anchor date) chiusi; l'integrità del test di sicurezza IDOR resta solida. Solo residui low di igiene test.

---

## Loop status & prossimi step

- **Iter 3/3 — iterazione finale** per tutti e tre. Nessun `regression` (i fix H2 toccano solo i 3 route in scope, tipi coerenti col DB schema — verificato). Nessun `loop_exhausted` (verdict raggiunto entro il budget). Nessun problema di sicurezza sul codice.
- **TSK-029 → PASS**: chiudere in backlog M1 (dedup `humanizeRequestType`) + M2 (semantica `period`) al prossimo giro; verificare lockfile Next ≥15.1.
- **TSK-030 → PASS con prerequisito di merge**: **committare le 96 baseline** (`git add code/app/tests/visual/__snapshots__/`) — senza commit il valore CI resta nullo. Residui low (M2/M3/L1-L2) in backlog qa.
- **TSK-031 → PASS**: pulizia opzionale del dead code post-`fixme` e allineamento range↔`startOfWeek` del seed (entrambi low).
- **Dispatch/merge non automatici**: il commit del working-tree e il merge sono gate umano (§7 r.16). Le `rule_id` restano **candidate** — nessuna promozione a `active`/`canonical` in questo run (§19.5, gate umano).

## Note di trasparenza
- **Working-tree review**: l'intero `code/app` è non committato (`118 M`, `12 D`, `112 ??`). Le 12 delezioni (`app/(admin)/**`, `components/requests/**`) sono **fuori scope batch 7** — appartengono verosimilmente a un altro TSK/refactor in parallelo; non valutate qui e non attribuite come finding a TSK-029/030/031. Segnalate solo per contesto: prima del merge il working-tree va consolidato e committato.
- CQRL **non copre sicurezza**: l'osservazione IDOR riguarda l'**integrità del test** (già risolta iter 2), non un difetto del route (filtro sempre su `session.user.id`). Nessun secret in chiaro né CVE emersi.
- **Nessun file di codice modificato, nessun test scritto** (invarianti §19.6 R.Q2). Le uniche scritture di questo run sono il presente report e il companion (scope reviewer §19.6). Nessuna regola emergent creata/promossa in questo run.
- Ruleset ancora interamente `status: candidate` → i `rule_id` citati sono riferimenti diagnostici, non regole applicate. Severità assegnate per giudizio ingegneristico stack-aware (confidence 0.9).
</content>
</invoke>
