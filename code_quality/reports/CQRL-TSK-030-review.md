# CQRL Code Review — TSK-030

> Visual regression + A11y Sprint 2+3 — nuove pagine (EP-005, EP-007)
> Layer: **qa** · code_path: `code/app/tests/`

| Campo | Valore |
|---|---|
| `tsk_id` | TSK-030 |
| `stack_descriptor` | `typescript` · `playwright` · `@axe-core/playwright` · `axe-playwright` (legacy) |
| `stack_confidence` | alta (stack_mode: guided; dipendenze verificate) — modalità **stack-aware attiva** (> `confidence_min` 0.6) |
| `iter` | esplicita (`/review` override una-tantum); loop automatico batch già a **3/3** (vedi Loop status) |
| `reviewer_version` | code-review-protocol v2.12 (PATTERN §19) |
| `generated_at` | 2026-07-15 |
| `verdict` | **conditional** |

---

## Passata 1 — Idiomaticità

Uso corretto di `@axe-core/playwright` (`AxeBuilder().withTags().analyze()`), `getByRole`/
`getByTestId` per la localizzazione, screenshot via `toHaveScreenshot` (che disabilita di
default le animazioni). Buona pratica: entrambe le spec a11y includono un **test negativo**
che verifica che axe rilevi violazioni su HTML volutamente rotto (guardia contro axe
silenziosamente inerte).

Debolezze idiomatiche: convenzione di naming degli screenshot in conflitto con la matrice
di viewport dei project (F-030-01) e anti-pattern Playwright pervasivi (F-030-02).

## Passata 2 — Design

Isolamento test via `storageState` per ruolo, seed dichiarato in fixture. Ma la fixture
`visual-db.ts` contiene molto **codice morto** (F-030-03) e coesistono **due librerie a11y**
con liste di route divergenti (F-030-04). Copertura pagine Sprint 2+3 sostanzialmente
presente.

## Passata 3 — Robustezza / Flakiness

È il fronte più critico: baseline **platform-specific darwin** inutili in CI Linux (F-030-06),
euristica di attesa **annullata dalle SSE** (F-030-07), e guardie condizionali che producono
**falsi verdi** (F-030-08, F-030-09). Masking dinamico incoerente (F-030-10).

---

## Findings (ordinati per severità)

### F-030-06 · medium/high · robustezza/CI — baseline solo `-darwin`, inutilizzabili su CI Linux
Tutte le ~96 PNG sono suffisse `-darwin.png` (es. `dashboard-desktop-light-visual-desktop-darwin.png`).
Playwright indicizza gli snapshot per `{platform}`; su GitHub Actions `ubuntu-latest` cerca
`-linux.png`, che **non esiste** → l'intera suite visual fallisce (snapshot mancante) o
rigenera baseline non validate. Contraddice direttamente l'AC "CI GitHub Actions: … screenshot
baseline commitati". Remediation: generare le baseline in un container coerente col runner CI
(Docker `mcr.microsoft.com/playwright`) oppure fissare un runner macOS (costoso/atipico), o
rimuovere il suffisso platform e imporre un ambiente di rendering unico.
Riferimenti: `code/app/tests/visual/__snapshots__/**` (tutti `-darwin`); AC TSK-030 riga 133.
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]` (baseline committate ≠ baseline eseguibili nel CI dichiarato)

### F-030-01 · medium · idiomaticità/design — naming screenshot vs viewport a doppio run
Entrambi i project `visual-desktop` (1280) e `visual-mobile` (375) hanno `testDir:
./tests/visual` **senza `testMatch`** → ogni spec gira sotto entrambi i viewport. I nomi
degli screenshot codificano il viewport ("...-desktop-...", "...-mobile-..."), ma il viewport
reale lo impone il project. Prova: `__snapshots__/desktop/.../dashboard-mobile-light-visual-desktop-darwin.png`
è uno screenshot chiamato "mobile" catturato a **1280px**. Effetto: nomi fuorvianti + **2×
baseline** (ogni screenshot esiste sia in `desktop/` sia in `mobile/`).
Remediation: separare gli spec per project (testMatch/dir) e togliere il viewport dal nome
(già distinto dalla cartella project), o parametrizzare un solo asse.
Riferimenti: `code/app/playwright.config.ts:63-87`; `code/app/tests/visual/README.md:3-6`.
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]`

### F-030-03 · medium · design — fixture morte in `visual-db.ts`
`adminPage`, `employeePage`, `colleaguePage`, `setTheme`, `gotoAndWait` sono definite ma
**non usate da alcuno spec** (gli spec usano `{ page }` + `test.use({ storageState })` e
togglano il tema inline). Include l'intero blocco auto-login `colleague`. Solo `waitForApiQuiet`
e l'override di `page.goto` sono realmente usati. Rimuovere il morto o ricollegarlo.
Riferimenti: `code/app/tests/visual/fixtures/visual-db.ts:143-202` (fixtures inutilizzate); grep 0 usi in `tests/visual/sprint*`.
`[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Rationale]`

### F-030-04 · medium · design — doppia libreria a11y + route drift
`tests/a11y/a11y.spec.ts` usa **axe-playwright** (`injectAxe`/`checkA11y`, route `/admin/users`,
`/profile`) mentre `a11y-sprint2/3` usano **@axe-core/playwright** (`AxeBuilder`, route
`/admin/staff`, senza `/profile`). Entrambe girano nel project `a11y`. Due librerie ridondanti
per lo stesso scopo + liste route divergenti (`/admin/users` e `/admin/staff` **esistono
entrambe** come pagine → possibile pagina duplicata da chiarire). Consolidare su una libreria
e una lista route unica; `/profile` non è più coperto dalla suite nuova.
Riferimenti: `code/app/tests/a11y/a11y.spec.ts:1-13`; `code/app/tests/a11y/sprint2/a11y-sprint2.spec.ts:29-49`; `code/app/playwright.config.ts:52-57`.
`[^rule: code_quality/rules/emergent/general.dead-broken-code.md §Rationale]`

### F-030-07 · medium · robustezza/flakiness — le SSE annullano `waitForApiQuiet`
`isDataApi` conta ogni `/api/*` (esclusi `/api/auth/`, `/_next/`) come richiesta pendente
finché non emette `requestfinished`. L'endpoint **SSE** `app/api/notifications/sse` è una
richiesta long-lived che non termina → `pending` resta ≥ 1 → `waitForApiQuiet` attende
**sempre** il fallback di 10 s su ogni pagina con sottoscrizione SSE (dashboard, notifications,
layout). Effetto: +10 s/navigazione (minaccia l'AC "< 15 min") e screenshot catturati a stream
in corso. Remediation: escludere gli endpoint SSE (`text/event-stream`) da `isDataApi`.
Riferimenti: `code/app/tests/visual/fixtures/visual-db.ts:76-90`; `code/app/app/api/notifications/sse/route.ts`.
`[^rule: code_quality/rules/emergent/qa.testing.brittle-selectors.md §Rationale]` (attese non deterministiche)

### F-030-08 · medium · robustezza — guardie condizionali = falsi verdi (hollow acceptance)
Pattern `if ((await X.count()) > 0) { … }` (11 occorrenze): se il tab/radio non è trovato, il
test **non avanza** e asserisce comunque. Esempi: `coverage-monitor` "tab Monitor attivo"
screenshotta qualunque tab se il selettore drifta (l'AC "cella sotto-coperta rossa" non è
verificato); i wizard a11y `wizard-step2-*` eseguono axe sullo **step 1** se il radio manca,
pur dichiarando lo step 2. Il testid è un contratto: se drifta, il ramo tollerante maschera il
fallimento. Rendere i prerequisiti deterministici (seed) e far **fallire** il test se il
selettore manca.
Riferimenti: `code/app/tests/visual/sprint2/coverage-monitor.spec.ts:19-24`; `code/app/tests/a11y/sprint3/a11y-sprint3.spec.ts:98-103,123-128,141-146,187-193`.
`[^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Rationale]` · `[^rule: code_quality/rules/emergent/qa.testing.testid-contract-drift.md §Rationale]`

### F-030-09 · medium · robustezza — nessuna asserzione che la pagina target sia caricata
Prima di `analyze()`/`toHaveScreenshot()` non si verifica che la pagina attesa sia
renderizzata: se `storageState` scade o `page.goto` redirige a `/login`, axe gira sulla pagina
di login → 0 critical → **falso verde**; lo screenshot cattura la login. Asserire un
landmark/heading della pagina target prima di misurare.
Riferimenti: `code/app/tests/a11y/sprint2/a11y-sprint2.spec.ts:59-63`.
`[^rule: code_quality/rules/emergent/qa.testing.hollow-acceptance.md §Rationale]`

### F-030-10 · medium · flakiness — masking dinamico incoerente
Solo `employee-requests`, `notifications`, `swap-admin` mascherano `<time>`; `dashboard`,
`coverage`, `matrix`, `availability`, `reports-overtime` renderizzano date/orari **senza**
masking → drift temporale → falsi positivi visual nel tempo. Uniformare (mask di `<time>`
oppure clock fittizio deterministico via `page.clock`/seed a data fissa).
Riferimenti: `code/app/tests/visual/sprint3/swap-admin.spec.ts:21-25` (mask) vs `code/app/tests/visual/sprint2/coverage-monitor.spec.ts` (nessun mask).
`[^rule: code_quality/rules/emergent/qa.testing.brittle-selectors.md §Rationale]`

### F-030-02 · low · idiomaticità — anti-pattern Playwright pervasivi
`waitForLoadState('networkidle')` (21 occorrenze) e `waitForTimeout(...)` (24 occorrenze) in
visual+a11y: entrambi esplicitamente scoraggiati (attese non deterministiche → lentezza +
flakiness). Sostituire con web-first assertion / `waitForApiQuiet` (già disponibile).
Riferimenti: `code/app/tests/a11y/sprint2/a11y-sprint2.spec.ts:61,93`; `code/app/tests/visual/sprint2/coverage-monitor.spec.ts:57`; `code/app/tests/visual/sprint3/swap-admin.spec.ts:39`.
`[^rule: code_quality/rules/emergent/qa.testing.brittle-selectors.md §Detection]`

### F-030-05 · low · design — duplicazione della logica axe
`a11y-sprint2` inlinea il violation-summary (righe 68-76, 99-107); `a11y-sprint3` estrae
`buildViolationSummary`. Estrarre un helper condiviso `expectNoA11yViolations(page, path)`
riusato da entrambe le suite.
Riferimenti: `code/app/tests/a11y/sprint2/a11y-sprint2.spec.ts:68-76`; `code/app/tests/a11y/sprint3/a11y-sprint3.spec.ts:50-65`.
`[^rule: code_quality/rules/emergent/fe.domain.shared-rule-duplication.md §Rationale]` (principio single-source, cross-cutting)

### F-030-11 · low · doc-code-mismatch — AC "critical o serious" non applicato
Entrambe le spec filtrano solo `impact === 'critical'`; le violazioni `serious` passano.
Contraddice l'AC riga 128 ("0 violazioni critical o serious") e l'esempio spec riga 118.
**Nota:** già accettato come debito nella review precedente (F-011-01, allineato a
`factory.config.yaml: a11y.severity_threshold: critical`). Residuo: **riconciliare il testo
AC/spec** (o includere `serious`) per eliminare il mismatch.
Riferimenti: `code/app/tests/a11y/sprint2/a11y-sprint2.spec.ts:65`; TSK-030 AC riga 128.
`[^rule: code_quality/rules/emergent/general.doc-code-mismatch.md §Rationale]`

### F-030-12 · low · flakiness — tema "light" mai impostato esplicitamente
Gli screenshot "light" si affidano al tema di default dell'app; i toggle "dark" non rimuovono
sempre `.light`. Se il default cambia, i "light" catturano il tema sbagliato. Impostare
esplicitamente entrambi i temi.
Riferimenti: `code/app/tests/visual/sprint3/swap-admin.spec.ts:32-38`.

**Nota positiva:** il test negativo "axe rileva violazioni su HTML rotto" in entrambe le
suite è una guardia di qualità corretta contro axe inerte.

---

## Loop status

- La review batch precedente (**cqrl-r3-batch-7**, iter **3/3 FINALE**) ha marcato TSK-030
  **PASS** (`no_progress` cleared), con prerequisito di merge "committare le baseline" — **ora
  soddisfatto** (gli snapshot sono tracciati; `git status` a inizio sessione mostra solo
  `?? test-results/`).
- **F-030-11** è già `accept-as-debt` dalla iter precedente. F-030-01/03/04/06/07/08/09/10 sono
  in parte **nuovi/approfonditi** in questa passata dedicata (la review batch non li aveva
  isolati).
- **No regression** sui fix iter-3 (viewport/baseline count).
- **Bounded loop (R.Q4):** loop automatico **esaurito (3/3)**. Remediation via **gate umano
  (R.Q3)**.

## Prossimo step

Verdict **conditional**. La suite gira verde in locale (macOS), ma il suo **valore di gating
in CI è compromesso**: F-030-06 (baseline darwin) probabilmente la fa fallire su runner Linux;
F-030-08/F-030-09 permettono falsi verdi; F-030-07 la rallenta oltre l'AC "< 15 min". Da
instradare a qa-dev con scope chiuso: F-030-06 come **must-fix** (verificare l'OS del runner
CI), poi F-030-08/09/07/01/03/10; F-030-02/04/05/11/12 in backlog. Nessun problema di sicurezza
rilevato; nessuna auto-modifica del codice test effettuata.

---

`verdict: conditional`

**Findings prioritizzati:**
1. F-030-06 (medium/high) — baseline solo `-darwin`, inutilizzabili su CI Linux [must-fix]
2. F-030-08 (medium) — guardie condizionali = falsi verdi (hollow acceptance)
3. F-030-09 (medium) — nessuna asserzione di pagina caricata prima di axe/screenshot
4. F-030-07 (medium) — le SSE annullano `waitForApiQuiet` (+10s/nav, cattura mid-stream)
5. F-030-01 (medium) — naming screenshot vs viewport a doppio run (2× baseline fuorvianti)
6. F-030-03 (medium) — fixture morte in `visual-db.ts`
7. F-030-04 (medium) — doppia libreria a11y + route drift
8. F-030-10 (medium) — masking dinamico incoerente → flakiness
9. F-030-02 (low) — `networkidle`/`waitForTimeout` pervasivi
10. F-030-05 (low) — duplicazione logica axe
11. F-030-11 (low) — AC "critical o serious" non applicato (debito riconosciuto)
12. F-030-12 (low) — tema "light" non impostato esplicitamente
