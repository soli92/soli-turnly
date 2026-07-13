---
name: dev-protocol
description: Procedura per un dev-agent che consuma un TSK e produce codice in code_path. Single source of truth per Develop (PATTERN §3).
---
# Procedura — consumare un TSK (Develop, L4 → L5)

Skill condivisa fra `be-dev`, `fe-dev`, `db-dev`, `qa-dev`. La specializzazione
per layer vive nell'agente; questa skill è la spina dorsale comune.

## Fase 0 — Gate preliminare + target resolution (v2.12 multi-repo)

Prima di qualsiasi scrittura:

1. **Leggi `factory.config.yaml`** (root del repo).
2. Verifica:
   - `topology` ammette il tuo layer (es. per `be-dev`: topologia ∈
     {`full-stack-agents`, `hybrid-be-agents`, `custom` con `be-dev` listato}).
   - `routing.<tuo-layer> == agent` (oppure override esplicito via `/dev`).
   - Esiste un percorso L5 risolvibile (vedi step 2-bis: target resolution).
3. **Leggi il TSK**: deve avere `layer: <tuo>`, `consumer: agent`, `status: todo`,
   dipendenze chiuse. Se manca anche solo un campo o un gate, **STOP** e
   segnala in chat (non procedere "in modalità best-effort").

### Step 2-bis — Target resolution (v2.12 multi-repo, PATTERN §5 + §13)

Determina il `code_path` effettivo (`resolved_code_path`) e la `resolved_vcs` da usare:

**Caso A — Legacy single-repo** (`code_path:` valorizzato, `code_paths: []` o assente):
- `resolved_code_path = factory.config.yaml.code_path`
- `resolved_vcs = factory.config.yaml.vcs` (top-level)
- `resolved_target_name = "default"` (per logging)
- Procedi.

**Caso B — Multi-repo** (`code_paths: [<entry>, ...]` non vuoto):

1. Read TSK `target:` frontmatter.
2. Se `target:` valorizzato:
   - Cerca `entry = code_paths[name == target]`.
   - Se non trovato → **ERROR** «TSK <id> ha `target: <X>` ma nessuna entry in `code_paths` con quel nome». STOP.
   - Se trovato ma `<tuo-layer>` non in `entry.layers` → **ERROR** «TSK <id> ha layer <Y> e target <X>, ma entry <X> non lista <Y> in `layers`». STOP.
   - `resolved_code_path = entry.path`; `resolved_vcs = entry.vcs`; `resolved_target_name = entry.name`. Procedi.
3. Se `target:` assente:
   - Filtra `candidates = [e for e in code_paths if <tuo-layer> in e.layers]`.
   - Se `len(candidates) == 0` → **ERROR** di config «Nessuna entry in `code_paths` lista <tuo-layer>; routing.<layer>: agent richiede almeno una entry. Lint Check 4c violato». STOP.
   - Se `len(candidates) == 1` → auto-derive: `entry = candidates[0]`. Procedi con `resolved_*` da quell'entry.
   - Se `len(candidates) >= 2` → **ERROR** «TSK <id> layer <Y> ambiguo: ≥ 2 entry in `code_paths` listano <Y> (`<n1>`, `<n2>`, ...). Il TPM doveva valorizzare `target:`. Lint Check 4j violato». STOP. Mai indovinare.

4. Verifica accessibilità di `resolved_code_path`:
   - Esiste sul filesystem oppure è creabile (es. submodule path con `git submodule init` ancora da fare).
   - Se non esiste e non creabile → **ERROR** «code_path <path> per target <name> non accessibile». STOP.

5. Log a chat:
   ```
   Target resolved: <name> → <resolved_code_path> (vcs: <mode>)
   ```

Tutto il resto del protocollo (Fasi 1-5) usa `resolved_code_path` e `resolved_vcs` al
posto del legacy `code_path` + `vcs`. La citazione codice nei dev-agent (§6) usa il
prefisso appropriato in base a `resolved_vcs.mode`.

### Step 2-ter — Branch alignment gate (opt-in, EP-034 v2.25, PATTERN §15 §Branch Awareness Layer)

Gate **pre-dispatch** che verifica di trovarsi sul branch giusto *prima* di scrivere codice —
critico per i target `submodule`/`sibling` (problema dei due HEAD).

**No-op a flag spento (default)**: si attiva **solo se**
`resolved_vcs.branch_awareness.enabled: true` AND `resolved_vcs.branch_awareness.dispatch_gate ≠ off`.
Altrimenti comportamento identico a v2.24 (R.B10): salta direttamente a Fase 1.

Quando attivo, e **solo** per `resolved_vcs.mode ∈ {submodule, sibling}` (per `monorepo`/`external`
il gate è degenere e viene saltato):

1. Calcola `expected_branch` invocando `branch-resolver` (R.B9) con `resolved_vcs`,
   `resolved_target_name` e il TSK corrente.
2. Determina lo stato reale del target (read-only, R.B7):
   - Se `submodule` e `<submodule_path>/.git` assente → **STOP** «submodule <name> non
     inizializzato: `git submodule update --init <submodule_path>`».
   - Branch corrente via `git -C <dir> symbolic-ref --short HEAD` (fallisce = detached).
3. Confronta:
   - **detached HEAD** → gestione secondo `dispatch_gate` (vedi sotto).
   - `expected_branch` valorizzato E ≠ branch corrente → mismatch.
   - `expected_branch` null (es. `shared` senza `base_branch`) e HEAD su un branch → OK.
4. Azione secondo `dispatch_gate`:
   - **`block`** → **STOP** con il comando esatto di remediation. Non procedere alla Fase 1.
   - **`warn`** → WARNING inline con il comando suggerito, poi **procedi** (l'umano ha deciso di
     lanciare comunque).
   - Se `auto_align: propose` → invece del solo STOP/WARNING, **proponi** il `git checkout`
     `<expected_branch>` sotto **gate umano** (mai eseguirlo in autonomia, R.B8). Su conferma
     esplicita dell'umano il checkout può essere eseguito; senza conferma → STOP.

Comando di remediation tipico emesso dal gate:
```
git -C <resolved_code_path o submodule_path> checkout <expected_branch>
# se il branch non esiste ancora:
git -C <...> checkout -b <expected_branch>
```

**Vincolo (R.B8)**: il gate **non esegue mai `git checkout` automatico**. Al massimo lo propone
sotto gate umano (`auto_align: propose`). La responsabilità dello stato dei repo esterni
(sibling/external) resta umana.

## Fase 1 — Preparazione contesto

1. Leggi la US riferita dal TSK (path deducibile: `EP-XXX-*/US-YYY-*/US-YYY.md`).
2. Leggi l'ADR / sezione di `design_&_architecture/` citato.
3. Apri le pagine `wiki/` citate transitivamente dalla US (concept/entity/synthesis).
   Non citarle direttamente nel codice — citazione cascade: il codice cita TSK/ADR.
4. Leggi `raw/tech_stack.md` per vincoli (versioni, standards).
5. Esplora `<code_path>/**` per capire layout esistente.

## Fase 2 — Handoff iniziale

1. Edit del TSK: `status: in-progress`, aggiungi `updated: YYYY-MM-DD HH:MM`.
2. Non toccare il corpo del TSK.

## Fase 3 — Implementazione

1. Implementa secondo:
   - Implementation Steps del TSK (ordine indicativo, non vincolante)
   - Technical Specs del TSK
   - Standards verbatim citati nei raw (PATTERN §11)
2. Atomicità: tutto il cambiamento per **un singolo TSK** deve essere
   coerente (un commit logico, anche se il VCS lo separa in più commit).
3. Se durante l'implementazione scopri che il TSK è **sotto-specificato**:
   - Gap di knowledge base → append `wiki/gaps.md` (vedi `wiki-gap-protocol`)
   - Decisione architetturale mancante → STOP e segnala in chat (`tpm` o
     `lead-architect` la prenderanno; non improvvisare design)
   - Bug pre-esistente fuori scope → segnala in chat (TPM aprirà TSK separato),
     non fixare opportunisticamente (PATTERN §7 r.8)

## Fase 4 — Definition of Done

Verifica la DoD del TSK punto per punto:
- [ ] Codice compila / build passa
- [ ] Test unitari relativi passano
- [ ] (Se applicabile) Test integrazione passano
- [ ] Documentazione inline minima (docstring, README locale solo se richiesto)
- [ ] Niente file fuori scope toccati

Se anche un solo punto fallisce e non puoi risolverlo nel TSK corrente:
- Rollback delle modifiche già fatte (preferibile) o segnala chiaramente in chat
  lo stato parziale.
- Edit `status: in-progress` (NON `done`), e descrivi il blocker in chat.

## Fase 4-bis — Visual Verification (opt-in fe_correctness)

Sub-step di Develop FE, posizionato **dopo la Fase 4** (build/typecheck verde) e
**prima della Fase 5** (handoff a `done`). Formalizza il Punto 1 di ADR-013
(ordering `develop → visual-oracle → review`).

**Trigger (condizione AND)**:
- `TSK.layer == 'fe'` **AND** `factory.config.yaml.fe_correctness.enabled == true`.

**No-op esplicito** (backward compat):
- A flag spento (`fe_correctness.enabled: false`, default) **oppure** `TSK.layer != 'fe'`,
  la Fase 4-bis è **no-op**: il TSK passa direttamente da Fase 4 a Fase 5, con
  `visual_status` assente o `pending`. **Comportamento identico a v2.16.** Una factory
  che non opta-in non vede alcuna differenza.

**Fail-loud**:
- Se il trigger è soddisfatto (`layer: fe` + `fe_correctness.enabled: true`) ma la skill
  `visual-oracle-protocol` **non è presente** nell'adapter → **ERROR** «`fe_correctness.enabled: true`
  ma skill `visual-oracle-protocol` assente; impossibile eseguire la Fase 4-bis». STOP.
  Mai degradare silenziosamente a no-op quando il flag è attivo.

**Azione**:
1. Invoca `visual-oracle-protocol` (skill) come sub-procedura, passando il `TSK-id` e il
   `resolved_code_path` (da Fase 0 step 2-bis). La skill produce un output strutturato
   `{verdict, defects}` (il critic è lo stesso `fe-dev` in passata multimodale, vedi ADR-009 §Conseguenze).

**Esiti** (gestiti analogamente a CQRL, PATTERN §19):

```
verdict: pass        → visual_status: pass; TSK transita a status: done (→ Fase 5).
verdict: conditional → loop fe-dev (bounded fe_correctness.max_iterations, default 3);
                       la lista difetti (defects) è l'input handoff dell'iterazione
                       successiva; il TSK resta in-progress fino a pass o esaurimento bound.
verdict: reject      → visual_status: reject; TSK resta in-progress; gate umano
                       (difetto strutturale, non risolvibile in 1-3 iter; coerente con
                       CQRL §19 reject → gate umano, non auto-loop).
```

- **Loop `conditional`**: bounded da `fe_correctness.max_iterations` (default `3`, analogo a
  `code_quality.max_iterations` / R.Q4 di CQRL). A ogni iterazione la lista `defects` è
  passata come handoff a `fe-dev`, che ri-implementa e ri-sottopone al visual oracle.
  Esaurito il bound senza `pass`, l'esito degrada a gate umano (non `done`).
- **`reject`**: il TSK **non** transita a `done`; resta `in-progress` con `visual_status: reject`.
  La review è bloccata a valle (precondition Fase 0 di `code-review-protocol`, ADR-013 §Punto 2).

**Input**: TSK FE con build/typecheck verde (output Fase 4); `factory.config.yaml.fe_correctness`.
**Output**: `visual_status: pass` (→ Fase 5) | loop fe-dev (`conditional`) | `visual_status: reject` + gate umano.
**Criterio**: `verdict == pass` → procedi a Fase 5; altrimenti loop bounded o STOP per gate umano.

[^src: design_&_architecture/decisions/ADR-013.md §Punto 1 — dev-protocol Fase 4-bis (flusso verbatim)]
[^src: design_&_architecture/decisions/ADR-009.md §Conseguenze — critic = stesso fe-dev, ordering visual → review]

## Fase 4-ter — UX/UI Review (opt-in ux_ui, v2.18, ADR-019)

Sub-step di Develop FE, posizionato **dopo la Fase 4-bis** (Visual Verification) e
**prima della Fase 5** (handoff a `done`). Formalizza il Punto 1 di ADR-019
(ordering `develop → visual-oracle → ux-ui-review → code-review`), estensione naturale
e additiva della Fase 4-bis (ADR-013). Analogia stretta con la Fase 4-bis Visual
Verification — stessa forma, stesso pattern evaluator-optimizer.

**Trigger (condizione AND)**:
- `TSK.layer == 'fe'` **AND** `factory.config.yaml.ux_ui.enabled == true`.

**No-op esplicito** (backward compat):
- A flag spento (`ux_ui.enabled: false`, default) **oppure** `TSK.layer != 'fe'`,
  la Fase 4-ter è **no-op**: il TSK passa direttamente dalla Fase 4-bis alla Fase 5,
  con `ux_ui_status` assente o `pending`. **Comportamento identico a v2.17.** Una factory
  che non opta-in non vede alcuna differenza nella pipeline FE (ADR-019 §Rationale 4).

**Pre-condizione** (composizione con Fase 4-bis, ADR-019 §Punto 3 §Composizione):
- `visual_status` deve essere **non-pending** nel TSK: la Fase 4-bis deve aver concluso
  (`pass`, `conditional` o `reject`) se `fe_correctness.enabled: true`. Se
  `fe_correctness.enabled: false`, la pre-condizione **non è applicabile** (no visual
  oracle nella pipeline) e la Fase 4-ter parte immediatamente dopo la Fase 4.
- Se `visual_status: reject` → la Fase 4-ter è **SKIPPED** (no point reviewing un
  rendering rotto): il TSK resta `in-progress` con gate umano sul visual oracle. Mai
  procedere a review UX su rendering non validato.
- Se `visual_status: conditional` → la Fase 4-ter **può** partire in parallel al loop
  visual oracle (ottimizzazione ADR-019 §Rationale 7): la ux-ui-review prepara findings
  sul rendering corrente mentre il fe-dev applica i fix visual, riducendo round-trip.

**Fail-loud**:
- Se il trigger è soddisfatto (`layer: fe` + `ux_ui.enabled: true`) ma né la skill
  `ux-ui-review-protocol` né l'agente `ux-ui-reviewer` (se `ux_ui.agents.reviewer: true`)
  sono presenti nell'adapter → **ERROR** «`ux_ui.enabled: true` ma nessun esecutore
  ux-ui-review disponibile (skill `ux-ui-review-protocol` assente e agente
  `ux-ui-reviewer` non gating); impossibile eseguire la Fase 4-ter». STOP.
  Mai degradare silenziosamente a no-op quando il flag è attivo.

**Azione**:
1. Invoca `ux-ui-reviewer` (agente, se `ux_ui.agents.reviewer: true`) **oppure** la skill
   `ux-ui-review-protocol` (US-028) via agente attivo nella topologia (fallback),
   passando il `TSK-id` e il `resolved_code_path` (da Fase 0 step 2-bis). La separazione
   designer ↔ reviewer è enforced (mai auto-valutazione, US-030).
2. Produce report side-channel in
   `code_quality/reports/<TSK-id>-uxui-review-iter-<N>.{json,md}` (slug `uxui-review`
   distingue da `visual`/`a11y`/CQRL, ADR-019 §Schema dati).
3. Aggiorna frontmatter TSK: `ux_ui_status: pending|pass|conditional|reject` +
   `ux_ui_report: <path>` (single-writer = reviewer, US-032 §Frontmatter).

**Esiti** (gestiti analogamente a Fase 4-bis e a CQRL, PATTERN §19):

```
verdict: pass        → ux_ui_status: pass; TSK transita a status: done (→ Fase 5).
verdict: conditional → loop fe-dev (bounded ux_ui.max_iterations, default 3);
                       i findings con rubric_ref sono l'input handoff dell'iterazione
                       successiva; il TSK resta in-progress fino a pass o esaurimento bound.
verdict: reject      → ux_ui_status: reject; TSK resta in-progress; gate umano
                       (difetto strutturale UX non risolvibile in 1-3 iter; coerente con
                       CQRL §19 reject → gate umano e con Fase 4-bis, non auto-loop).
```

- **Loop `conditional`**: bounded da `ux_ui.max_iterations` (default `3`, analogo a
  `fe_correctness.max_iterations` della Fase 4-bis e a `code_quality.max_iterations` /
  R.Q4 di CQRL). A ogni iterazione la lista findings (ciascuno con `rubric_ref`,
  invariante anti-soggettività) è passata come handoff a `fe-dev`, che ri-implementa e
  ri-sottopone alla ux-ui-review. Esaurito il bound senza `pass`, l'esito degrada a gate
  umano (non `done`).
- **`reject`**: il TSK **non** transita a `done`; resta `in-progress` con
  `ux_ui_status: reject`. Diversamente dal `visual_status: reject` (che blocca a valle la
  review codice, Fase 0 di `code-review-protocol`), il `ux_ui_status` non blocca il
  code-review (precondition solo informativa, ADR-019 §Punto 2).

**Input**: TSK FE con `visual_status` non-pending (output Fase 4-bis se
`fe_correctness.enabled: true`; altrimenti output Fase 4 diretto);
`factory.config.yaml.ux_ui`.
**Output**: `ux_ui_status: pass` (→ Fase 5) | loop fe-dev (`conditional`) |
`ux_ui_status: reject` + gate umano | SKIPPED se `visual_status: reject`.
**Criterio**: `verdict == pass` → procedi a Fase 5; altrimenti loop bounded o STOP per gate umano.

[^src: design_&_architecture/decisions/ADR-019.md §Punto 1 — dev-protocol Fase 4-ter (flusso verbatim)]
[^src: design_&_architecture/decisions/ADR-019.md §Punto 3 §Composizione — visual_status non-pending, reject → SKIPPED]
[^src: management/kanban/EP-008-ux-ui-review-design-capability/US-032-integrazione-visual-oracle-cqrl-scheduler/US-032.md §Estensione dev-protocol]

## Fase 5 — Handoff finale (Develop completato)

1. Edit del TSK: `status: done`, `updated: YYYY-MM-DD HH:MM`.
2. Invoca `dev-handoff` (skill) per scrivere l'entry su `wiki/log.md`.
3. **Invoca `vcs-handoff`** (skill, v2.8 esteso multi-repo v2.12) passando
   `resolved_vcs` + `resolved_target_name` (da Fase 0 step 2-bis). La skill coordina
   i commit per la topologia VCS del **target risolto**, non per la factory globale:
   - `monorepo` → propone commit nel factory repo (path = `resolved_code_path` sotto factory root).
   - `submodule` → propone commit nel submodule referenziato da `resolved_vcs.submodule_path`, poi bump del ref nel factory.
   - `sibling` → propone commit nel repo esterno (`resolved_code_path`) + avviso PR.
   - `external` → solo log, nessuna operazione VCS.
   - `none` → STOP (incoerenza: develop su mode `none` non dovrebbe accadere).

   In multi-repo, **ogni vcs-handoff è per-target**: mai operazioni coordinate
   cross-target automaticamente. Se un TSK richiede modifiche cross-repo, si scompone
   in N TSK con target distinti (responsabilità del TPM).

   Gate umano obbligatorio per ogni `git commit` (vedi PATTERN §7 r.14).

## Vincoli inviolabili

- **Mai editare il corpo del TSK** (solo `status:` e `updated:`).
- **Mai scrivere su `wiki/**`** se non append a `wiki/log.md` e `wiki/gaps.md`.
- **Mai scrivere su `design_&_architecture/`** (è proprietà di Arch).
- **Mai scrivere su `management/kanban/**`** fuori dal proprio TSK (la
  generazione TSK è proprietà del TPM).
- **Mai inventare endpoint, tabelle, classi** non specificati nel design.
- **Standards verbatim** (PATTERN §11): se SAML/OIDC/FHIR citati, implementa
  esattamente quelli.
- **Stop se code_path non è valorizzato.** Mai scrivere "a indovinare" in `./src/`.

## Analytics Instrumentation (opt-in v2.19+)

**Gate**: `factory.config.yaml.analytics.measurement.enabled: true` AND
`factory.config.yaml.analytics.dogfooding.enabled: true`.
SE entrambi `false` (default factory derivate): EARLY RETURN — 0 side effect, 0 eventi scritti.
A `measurement.enabled: true` ma `dogfooding.enabled: false`: cabling no-op (comportamento v2.18).

**Single-writer**: il tool `tools/analytics/record-event.sh` è l'UNICO writer di
`analytics/events/<YYYY-MM>.jsonl`. I punti di iniezione sotto DEVONO passare per quel tool.
Pattern R.G5 (single-writer per side-channel). [^src: design_&_architecture/decisions/ADR-039.md §B]

**PII invariante**: i payload NON contengono mai: contenuto di file, contenuto prompt LLM,
env vars, segreti, PII utente. Solo metadati allowlist-compliant (ADR-040 §A).

### Punto 1 — Transizione `state: started` (Fase 2: todo → in-progress)

**Trigger**: dev-agent inizia l'esecuzione di un TSK (status: todo → in-progress).
**Granularità**: attivo per `analytics.granularity` in `{tsk, wave, tool}` (tutti i livelli).
**Payload** (campi allowlist-compliant ADR-040 §A):
```json
{
  "task_id": "<TSK-NNN-slug>",
  "project_id": "<factory-slug>",
  "actor_type": "agent",
  "actor_id": "<be-dev|fe-dev|db-dev|qa-dev>",
  "task_type": "<layer: be|fe|db|qa|docs|...>",
  "state": "started",
  "ts": "<ISO-8601 UTC con Z>",
  "tokens": {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0},
  "model": "<current-model-id>",
  "tool_calls": []
}
```

### Punto 2 — Transizione `state: finished` (Fase 5: in-progress → done)

**Trigger**: dev-agent dichiara `status: done` sul TSK dopo DoD superata.
**Granularità**: attivo per `analytics.granularity` in `{tsk, wave, tool}`.
**Payload**: payload di `started` + estensioni:
```json
{
  "elapsed_ms": "<wall-clock ms da started>",
  "tokens": {"input": N, "output": M, "cache_read": K, "cache_write": J},
  "tool_calls": [...]
}
```

### Punto 3 — Transizione `state: blocked` (Fase 4: DoD fallisce o blocked_by dichiarato)

**Trigger**: dev-agent dichiara `blocked_by: [...]` nel frontmatter TSK O `pending_clarification`.
**Granularità**: attivo per `analytics.granularity` in `{tsk, wave, tool}`.
**Payload**: payload di `started` + estensioni:
```json
{
  "blocked_reason": "<slug strutturato max 200 char, es. dep-unresolved — NO testo libero ADR-040 §B cat 7>",
  "blocking_artifacts": ["<path-file-1>", "<path-file-2>"]
}
```

### Punto 4 — Transizione `state: aborted` (NUOVO v2.19, ADR-042 §A)

**Trigger**: TSK interrotto mid-sprint per timeout, override umano, errore non recuperabile.
**Granularità**: attivo per `analytics.granularity` in `{tsk, wave, tool}`.
**Payload**: payload di `started` + estensioni:
```json
{
  "aborted_reason": "<slug strutturato max 200 char — NO testo libero ADR-040 §B cat 7>"
}
```

### Comportamento in caso di errore di scrittura

SE la scrittura a `analytics/events/<YYYY-MM>.jsonl` fallisce (disk full, lock contention >5s):
- Il dev-protocol **prosegue** il workflow normale (fail-open sul workflow osservato).
- Aggiunge WARNING in `wiki/log.md`: `[analytics-write-fail] TSK-NNN state=<state> at <ts>`.
- NON blocca il TSK. NON riprova la scrittura (no retry loop).

[^src: design_&_architecture/decisions/ADR-038.md §B — 4 punti di iniezione TSK (started/finished/blocked/aborted), default granularity wave]
[^src: design_&_architecture/decisions/ADR-039.md §A §B §C — single-writer record-event.sh, dedup hash compound, side-channel R.G5]
[^src: design_&_architecture/decisions/ADR-040.md §A §B — payload allowlist-compliant, PII invariante, slug strutturato cat 7]
[^src: design_&_architecture/decisions/ADR-042.md §A §B — nuovo enum aborted/wave_started/wave_completed, schema extension senza breaking]
[^src: management/kanban/EP-013-analytics-dogfooding-instrumentation/US-052-cabling-record-task-event-dev-protocol-scheduler/US-052.md §Business Rules — gate measurement+dogfooding, fail-open scrittura]
