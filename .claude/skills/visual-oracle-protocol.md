---
name: visual-oracle-protocol
description: Loop di verifica visiva per TSK FE — 5 fasi (Bootstrap → Render → Screenshot → Critica → Diff+Loop). Istanza del pattern evaluator-optimizer. Opt-in via fe_correctness.enabled.
---
# Protocollo Visual Oracle — loop di verifica visiva per TSK FE

Loop chiuso di verifica del rendering per TSK FE: renderizza il componente in un browser
headless, cattura screenshot su una matrice viewport × tema, lascia che il critic LLM
multimodale confronti il rendering con la specifica e produca difetti azionabili, poi
itera bounded fino a convergenza. È un'**operazione opzionale** (sub-step di Develop FE,
PATTERN §3 «Develop» — variante «Visual Verification») attivata solo da
`factory.config.yaml.fe_correctness.enabled: true`. A flag spento la skill è no-op
(backward compat totale, R.P3 opt-in totale).

Riferimenti: PATTERN §3 (operazioni canoniche — Visual Verification come variante di
Develop FE). Sintesi: [`wiki/syntheses/fe-agent-correctness-strategy.md §Leva 1`](../../wiki/syntheses/fe-agent-correctness-strategy.md).
ADR: [`ADR-008`](../../design_&_architecture/decisions/ADR-008.md) (Playwright via Bash,
no MCP, runner in `.factory-runners/`, fail-loud), [`ADR-009`](../../design_&_architecture/decisions/ADR-009.md)
(critic = stesso fe-dev in review multimodale), [`ADR-012`](../../design_&_architecture/decisions/ADR-012.md)
(schema dati §A/§H), [`ADR-013`](../../design_&_architecture/decisions/ADR-013.md) (ordering
develop → visual-oracle → review).

Sub-skill / cross-link: questa skill è invocata inline da `dev-protocol` Fase 4-bis
(US-018) e dal comando `/visual-oracle` (US-019). L'ordering è formalizzato in ADR-013:
visual oracle gira **dopo develop, prima di review**.

[^src: design_&_architecture/decisions/ADR-013.md §Punto 1]

## Prerequisiti

- `factory.config.yaml.fe_correctness.enabled: true` (master gate — STOP no-op altrimenti, R.P3).
- TSK target valido: `layer: fe`.
- Playwright disponibile nel project host (vedi Fase 1 Bootstrap, fail-loud altrimenti).
- `code_path` del TSK risolvibile (frontmatter `code_path:` o `target:` → entry in `code_paths`).

[^src: design_&_architecture/decisions/ADR-008.md §Decisione]

## Costanti

```
MAX_ITERATIONS  = fe_correctness.max_iterations   # bound del loop conditional (default 3, analogo R.Q4 di CQRL)
REPORTS_DIR     = "code_quality/reports"          # side-channel riusato (ADR-012 §B, slug `visual`)
RUNNER_DIR      = ".factory-runners"              # script Bash generati, gitignored (ADR-008 §Rationale 2)
```

---

## Fase 1 — Bootstrap

**Input atteso**: `TSK-id` (target del visual oracle), `factory.config.yaml`.

**Azione**:

1. Read `factory.config.yaml.fe_correctness`. Se `enabled: false` → ABORT pulito,
   log a chat «Visual oracle disabilitato; abilitare con `fe_correctness.enabled: true`».
2. Read TSK target: frontmatter (`id`, `layer`, `code_path`/`target`, `visual_status`,
   `interaction_test_spec`, `visual_reference`) + body markdown.
3. Verifica `TSK.layer == fe`. Se non FE → STOP no-op (trigger fallito: il visual oracle
   è solo per layer FE; ADR-013 Punto 1).
4. Verifica prerequisito **Playwright** via Bash: `npx playwright --version`. Se exit
   code `!= 0` → **STOP fail-loud** con messaggio azionabile **verbatim**:

   > Visual oracle richiede Playwright. Eseguire: `npm i -D @playwright/test && npx playwright install --with-deps chromium`. Vedi runbook `wiki/runbooks/visual-oracle-installation.md` se disponibile.

   Nessun degrado silenzioso a «solo critic senza screenshot» (ADR-008 §Rationale 5).
5. Risolve `code_path` dal frontmatter TSK (legacy `code_path:` singolo, oppure `target:`
   → entry in `code_paths`).
6. Calcola `current_iter`: se `visual_status` è assente/`pending` → `N = 1`; se è
   `conditional` (loop in corso) → `N = <ultimo iter> + 1`.
7. Crea la cartella side-channel per gli artefatti PNG:
   `code_quality/reports/<TSK-id>-visual-iter-<N>/` (ADR-012 §B).

**Output prodotto**: cartella `code_quality/reports/<TSK-id>-visual-iter-<N>/` creata;
`code_path` risolto; `current_iter` calcolato.

**Criterio di completamento**: `npx playwright --version` exit code `0` **AND** cartella
artefatti creata.

[^src: design_&_architecture/decisions/ADR-008.md §Conseguenze]
[^src: management/kanban/EP-005-fe-visual-oracle/US-017-skill-visual-oracle-protocol/TSK-020.md]

---

## Fase 2 — Render Headless

**Input atteso**: `code_path` risolto (Fase 1) + body del TSK (per dedurre l'entry-point
del componente / pagina da renderizzare).

**Azione**:

1. Genera uno **script runner Bash** (template-izzato dalla skill) e scrivilo in
   `.factory-runners/` (cartella **gitignored** — non inquina il code_path, ADR-008
   §Rationale 2). Lo script invoca Playwright via Bash, **NON un MCP tool** (ADR-008
   §Decisione: «niente MCP custom»).
2. Lo script avvia il dev-server del progetto (o serve il bundle esistente) e usa
   Playwright per navigare alla pagina/componente target.
3. **Fail-loud** se il browser headless non è disponibile / non avviabile (ADR-008
   §Rationale 5): STOP con messaggio che cita il comando di install della Fase 1. Nessun
   fallback silenzioso.

**Output prodotto**: script runner Bash in `.factory-runners/<TSK-id>-visual-iter-<N>.sh`;
sessione Playwright pronta a catturare screenshot.

**Criterio di completamento**: dev-server raggiungibile **OR** bundle esistente servibile,
e la pagina target renderizza senza errori di navigazione.

[^src: design_&_architecture/decisions/ADR-008.md §Rationale punto 2]
[^src: design_&_architecture/decisions/ADR-008.md §Rationale punto 5]

---

## Fase 3 — Screenshot Multi-Viewport/Tema

> **Refactor non distruttivo v2.18 (ADR-017)**: la logica di cattura è ora estratta nella
> skill condivisa [`screenshot-capture-protocol`](./screenshot-capture-protocol.md) (single
> source of truth Playwright, riusata anche da `ux-ui-review-protocol` EP-008). La Fase 3
> **delega** la cattura a quella skill invece di implementarla inline. Il **contratto
> pubblico della Fase 3 è invariato**: stessi PNG, stessa cartella side-channel
> (`code_quality/reports/<TSK-id>-visual-iter-<N>/`), stesso naming, stesso schema dati
> (ADR-012 §H). Chi invoca `/visual-oracle` o consuma la skill non vede differenze (backward
> compat totale — ADR-017 §«Cosa NON cambia»). La risoluzione della matrice `viewports × themes`
> resta nel caller (questa Fase 3), non nella skill condivisa (ADR-017 §Rationale 5).

**Input atteso**: `viewports` + `themes` da `factory.config.yaml.fe_correctness`.

**Azione**:

1. Costruisce la **matrice cartesiana** `viewports × themes`. Default (da ADR-012 §E):
   - `viewports: [{ name: mobile, width: 375 }, { name: desktop, width: 1280 }]`
   - `themes: [light, dark]`
   - → **4 combinazioni**: `mobile-light`, `mobile-dark`, `desktop-light`, `desktop-dark`.
2. **Override da config**: se l'utente valorizza `fe_correctness.viewports` /
   `fe_correctness.themes`, quei valori sono passati direttamente alla skill condivisa (no
   abstraction layer intermedio — ADR-008 §Conseguenze). La matrice può quindi essere
   N viewport × M temi.
3. **INVOCA `screenshot-capture-protocol`** con i parametri risolti (ADR-017 §«Cosa cambia in
   EP-005»):
   ```
   INVOCA screenshot-capture-protocol con:
     target         = <target risolto in Fase 2>
     viewports      = factory.config.yaml.fe_correctness.viewports
     themes         = factory.config.yaml.fe_correctness.themes
     output_dir     = code_quality/reports/<TSK-id>-visual-iter-<N>/
     naming_pattern = "{viewport}-{theme}.png"
   Output: lista screenshot path { viewport, theme, path, bytes } da passare alla Fase 4
           (Critica Visiva).
   ```
   La skill condivisa pilota Playwright via Bash (`page.setViewportSize` per il viewport,
   `page.emulateMedia({ colorScheme })` per il tema, `page.screenshot`) e fail-loud se
   Playwright manca — comportamento identico all'implementazione inline pre-refactor
   (ADR-008 §Decisione, ADR-017 §Rationale 4/6).
4. **Naming convention** (invariata, ora applicata dalla skill condivisa via `naming_pattern`):
   `<viewport>-<theme>.png` (es. `mobile-light.png`, `desktop-dark.png`).

**Output prodotto**: N PNG (N = |viewports| × |themes|) nella cartella
`code_quality/reports/<TSK-id>-visual-iter-<N>/`. Identico al pre-refactor.

**Criterio di completamento**: esistono `|viewports| × |themes|` file PNG nella cartella
artefatti, nominati secondo la convention.

[^src: design_&_architecture/decisions/ADR-008.md §Conseguenze]
[^src: design_&_architecture/decisions/ADR-012.md §E]
[^src: design_&_architecture/decisions/ADR-017.md §«Cosa cambia in EP-005 (refactor non distruttivo)»]

---

## Fase 3-bis — Structured Checks (opt-in)

**Posizione**: inserita **dopo Fase 3 (Screenshot)** e **prima di Fase 4 (Critica
Visiva)**. Materializza la Leva 2 (oracoli binari) della sintesi `fe-agent-correctness-strategy`.

**Gate di attivazione**: `factory.config.yaml.fe_correctness.checks: [<id>, ...]`.
- **Lista vuota** (default `checks: []`) → **fase skip**; comportamento **identico a
  US-017 base** (backward compat: nessuna ERROR, nessun cambio di flusso). I tre check
  riportano `status: skip` nel report.
- Ogni `<id>` configurato attiva il check corrispondente. I tre id canonici sono:
  `visual-regression`, `axe-a11y`, `interaction-test`.

**Fail-loud per check configurato ma tool assente** (messaggio verbatim):

> Check `<id>` richiede `<tool>`; vedi runbook.

### Check `visual-regression`

- **Prerequisito ambientale**: snapshot di baseline in
  `code_quality/reports/<TSK-id>-visual-baseline/`.
- **Input**: i PNG della Fase 3 + la baseline di riferimento.
- **Azione**: diff binario pixel-per-pixel contro lo snapshot di baseline. Se la baseline
  è **assente al primo run** → **auto-crea la baseline** dai PNG correnti (fail-loud
  documentato: il primo run stabilisce il riferimento, i successivi diffano contro di esso).
- **Output JSON**:
  ```json
  { "status": "pass|fail", "diff_pixels": 0, "baseline_path": "code_quality/reports/<TSK-id>-visual-baseline/" }
  ```

### Check `axe-a11y`

- **Prerequisito ambientale**: `axe-core` disponibile, **iniettato da Playwright** nella
  pagina renderizzata (stessa pagina della Fase 2/3).
- **Input**: il DOM della pagina renderizzata.
- **Azione**: esegue la scansione `axe-core` sulla pagina.
- **Fail-loud** se `axe-core` non installato: «Check `axe-a11y` richiede `axe-core`; vedi runbook».
- **Output JSON**:
  ```json
  { "status": "pass|fail", "violations": [ { "rule": "color-contrast", "severity": "serious", "selector": "..." } ] }
  ```

### Check `interaction-test`

- **Prerequisito ambientale**: campo `interaction_test_spec:` nel **frontmatter TSK**
  (path, relativo al code_path, a un file di test Playwright). Campo opzionale scritto dal
  TPM in fase di taskizzazione (ADR-012 §A).
- **Input**: il file Playwright indicato da `interaction_test_spec`.
- **Azione**: esegue gli scenari di interazione usando lo **stesso Playwright runtime
  della Fase 2** → zero overhead aggiuntivo, riusa l'install (ADR-008 §Rationale 1 +
  §Conseguenze: «US-020 `interaction-test` usa lo stesso Playwright runtime»).
- **Fail-loud** se `interaction_test_spec:` è valorizzato ma il file è assente:
  «Check `interaction-test` richiede il file `<path>`; vedi runbook».
- **Output JSON**:
  ```json
  { "status": "pass|fail", "scenarios": [ { "name": "click submit", "status": "pass" } ] }
  ```

### Verdict aggregato della Fase 3-bis

- **Qualsiasi check binario `fail`** → `verdict: reject` **automatico**: nessun critic
  LLM necessario per il rigetto (gli oracoli binari sono deterministici e sufficienti a
  rigettare). Si salta alla Fase 5 con `next_action: escalate-human`.
- **Tutti i check binari `pass`** (o `skip`) → si **procede alla Fase 4** (critica visiva
  LLM) per il giudizio finale.

**Output prodotto**: popola il campo `checks` del JSON report (vedi sezione «Schema
Report») con `checks.visual_regression`, `checks.axe_a11y`, `checks.interaction_test`.
Ogni check non configurato → `status: skip`.

**Criterio di completamento**: tutti i check configurati hanno prodotto il loro output
JSON; il verdict aggregato è calcolato (reject su qualsiasi fail, altrimenti pass-through
a Fase 4).

[^src: design_&_architecture/decisions/ADR-008.md §Rationale punto 1]
[^src: design_&_architecture/decisions/ADR-012.md §H]
[^src: management/kanban/EP-005-fe-visual-oracle/US-020-oracoli-strutturati-binari/TSK-025.md]

---

## Fase 4 — Critica Visiva

**Input atteso**: i PNG della Fase 3 + la specifica del TSK (body + eventuale
`visual_reference:` a frame Figma / screenshot di riferimento, ADR-012 §A).

**Azione**:

1. Il critic è lo **stesso `fe-dev`** che esegue una **passata di review multimodale**,
   **NON un sub-agent dedicato né `qa-dev`** (ADR-009 §Decisione). Tecnicamente è una
   **sub-skill** invocata inline nello stesso turn dell'agente: il fe-dev cambia «modalità
   mentale» da producer a critic tramite il prompt di questa fase.
2. Il fe-dev legge i PNG via **Read tool** (capacità multimodale nativa — nessun MCP
   custom multimodale, ADR-009 §Rationale 4).
3. **Prompt del critic** (verbatim):

   > Confronta il rendering con la specifica del TSK e produce una lista di difetti azionabili.

   Il critic confronta ogni PNG con: (a) il body / Technical Specs del TSK, (b) il
   `visual_reference:` se presente (frame Figma / screenshot reference).
4. Produce una lista preliminare di difetti, ciascuno strutturato (vedi Fase 5 per lo
   schema dei 5 campi).

**Output prodotto**: lista di difetti preliminare (`critic_findings`), uno per ogni
problema rilevato; lista vuota `[]` se nessun difetto.

**Criterio di completamento**: lista difetti prodotta (anche vuota).

Questa fase è un'istanza del pattern **evaluator-optimizer**: il producer (fe-dev) ha
scritto il codice, il critic (stesso fe-dev in review) critica lo screenshot, il producer
itera sul feedback. La fonte del pattern è
[`wiki/syntheses/fe-agent-correctness-strategy.md §Leva 1`](../../wiki/syntheses/fe-agent-correctness-strategy.md)
(«È un'istanza del pattern evaluator-optimizer: il producer scrive il codice, il reviewer
critica lo screenshot, il producer itera sul feedback»).

[^src: wiki/syntheses/fe-agent-correctness-strategy.md §Leva 1]
[^src: design_&_architecture/decisions/ADR-009.md §Decisione]

---

## Fase 5 — Diff Azionabile + Loop bounded

**Input atteso**: lista difetti della Fase 4 (`critic_findings`) + verdict aggregato della
Fase 3-bis (se ha già forzato `reject`) + `current_iter` / `MAX_ITERATIONS`.

**Azione** — produce l'output strutturato del diff:

```json
{
  "verdict": "pass | conditional | reject",
  "defects": [
    {
      "description": "...",
      "viewport": "mobile | desktop | ...",
      "theme": "light | dark",
      "severity": "major | minor | trivial",
      "fix_hint": "..."
    }
  ]
}
```

I **5 campi per ogni defect** sono: `description`, `viewport`, `theme`, `severity`
(enum `major | minor | trivial`), `fix_hint`.

### Routing verdict → azione

| `verdict`     | `visual_status` scritto | `next_action`     | Comportamento |
|---|---|---|---|
| `pass`        | `pass`     | `done`            | TSK transita a `status: done`; pronto per review (ADR-013 Punto 1). |
| `conditional` | `conditional` | `loop`         | Ri-dispatch al `fe-dev` con la lista difetti come input handoff; **bounded** da `MAX_ITERATIONS` (default 3, analogo R.Q4 di CQRL). |
| `reject`      | `reject`   | `escalate-human`  | **Gate umano**; TSK resta `in-progress`; difetto strutturale, non auto-loop (ADR-013 §Rationale 6). |

Schema `next_action`: enum `done | loop | escalate-human` (mappa direttamente sul flusso
di `dev-protocol` Fase 4-bis, ADR-012 §H).

### Bound `max_iterations`

- Il loop `conditional → fe-dev → visual-oracle (iter N+1)` è **bounded** da
  `fe_correctness.max_iterations` (default 3).
- Se dopo `MAX_ITERATIONS` iterazioni il verdict è ancora `conditional` (nessuna
  convergenza) → **fail-loud + gate umano**: forza `verdict: reject`,
  `visual_status: reject`, `next_action: escalate-human`, e segnala in chat lo sforamento
  del bound. Coerente con il loop exhausted di CQRL (§7 r.16: `reject` = gate umano, mai
  auto-revert/auto-merge).

**Output prodotto**:
- Write `code_quality/reports/<TSK-id>-visual-iter-<N>.json` (schema sotto, conforme
  ADR-012 §H).
- Write `code_quality/reports/<TSK-id>-visual-iter-<N>.md` (digest umano-leggibile:
  verdict + tabella difetti + screenshot referenziati + loop status).
- Edit del frontmatter TSK: scrive **solo** il campo `visual_status:` (vedi nota
  single-writer sotto).
- Append a `wiki/log.md` (marker `visual-oracle TSK-ZZZ iter-N → <verdict>`).

**Criterio di completamento**: report JSON + digest scritti, `visual_status` aggiornato,
`next_action` determinato.

[^src: design_&_architecture/decisions/ADR-012.md §H]
[^src: design_&_architecture/decisions/ADR-013.md §Punto 1]
[^src: management/kanban/EP-005-fe-visual-oracle/US-017-skill-visual-oracle-protocol/TSK-021.md]

### Nota single-writer su `visual_status` (ADR-012 §A)

**SOLO questa skill** (`visual-oracle-protocol`) scrive il campo `visual_status:` nel
frontmatter del TSK. È il **single-writer** del campo (analogo a `review_status` per CQRL,
R.Q2). Dev-agent, PM, TPM, orchestrator **NON** lo scrivono a runtime: lo leggono soltanto
(code-review-protocol Fase 0 come gating precondition, orchestrator Oracle Pre-Check).
Enum del campo: `pending | pass | conditional | reject`. Questo evita race condition e
drift sul campo.

[^src: design_&_architecture/decisions/ADR-012.md §A]

---

## Schema Report

File: `code_quality/reports/<TSK-id>-visual-iter-<N>.json`. Schema **verbatim** conforme
ad ADR-012 §H:

```json
{
  "tsk_id": "TSK-NNN",
  "iter": 1,
  "verdict": "pass|conditional|reject",
  "screenshots": [
    {
      "viewport": "mobile",
      "theme": "light",
      "path": "code_quality/reports/TSK-NNN-visual-iter-1/mobile-light.png",
      "bytes": 12345
    }
  ],
  "checks": {
    "visual_regression": {
      "status": "pass|fail|skip",
      "diff_pixels": 0,
      "baseline_path": "..."
    },
    "axe_a11y": {
      "status": "pass|fail|skip",
      "violations": [
        { "rule": "color-contrast", "severity": "serious", "selector": "..." }
      ]
    },
    "interaction_test": {
      "status": "pass|fail|skip",
      "scenarios": [
        { "name": "click submit", "status": "pass" }
      ]
    }
  },
  "critic_findings": [
    {
      "description": "Button padding inconsistent vs design token",
      "viewport": "desktop",
      "theme": "light",
      "severity": "major|minor|trivial",
      "fix_hint": "Apply var(--spacing-md) instead of hardcoded 12px"
    }
  ],
  "next_action": "done|loop|escalate-human"
}
```

**Campi obbligatori** per ogni report: `tsk_id`, `iter`, `verdict`, `next_action`.

**Campi opzionali** (vuoti = la fase corrispondente è skip):
- `screenshots` — array dei PNG catturati in Fase 3 (vuoto se Fase 3 non eseguita).
- `checks` — popolato dalla **Fase 3-bis** (US-020). I tre sotto-oggetti
  (`visual_regression`, `axe_a11y`, `interaction_test`) hanno le strutture rispettive
  documentate in Fase 3-bis. Ogni check non configurato → `status: skip` (es. zero
  structured checks configurati → tutti e tre `skip`).
- `critic_findings` — array dei difetti prodotti dalla **Fase 4** (vuoto `[]` se
  `verdict: pass` senza difetti). I 5 campi per finding: `description`, `viewport`,
  `theme`, `severity` (`major|minor|trivial`), `fix_hint`.

Mapping `next_action` → flusso `dev-protocol` Fase 4-bis (ADR-012 §H):
- `done` → TSK `status: done`, `visual_status: pass`.
- `loop` → ri-dispatch fe-dev (bounded `max_iterations`).
- `escalate-human` → TSK resta `in-progress`, `visual_status: reject`, gate umano.

**Digest umano**: `code_quality/reports/<TSK-id>-visual-iter-<N>.md` — sintesi
leggibile (verdict, tabella difetti, screenshot referenziati, loop status). Lo slug
`visual` nel nome distingue dagli iter CQRL (`<TSK-id>-iter-<N>.{json,md}`); stesso
side-channel (`code_quality/reports/`, ADR-012 §B) = un solo path da configurare,
gitignore, monitorare.

[^src: design_&_architecture/decisions/ADR-012.md §H]
[^src: design_&_architecture/decisions/ADR-012.md §B]

---

## Pattern — evaluator-optimizer

Questa skill è **un'istanza esplicita del pattern `evaluator-optimizer`**: un producer
genera un artefatto (il fe-dev scrive il codice del componente → rendering → screenshot),
un evaluator lo critica (lo stesso fe-dev in modalità review legge i PNG e produce difetti
azionabili), e il producer itera sul feedback in un loop bounded (conditional → re-Develop
→ nuovo visual oracle, max `max_iterations`).

È la **stessa famiglia di pattern** già istanziata da
[`code-review-protocol`](./code-review-protocol.md) (CQRL v2.12, PATTERN §19): lì il
dev-agent produce, il code-reviewer critica il codice, il dev-agent fixa in loop bounded
da `code_quality.max_iterations`. Differenza chiave: qui producer ed evaluator sono lo
**stesso agente** (`fe-dev`) perché il critic visivo richiede la stessa conoscenza di
dominio del producer (componente FE, spec del TSK, design token) — vedi ADR-009 §Rationale
1. Il `code-review-protocol` invece splitta producer (dev-agent) ed evaluator
(`code-reviewer`) su due agent perché la review del codice è un asse ortogonale al dominio.

Ordering nel pipeline (ADR-013): **develop → visual-oracle → review**. Il rendering è più
fondamentale del codice (un componente con rendering rotto è inutile anche se il codice è
idiomatico), quindi il visual oracle è uno stage upstream rispetto al code review.

[^src: wiki/syntheses/fe-agent-correctness-strategy.md §Leva 1]
[^src: design_&_architecture/decisions/ADR-009.md §Decisione]
[^src: design_&_architecture/decisions/ADR-013.md §Punto 1]
