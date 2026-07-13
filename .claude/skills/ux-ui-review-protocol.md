---
name: ux-ui-review-protocol
description: Skill procedurale review UX/UI — 5 step ancorati alla rubrica anti-soggettività (Nielsen 10 + dimensioni UI 6 + flusso 5). Capability opt-in v2.18, PATTERN §3 UX/UI Review.
---
# Protocollo UX/UI Review — review strutturata in 5 step ancorata alla rubrica anti-soggettività

Skill procedurale fondante della capability UX/UI Review (EP-008) lato Review: incapsula la
conoscenza operativa per eseguire una review UX/UI **ancorata alla rubrica anti-soggettività**
([[ux-ui-rubric-anti-subjectivity]]), così che ogni finding sia ripetibile e difendibile, mai
"a sensazione". È caricabile al bisogno da `fe-dev`, `qa-dev` e dall'agente `ux-ui-reviewer`
(US-030, se scaffoldato) — istanza del pattern [[thin-agents-fat-skills-refactor]]: la procedura
vive nella skill (fat), gli agenti restano thin e non duplicano la conoscenza.

**Regola invariante** (architrave dell'intera skill, [[ux-ui-rubric-anti-subjectivity]] §Regola
operativa): **ogni `finding` cita almeno un `rubric_ref`** (asse 1/2/3 o regola del design
system). **Niente finding "a sensazione".** Le domande aperte di contesto utente/business vanno
in `open_questions`, mai in `findings`. Se parte del giudizio resta opinabile anche con rubrica,
marcare il finding con `opinion: true`.

La review orchestra le skill condivise già create: `screenshot-capture-protocol` (Step 1,
cattura via Playwright — TSK-042/US-031), `design-tokens-extraction` + `design-system-conformance-check`
(Step 2 — US-031), e delega la parte di accessibilità a `run_a11y_scan` (Step 4 — EP-007 US-025).

È un'**operazione opzionale** (PATTERN.md §3 «UX/UI Review»), attiva solo con la capability
EP-008 abilitata (`factory.config.yaml.ux_ui.enabled: true`). A capability spenta la skill è
no-op: l'assenza del file non produce ERROR di lint (R.P3, opt-in totale).

Riferimenti: ADR-017 (riuso single-source dell'infra screenshot), ADR-018 (default fallback
design system — 5 famiglie di token), ADR-019 (ordering pipeline `develop → visual-oracle →
ux-ui-review → code-review`, Punto 1 Fase 4-ter), ADR-020 (schema consolidato: config block
`ux_ui:`, frontmatter TSK, side-channel, vincoli reviewer), ADR-063 (anti-fabbricazione: fail-loud
su evidenza visiva indisponibile — STOP-condition Step 1 §A; guard evidence-provenance Step 5 §B).
Runbook narrativo source-of-truth:
[`wiki/runbooks/ux-ui-review-runbook.md`](../../wiki/runbooks/ux-ui-review-runbook.md).
Wiki: [[ux-ui-review-design-capability]], [[ux-ui-rubric-anti-subjectivity]].

[^src: management/kanban/EP-008-ux-ui-review-design-capability/US-028-skill-ux-ui-review-protocol/US-028.md §Business Rules]
[^src: design_&_architecture/decisions/ADR-018.md §Decisione]
[^src: design_&_architecture/decisions/ADR-019.md §Decisione]
[^src: design_&_architecture/decisions/ADR-020.md §Decisione]
[^src: design_&_architecture/decisions/ADR-063.md §A]
[^src: wiki/concepts/ux-ui-rubric-anti-subjectivity.md §Regola operativa]

---

## Step 1 — Input Visivo

**Input**: `target` (URL/route, componente isolato + harness, mockup statico, o solo codice
sorgente), `viewports` opzionali (risolti dal caller — vedi sotto).

**Azione** — risolvi l'input visivo seguendo la **cascata a 4 modalità**:

```
if target è URL/route http/https:
    capture_screenshot(target, viewports)        # multi-viewport: desktop + mobile (tablet opzionale)
    modalità = "url"
elif target è componente isolato AND harness disponibile (Storybook/preview):
    render in Storybook/preview → capture_screenshot(harness_url, viewports)
    modalità = "component-harness"
elif target è mockup statico (immagine/PNG):
    input diretto (NIENTE rendering)
    modalità = "mockup"                           # dichiarare nel report che è un mockup
elif mode == "no-visual" esplicito OR target è codebase/file (codice sorgente dichiarato):
    modalità = "no-visual"                        # SOLO se dichiarato esplicitamente — vedi nota
    → vedi sezione «Fallback senza input visivo»
else:                                             # target visivo ma nessun altro branch coperto
    modalità = "UNKNOWN"
    → applica STOP-condition fail-loud (vedi sotto)
```

### Step 1.0 — Serve & ambiente di render (app-lifecycle, ADR-064)

Prerequisito **prima** di `capture_screenshot`/`run_a11y_scan`: i tool sono script Playwright via
`Bash` (ADR-064 §binding). Richiedono (a) Playwright/axe risolvibili da `node_modules` e Node
compatibile, (b) un **target raggiungibile**. Risolvere così:

```
# 1. Risolvi il code_path/package target (dal TSK frontmatter o da factory.config.yaml.code_paths).
#    Le invocazioni dei tool .sh vanno eseguite da QUESTA CWD (require('playwright') risolve dalla CWD).
# 2. Determina il target servito:
if target è URL http/https già live:
    SERVED_URL = target                              # nessun avvio
elif esiste build servibile (dist/) OR serve dev-server:
    avvia un server effimero in background:
      preferisci  `npm run preview` / `vite preview --port <p>`  (build esistente)
      fallback    `npm run dev`                                  (dev-server)
    attendi health-check HTTP 200 su http://127.0.0.1:<p>/  (poll, timeout 30s)
    SERVED_URL = http://127.0.0.1:<p>/
    REGISTRA il pid per il teardown (vedi Step 6)
else:
    → STOP-condition fail-loud (target visivo non servibile)
```

> **Nota Node/CWD (ADR-064 §D)**: se il server fallisce con «Vite requires Node 20.19+» o i tool
> falliscono con `Cannot find module 'playwright'`, l'ambiente Node/CWD è errato — è un **errore
> tecnico fail-loud**, NON un degrado a `no-visual`. Allinea Node (`.nvmrc`) e CWD al package target.

**Invocazione concreta** (sostituisce lo pseudo-`capture_screenshot(...)` della cascata):

```
bash <factory>/tools/visual/capture_screenshot.sh \
     --target "$SERVED_URL" --viewports "desktop,mobile" --out "<output_dir>"
```

Il **teardown** del server effimero avviene nello Step 6 (o `finally`): `kill <pid>` — mai lasciare
processi orfani. `output_dir` è la cartella asset del report (vedi Step 5).

**STOP-condition fail-loud (ADR-063 §A)** — si attiva in DUE casi:

1. **`capture_screenshot` restituisce vuoto / errore / tool-not-callable** in modalità visiva
   (target = URL | componente | mockup-con-render): la review NON procede e NON produce finding.
2. **`screenshots: []` dopo invocazione di `capture_screenshot`** in modalità visiva: questo stato
   NON attiva silenziosamente la modalità `no-visual`; attiva il fail-loud.

In entrambi i casi: **STOP immediato**. Emettere il seguente messaggio canonico (invariante):

> «Evidenza visiva non disponibile (capture_screenshot/render fallito o tool non registrato):
> review UX/UI impossibile. Non si producono finding senza evidenza (ADR-063). Verificare la
> disponibilità dei tool / l'ambiente di render.»

Uscire dalla skill. **Non procedere agli Step 2-6.** Fail-closed, non fail-graceful.
Questa STOP-condition è analoga a `a11y-scan.sh` («Tool run_a11y_scan richiede Playwright +
axe-playwright → exit 1»): la capability si ferma rumorosamente quando l'evidenza manca.

**Nota modalità `no-visual` (ADR-063 §A)**: la modalità `no-visual` (review di sola
struttura/codice senza render) deve essere **dichiarata esplicitamente** (`--mode=no-visual` o
`target` di tipo codebase/file). `screenshots: []` da `capture_screenshot` vuoto NON attiva
silenziosamente `no-visual`: attiva la STOP-condition fail-loud sopra. Per avviare una review
`no-visual`: invocare la skill con `mode: no-visual` esplicito; in `no-visual` Step 1 raccoglie
evidenza via `Read`/`Grep` sul sorgente (ADR-063 §C).

- La cattura screenshot **delega a `screenshot-capture-protocol`** (skill condivisa, ADR-017):
  niente cattura inline qui. La matrice `viewports` è risolta **nel caller** con la cascade:
  (1) `factory.config.yaml.fe_correctness.viewports` se `fe_correctness.enabled: true` (riuso
  totale); (2) fallback `factory.config.yaml.ux_ui.default_viewports`
  (default `[{name: mobile, width: 375}, {name: desktop, width: 1280}]`). Themes omessi di
  default per la review euristica (un solo theme sufficiente).
- Modalità `mockup`: aggiungere `summary.input_note: "input = mockup statico, non rendering live"`.

**Output**: `{target, modalità, screenshots: [{viewport, theme, path}]}` (o `screenshots: []`
solo se `modalità = "no-visual"` dichiarata esplicitamente).

**Criterio di completamento**: `modalità` risolta a uno dei 4 valori; per `url`/`component-harness`
gli screenshot sono prodotti E non vuoti (altrimenti STOP-condition); per `mockup` l'input è
dichiarato; per `no-visual` (solo se dichiarato esplicitamente) si entra nel fallback (non si
producono finding su dimensioni visive senza rendering).

[^src: management/kanban/EP-008-ux-ui-review-design-capability/US-028-skill-ux-ui-review-protocol/US-028.md §Step 1]
[^src: design_&_architecture/decisions/ADR-063.md §A]

---

## Step 2 — Token + Design System

**Input**: `target`, screenshot dello Step 1.

**Azione** — invoca `extract_design_tokens(target)` (skill `design-tokens-extraction`) seguito da
`check_design_system_conformance(target, ref)` (skill `design-system-conformance-check`). La
risoluzione del design system segue la **cascata a 3 livelli** (ADR-018):

```
1. factory.config.yaml.ux_ui.design_system_path valorizzato AND file esiste → source = "design_system"
2. token estratti dal codice (CSS custom properties, Tailwind config, style constants)
   o da output figma-sync v2.9 (raw/YYYY-MM-DD-figma-*.kb.json)               → source = "css" | "figma"
3. default ragionevoli (5 famiglie minimali, vedi §Default fallback design system) → source = "defaults"
```

- L'output di `extract_design_tokens` include **sempre** il campo `source`
  (`design_system | css | figma | defaults`) per tracciabilità (ADR-018 §contract US-031).
- Con `source: defaults`, la skill `design-system-conformance-check` **NON emette deviations
  `major/minor`**: emette al massimo `open_questions` (es. "token primary del progetto non noto;
  default fallback usato per il check") — ADR-018 §Vincoli applicativi.
- **Se DS non disponibile (`source: defaults`)**, annotare nel report la formula verbatim:

  > Design system non disponibile; review basata su euristiche Nielsen e default fallback documentati (ADR-018). Coerenza interna non verificabile rispetto a un sistema di riferimento del progetto.

  e aggiungere automaticamente `open_questions: ["design system non disponibile; review usa default fallback (ADR-018)"]`.

**Output**: `{tokens_source, tokens, conformance: {deviations[], open_questions[]}}`.

**Criterio di completamento**: `tokens_source` risolto; se `defaults`, la formula verbatim e
l'open_question sono nel report; nessuna deviation `major/minor` quando `source: defaults`.

[^src: management/kanban/EP-008-ux-ui-review-design-capability/US-028-skill-ux-ui-review-protocol/US-028.md §Step 2]
[^src: design_&_architecture/decisions/ADR-018.md §Vincoli applicativi]

---

## Step 3 — Rubrica 3 Assi (core della review)

**Input**: screenshot (Step 1) + token/conformance (Step 2).

**Azione** — valuta l'input visivo contro **tutti e tre gli assi** della
[[ux-ui-rubric-anti-subjectivity]]. Per ogni problema rilevato produci un `finding` con
`rubric_ref` obbligatorio, `severity`, `location`, `description`, `recommendation`, `evidence`.

### 3a — Euristiche di usabilità di Nielsen (10)

Scorri le 10 euristiche. Per ogni problema: euristica violata (`rubric_ref: "nielsen-N"`) →
severità → posizione → raccomandazione.

| ref | Euristica | Domanda operativa |
|---|---|---|
| `nielsen-1` | Visibilità dello stato del sistema | L'utente sa sempre cosa sta succedendo? |
| `nielsen-2` | Corrispondenza tra sistema e mondo reale | Il linguaggio rispecchia il dominio dell'utente? |
| `nielsen-3` | Controllo e libertà dell'utente | L'utente può annullare / tornare indietro facilmente? |
| `nielsen-4` | Coerenza e standard | Parole, situazioni e azioni simili si comportano allo stesso modo? |
| `nielsen-5` | Prevenzione degli errori | Il design previene i problemi prima che si verifichino? |
| `nielsen-6` | Riconoscere invece di ricordare | Istruzioni e opzioni sono visibili, non memorizzate? |
| `nielsen-7` | Flessibilità ed efficienza d'uso | Esistono acceleratori per utenti esperti? |
| `nielsen-8` | Design estetico e minimalista | Contiene solo informazioni rilevanti? |
| `nielsen-9` | Riconoscere, diagnosticare e recuperare dagli errori | I messaggi di errore sono utili e chiari? |
| `nielsen-10` | Aiuto e documentazione | Se serve aiuto, è facile trovarlo e usarlo? |

### 3b — Dimensioni di UI visiva (6)

`rubric_ref: "ui-<dimensione>"` (es. `ui-gerarchia`).

| ref | Dimensione | Domanda operativa |
|---|---|---|
| `ui-gerarchia` | Gerarchia | L'occhio segue l'ordine d'importanza? Il titolo è più prominente del body? |
| `ui-spaziatura` | Spaziatura / ritmo | Gli spazi sono coerenti? I raggruppamenti per prossimità sono corretti? |
| `ui-tipografia` | Tipografia | La scala è leggibile? Il numero di stili è contenuto? |
| `ui-colore` | Colore | L'uso è semantico e coerente? |
| `ui-coerenza` | Coerenza | Stessi pattern per stessi scopi? Aderenza al design system? |
| `ui-affordance` | Affordance / stati | Hover / focus / active / disabled / loading / empty / error sono visibili e distinti? |

**Contrasto cromatico delegato a Step 4 (axe-core), non duplicare.** La dimensione `ui-colore`
copre l'uso *semantico e coerente* del colore; il **contrasto WCAG AA** (e l'ordine di focus)
sono accessibilità → delegati a `run_a11y_scan` nello Step 4. Non emettere finding di contrasto
qui (eviti il doppio conteggio con il report a11y).

### 3c — Dimensioni di flusso UX (5)

Applicabile **solo se la review copre un flusso multi-passo**. `rubric_ref: "ux-<dimensione>"`.

| ref | Dimensione | Domanda operativa |
|---|---|---|
| `ux-passi-valore` | Numero di passi vs valore | Il flusso è proporzionato al valore che offre? |
| `ux-abbandono` | Punti di abbandono | Dove l'utente tipicamente si ferma o torna indietro? |
| `ux-prossimo-passo` | Chiarezza del prossimo passo | È sempre evidente cosa fare dopo? |
| `ux-errori-vuoti` | Gestione errori e stati vuoti | Errori e stati vuoti sono previsti e comunicati chiaramente? |
| `ux-reversibilita` | Reversibilità delle azioni | Le azioni distruttive sono reversibili o richiedono conferma? |

**Output**: `findings[]` (ciascuno con `rubric_ref`), `positive_findings[]`.

**Criterio di completamento**: i 3 assi sono stati scorsi; ogni `finding` ha un `rubric_ref`
valido; nessun finding di contrasto cromatico (delegato a Step 4); i punti opinabili marcati
`opinion: true`.

[^src: wiki/concepts/ux-ui-rubric-anti-subjectivity.md §Asse 1]
[^src: wiki/concepts/ux-ui-rubric-anti-subjectivity.md §Asse 2]
[^src: wiki/concepts/ux-ui-rubric-anti-subjectivity.md §Asse 3]

---

## Step 3-bis — Critic/Judge Design (condizionale, opt-in EP-019)

**Trigger**: eseguire questo step **SOLO** se `factory.config.yaml.design_intelligence.critic_enabled: true`.
A flag spento (default): **SKIP** — procedere direttamente allo Step 4 (no-op totale, R.P3).

**Prerequisito**: screenshot disponibili dallo Step 1 (modalità visiva). In modalità `no-visual`
→ il passo è **SKIPPED** automaticamente (non valutabile senza render).

**Regola R.D3** (ADR-070 §C, ADR-071): il Critic/Judge Design è uno **strumento di refinement,
NON un oracolo**. Le critiche alimentano il loop di refinement ma **non emettono un verdict
deterministico** di «design buono/cattivo». La correlazione con il giudizio di un designer umano
non è garantita — ancorare a checkpoint umani periodici. Ogni finding **deve** avere evidenza
visiva concreta (`evidence_zone`): finding senza evidenza → rigettato (guard evidence-provenance,
ADR-063 §B).

**Confine EP-005** (dichiarare nel report verbatim):

> «Scope: qualità visiva del design (6 principi di qualità); NON correttezza funzionale FE
> (Visual Oracle EP-005, che emette verdict deterministico su asserzioni binarie).
> Il Visual Oracle e il Critic/Judge sono capability distinte — runtime di cattura condiviso,
> scopo e output distinti (ADR-070 §A).»

**Input**: screenshot (Step 1) + `design_rationale` (Step 2-bis di `ux-ui-design-protocol`, se disponibile).

**Azione** — valutare le **6 dimensioni di qualità visiva** (ADR-070 §D):

| dim_id | Principio | Domanda critica |
|---|---|---|
| `critic-gerarchia` | Gerarchia visiva | L'occhio segue l'ordine di importanza dichiarato nel `design_rationale`? Il peso visivo rispetta il tema art-director? |
| `critic-contrasto` | Contrasto visivo | Le distinzioni figura/sfondo, primario/secondario, attivo/inattivo sono percepibili? |
| `critic-allineamento` | Allineamento | Gli elementi sono allineati in modo coerente? Il grid system è rispettato? |
| `critic-ritmo` | Ritmo / Spaziatura | La spaziatura segue il ritmo del design system? Il bilanciamento bianco/contenuto è equilibrato? |
| `critic-spaziatura` | Densità informativa | Il contenuto è adeguatamente aerato? Nessun affollamento visivo? |
| `critic-coerenza-tema` | Coerenza col tema | I token applicati corrispondono all'`art_director_spec`? Deviazioni documentate nel `design_rationale`? |

**Schema finding Critic/Judge** (ogni finding strutturato):

```json
{
  "principle": "critic-gerarchia|critic-contrasto|critic-allineamento|critic-ritmo|critic-spaziatura|critic-coerenza-tema",
  "evidence_zone": "<region of screenshot + description — es. 'area header, desktop-1280.png zona superiore'>",
  "rationale_ref": "<campo del design_rationale violato o assente — es. 'design_rationale.decision'>",
  "severity": "critical|major|minor",
  "description": "<osservazione concreta — cosa si vede e perché è problematico>",
  "recommendation": "<proposta di refinement — non prescrizione implementativa dettagliata>",
  "is_refinement_suggestion": true
}
```

- `evidence_zone` **obbligatorio e non nullable** — finding senza → rigettato (guard evidence-provenance).
- `rationale_ref` dovrebbe puntare a un campo specifico del `design_rationale` prodotto in
  `ux-ui-design-protocol` Step 2-bis (es. `design_rationale.constraints_applied[0]`). Se
  `design_rationale` non è disponibile (task senza EP-019) → il campo vale `"design_rationale: non disponibile"`.
- `is_refinement_suggestion: true` sempre — ricorda al consumer che il Critic/Judge è advisory,
  non un verdict deterministico (R.D3).

**Bounded loop** (ADR-070 §D): il ciclo critic → fix → re-review è bounded da
`ux_ui.max_iterations` (default 3, analogo a R.Q4). Su reject del Critic/Judge →
richiedere una **nuova spec** all'LLM (ADR-069 §E), non riscrivere il template.

**Output**: `critic_findings[]` (con schema sopra), inseriti nel report Step 5 in sezione
separata `critic_judge_section`. **Non** vanno in `findings[]` della rubrica principale —
sono qualitativi, non inferiti da rubric_ref Nielsen/UI/UX.

**Criterio di completamento**: le 6 dimensioni sono state valutate; ogni finding ha `evidence_zone`
e `is_refinement_suggestion: true`; confine EP-005 dichiarato; R.D3 applicato (nessun verdict
deterministico emesso). Se `rubric_intention_economy: true`, la sotto-dimensione Intention Economy
è inclusa (vedi sezione sotto).

### Sotto-dimensione — Intention Economy / Resolution Velocity (condizionale)

**Trigger**: eseguire **SOLO** se `factory.config.yaml.design_intelligence.rubric_intention_economy: true`.
A flag spento (default `false`): **SKIP** — no-op totale (backward compat EP-008, R.P3).

**Nota**: l'Intention Economy è una **sotto-dimensione qualitativa** del Critic/Judge, **NON**
una formula matematica. La formula `RV = step_count / completed_intentions` è **respinta**
(ADR-070 §E: US-077 prescrive esplicitamente «non è una formula matematica in v1»).
Si operazionalizza come 3 domande operative esplicite (qualitative, evita falsa precisione).

**Input aggiuntivo**: campo `design_rationale.consequences.resolution_velocity_impact`
(prodotto dal gate US-074 / `ux-ui-design-protocol` Step 2-bis). Se assente → documentare
come `open_question: "resolution_velocity_impact non dichiarato nel design_rationale"`.

**3 domande operative** (checklist obbligatoria, risposta sì/no + evidenza):

1. **Riduzione passi** — questa scelta riduce il numero di step per completare l'azione comune
   dell'utente? *(sì: positivo | no: potenziale warn | non applicabile: annotare)*
2. **Eliminazione elementi distrattivi** — questa scelta elimina elementi decorativi o
   distrattivi che rallentano lettura/navigazione? *(sì: positivo | no: potenziale warn)*
3. **Chiarezza su novità** — questa scelta preferisce chiarezza e prevedibilità rispetto
   a novità visiva? *(sì: positivo | no: possibile fail se la novità non è giustificata)*

**Verdict `intention_economy`** (qualitativo):

| Verdict | Criteri |
|---|---|
| `pass` | Tutte e 3 le risposte positive, o le risposte negative hanno rationale esplicito e giustificato |
| `warn` | 1 risposta negativa senza rationale sufficiente, o `resolution_velocity_impact` assente |
| `fail` | 2+ risposte negative senza rationale, o presenza di anti-pattern engagement |

**Anti-pattern obbligatorio — Attention Economy** (ADR-070 §E): qualsiasi rationale che
giustifica una scelta con metriche di **engagement** (tempo sul sito, click-through, novità
visiva, "gamification dell'attenzione") → **finding `major`** automatico con nota:
`"criterio obsoleto, attention economy — rigettato. La scelta deve essere giustificata
con criteri di chiarezza/prevedibilità/riduzione di passi (intention economy paradigm 2026)."`

**Schema output** (aggiunto a `intention_economy_section` nel report Step 5):

```json
{
  "intention_economy_verdict": "pass|warn|fail",
  "questions": [
    {"q": "riduzione_passi", "answer": "yes|no|na", "evidence": "<...>"},
    {"q": "eliminazione_distrattivi", "answer": "yes|no|na", "evidence": "<...>"},
    {"q": "chiarezza_su_novita", "answer": "yes|no|na", "evidence": "<...>"}
  ],
  "resolution_velocity_impact_ref": "<design_rationale.consequences.resolution_velocity_impact o 'non disponibile'>",
  "attention_economy_finding": null
}
```

`intention_economy_section` nel report è `null` se il flag è spento (no-op documentale).

[^src: design_&_architecture/decisions/ADR-070.md §A §B §C §D §E]
[^src: management/kanban/EP-019-design-intelligence-layer/US-076-critic-judge-design-rubrica-ux-ui-review/TSK-172.md §Technical Specs]
[^src: management/kanban/EP-019-design-intelligence-layer/US-077-intention-economy-resolution-velocity-rubrica/TSK-173.md §Technical Specs]

---

## Step 4 — Delega a11y

**Input**: `target` (stesso dello Step 1), `factory.config.yaml.ux_ui.delegate_a11y_to_ep007`.

**Azione** — delega la parte di accessibilità a `run_a11y_scan` (EP-007 US-025):

- Se EP-007 è attiva (`a11y.enabled: true` e `delegate_a11y_to_ep007: true`): invoca
  `run_a11y_scan(target, standard: "wcag22aa")`. **Incorpora i risultati in una sezione separata
  del report** (`a11y_section`), **non** nei `findings[]` UX — non duplicare i finding a11y
  (contrasto, ordine focus, label) nella parte UX (ADR-014, US-028 §Step 4).
- Se EP-007 **non** è attiva: segnala come
  `open_questions: ["a11y scan non eseguita — EP-007 disabilitata"]`. Non inventare finding a11y.

**Output**: `a11y_section` (risultati `run_a11y_scan`) oppure `open_questions` con la stringa
standard sopra.

**Criterio di completamento**: i risultati a11y sono in sezione separata (mai nei `findings[]`
UX), oppure l'open_question di EP-007 disabilitata è presente.

[^src: management/kanban/EP-008-ux-ui-review-design-capability/US-028-skill-ux-ui-review-protocol/US-028.md §Step 4]
[^src: design_&_architecture/decisions/ADR-019.md §Composizione con dominio a11y]

---

## Step 5 — Report Standard

**Input**: output arricchito degli Step 1-4.

**Azione** — produce il report nello **schema JSON standard** (US-028 §Step 5, concept §Schema di
output standard) + una sintesi leggibile in Markdown:

```json
{
  "target": "...",
  "type": "ux_ui_review",
  "summary": { "critical": 0, "major": 2, "minor": 4, "open_questions": 3 },
  "findings": [
    {
      "rubric_ref": "nielsen-1",
      "severity": "major",
      "location": "...",
      "description": "...",
      "recommendation": "...",
      "evidence": "screenshots/desktop-1280.png (Step 1, capture_screenshot output)",
      "opinion": false
    }
  ],
  "positive_findings": [],
  "open_questions": [],
  "tokens_source": "design_system|css|figma|defaults",
  "critic_judge_section": null,
  "intention_economy_section": null,
  "generated_by": null
}
```

> `generated_by` (opzionale, backward-compat): nome canonico dell'agente o della skill
> che ha eseguito questa review (es. `"ux-ui-reviewer"`, `"fe-dev (skill ux-ui-review-protocol)"`).
> Valorizzare nello step di persist (fine Step 5). Assenza → Check 4ac (EP-024) emette
> `skipped` (nessun WARNING, nessun false positive).

Il campo `evidence` è **obbligatorio e non nullable** in ogni finding: deve referenziare un
artefatto reale prodotto negli Step 1/2. Valori ammessi:
- Modalità visiva: path screenshot esistente su disco prodotto da Step 1
  (es. `screenshots/desktop-1280.png`).
- Token/conformance: output di `extract_design_tokens` o `check_design_system_conformance`
  prodotti in Step 2 (es. `code_quality/reports/TSK-042-uxui-review-iter-1/tokens.json`).
- Modalità `no-visual`: path file/snippet letto via `Read`/`Grep` in Step 1
  (es. `src/App.tsx:42 (Read output, Step 1)`).

- **Regola invariante**: ogni `finding` cita un `rubric_ref` (asse 1/2/3 o regola DS).
  **Niente finding "a sensazione".** Domande aperte di contesto utente/business → `open_questions`,
  mai `findings`. Punti opinabili → `opinion: true` + nota in `description`.
- Lo `severity` è ∈ `{critical, major, minor}`. Il report **descrive** problemi e raccomanda;
  non emette un verdetto di "design buono/cattivo" (descrittivo, non prescrittivo — vedi §Vincoli).
- **`rubric_strict`**: se `factory.config.yaml.ux_ui.rubric_strict: true` (default), un finding
  senza `rubric_ref` è un errore di procedura (scartalo o assegnagli un ref); se `false`, emetti
  un WARNING ma procedi.

**Guard di SOSTANZA — evidence-provenance (ADR-063 §B)**:

Ogni finding deve avere un campo `evidence` che referenzia un artefatto reale prodotto negli
Step 1/2. **Regola di rigetto**: se `evidence` è `null`, stringa vuota, path non esistente su
disco, o non tracciabile a un artefatto degli Step 1/2 → il finding viene **rigettato** (non
emesso nel report). Questo vale in entrambe le modalità (visiva e `no-visual`): il tipo di
artefatto atteso cambia (screenshot vs. `Read`/`Grep` output), la regola di rigetto è invariante.

Questo guard è **complementare** a `rubric_strict` (forma): `rubric_strict` verifica che ogni
finding citi una rubrica (guardia anti-soggettività); `evidence-provenance` verifica che ogni
finding citi un artefatto reale (guardia anti-fabbricazione). Un finding valido deve soddisfare
**entrambi** i guard:
- finding con `rubric_ref` ma `evidence: null` → rigettato da `evidence-provenance`.
- finding con `evidence` valida ma senza `rubric_ref` → rigettato da `rubric_strict`.
- finding con entrambi valorizzati e verificabili → emesso.

Il guard `evidence-provenance` si applica **indipendentemente** dal valore di `rubric_strict`
(anche se `rubric_strict: false`, la verifica dell'evidenza resta obbligatoria).

[^src: design_&_architecture/decisions/ADR-063.md §B]

**Output**: report JSON + digest Markdown. Side-channel storage (ADR-020 §E, riuso CQRL):
`code_quality/reports/<TSK-id>-uxui-review-iter-<N>.{json,md}` (con TSK), oppure
`code_quality/reports/_adhoc/uxui-review-<YYYY-MM-DD-HH-MM>-<slug>.{json,md}` (standalone).
Gli screenshot/tokens/conformance vivono in `code_quality/reports/<TSK-id>-uxui-review-iter-<N>/`.

**Criterio di completamento**: report JSON conforme allo schema (6 campi top-level:
`target`, `type`, `summary`, `findings`, `positive_findings`, `open_questions`; + `tokens_source`);
ogni finding con `rubric_ref` e `evidence` verificabile (guard forma + sostanza entrambi soddisfatti);
i finding che non superano uno dei due guard sono stati scartati prima dell'emissione;
digest Markdown prodotto.

[^src: management/kanban/EP-008-ux-ui-review-design-capability/US-028-skill-ux-ui-review-protocol/US-028.md §Step 5]
[^src: wiki/concepts/ux-ui-review-design-capability.md §Schema di output standard]
[^src: design_&_architecture/decisions/ADR-063.md §B]

---

## Esito della review (handoff Fase 4-ter, ADR-019)

Quando invocata come sub-step di Develop FE (`dev-protocol` Fase 4-ter), l'esito popola il
frontmatter TSK `ux_ui_status` (ADR-019 §Punto 1, ADR-020 §F):

- **pass** → `ux_ui_status: pass`; il TSK procede a Fase 5 (handoff a `done`).
- **conditional** → loop `fe-dev` bounded da `ux_ui.max_iterations` (default 3); i `findings`
  con `rubric_ref` diventano input dell'handoff (pattern [[evaluator-optimizer]] lato evaluator).
- **reject** → `ux_ui_status: reject`; TSK resta `in-progress`; **gate umano** (difetto strutturale
  UX non recuperabile in N iter; nessun auto-loop).

---

## Vincoli del reviewer

Enforced nella skill (US-028 §Vincoli del reviewer, ADR-020 §H):

1. **NON progettare**: la skill produce critica **descrittiva** ("aggiungere uno stato loading"),
   non prescrittiva nel dettaglio implementativo. Il design è la sotto-capability distinta
   (`ux-ui-design-protocol`, US-029), affidata a un agente fisicamente separato (`ui-designer`).
2. **NON auto-valutare**: se il caller ha anche contribuito al design della schermata, segnalarlo
   e raccomandare l'invocazione di un agente distinto (`ux-ui-reviewer`). Separazione no-auto-eval.
3. **NON dichiarare conformità a11y**: l'accessibilità è delegata a EP-007 (Step 4). La skill non
   emette mai un verdetto di conformità WCAG; i risultati a11y restano in sezione separata.

---

## Fallback senza input visivo (modalità `no-visual` esplicita)

Branch `no-visual` della cascata dello Step 1: **richiede dichiarazione esplicita** (`mode: no-visual`
o `target` di tipo codebase/file). NON si attiva da `screenshots: []` su un target visivo —
in quel caso si applica la STOP-condition fail-loud (ADR-063 §A).

1. **Priorità**: se il caller non ha dichiarato esplicitamente `no-visual`, ottenere uno screenshot
   ASAP. Chiedi URL/route, harness Storybook, o mockup. La review su solo codice è **drasticamente
   ridotta** — dichiararlo nel report
   (`summary.coverage_note: "solo codice sorgente, nessun rendering — review ridotta"`).
2. **Cosa si può fare senza rendering**: limitare la review alla **struttura logica del flusso**
   (Asse 3 — dimensioni di flusso UX) + **coerenza codice/DS** (Step 2 conformance check).
3. **Cosa NON si può fare**: **NIENTE finding su dimensioni visive** (Asse 2: gerarchia,
   spaziatura, tipografia, colore, affordance/stati) senza rendering — sarebbero "a sensazione".
4. `findings[]` limitato agli assi verificabili; tutto il resto → `open_questions`
   ("dimensioni visive non valutate — manca rendering").

[^src: management/kanban/EP-008-ux-ui-review-design-capability/US-028-skill-ux-ui-review-protocol/US-028.md §Fallback senza input visivo]

---

## Default fallback design system (ADR-018)

Lista minimale di **5 famiglie di token** usata quando la cascata DS (Step 2) arriva al fallback
(`source: defaults`). Conoscenza procedurale del framework, non config del derivatore (override via
`ux_ui.design_system_path`, cascata step 1). Referenziata anche da `ux-ui-design-protocol` (US-029).

```yaml
defaults:
  source: defaults                    # tag esplicito (US-031 contract)
  type:
    fontFamilies:
      - system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
    sizes:                            # modular scale 1.25 (major third)
      - { name: xs, value: 12px }
      - { name: sm, value: 14px }
      - { name: md, value: 16px }     # base
      - { name: lg, value: 20px }
      - { name: xl, value: 24px }
      - { name: xxl, value: 32px }
    lineHeights:
      - { name: tight,   value: 1.2 }
      - { name: regular, value: 1.5 }
      - { name: loose,   value: 1.75 }
    weights:
      - { name: regular, value: 400 }
      - { name: medium,  value: 500 }
      - { name: bold,    value: 700 }
  colors:                             # tailwind-inspired neutral palette
    neutral:
      - { name: white,  value: "#FFFFFF" }
      - { name: 50,     value: "#F9FAFB" }
      - { name: 100,    value: "#F3F4F6" }
      - { name: 500,    value: "#6B7280" }
      - { name: 900,    value: "#111827" }
      - { name: black,  value: "#000000" }
    semantic:                         # generici, no brand
      - { name: primary,  value: "#2563EB" }   # blue-600
      - { name: success,  value: "#16A34A" }   # green-600
      - { name: warning,  value: "#CA8A04" }   # yellow-600
      - { name: danger,   value: "#DC2626" }   # red-600
  spacing:                            # scale lineare 4px (rhythm 0.25rem)
    - { name: 0,  value: 0   }
    - { name: 1,  value: 4px  }
    - { name: 2,  value: 8px  }
    - { name: 3,  value: 12px }
    - { name: 4,  value: 16px }       # base
    - { name: 6,  value: 24px }
    - { name: 8,  value: 32px }
    - { name: 12, value: 48px }
  radii:                              # 3 valori, no over-engineering
    - { name: sm,   value: 4px  }
    - { name: md,   value: 8px  }
    - { name: full, value: 9999px }
  focus:                              # 5° famiglia, critical per a11y by design
    - { name: ring_width,   value: 2px }
    - { name: ring_offset,  value: 2px }
    - { name: ring_color,   value: "#2563EB" }  # = colors.semantic.primary
    - { name: ring_style,   value: solid }
```

Con `source: defaults` la conformance check NON emette deviations `major/minor` — solo
`open_questions` (ADR-018 §Vincoli applicativi punto 3).

[^src: design_&_architecture/decisions/ADR-018.md §Lista minimale]

---

## Pattern

- Istanza di [[evaluator-optimizer]] (lato **evaluator**): la skill valuta l'artefatto FE e
  produce findings che alimentano il loop di ottimizzazione del `fe-dev` (conditional → fix →
  re-review, bounded da `ux_ui.max_iterations`).
- Istanza di [[thin-agents-fat-skills-refactor]]: la procedura vive qui (fat skill), consumata da
  più agenti thin (`fe-dev` inline Fase 4-ter, `qa-dev` post-Develop, `ux-ui-reviewer` standalone).
- PATTERN.md §3 — operazione opzionale «UX/UI Review»: mattone fondante = la rubrica (no tool
  deterministico di verdetto), invariante "ogni finding cita `rubric_ref`" da
  [[ux-ui-rubric-anti-subjectivity]]. Opt-in `factory.config.yaml.ux_ui.enabled`.
- Riuso single-source dell'infra screenshot (ADR-017): Step 1 delega a `screenshot-capture-protocol`,
  condivisa con il visual oracle (EP-005). Default DS (ADR-018) condivisi con `ux-ui-design-protocol`.

[^src: design_&_architecture/decisions/ADR-019.md §Rationale]
[^src: design_&_architecture/decisions/ADR-020.md §Decisione]
