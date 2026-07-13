---
id: migration-v214-fase2
type: runbook
title: "Migrazione v2.14 Fase 1 → v2.14 Fase 2 (Context Compression Layer via Graphify)"
status: draft
created: 2026-05-28
updated: 2026-05-28
sources:
  - "PATTERN.md §0, §4 (naming), §7 r.17, §16 (sync adapters esteso), §20.10-§20.11 (Context Compression Layer + R.G1-R.G6), §21 (Versioning)"
  - "factory.config.yaml (blocco compression.context esteso)"
  - ".claude/agents/graphify-sync.md (thin)"
  - ".claude/skills/graphify-extraction-protocol.md (5 fasi)"
  - ".claude/commands/graphify-sync.md (sync/show/status/refresh)"
  - ".claude/agents/code-reviewer.md (blast radius pre-check)"
  - ".claude/skills/parallel-scheduling.md (confidence-gated context resolve)"
  - ".gitignore (nuovo, con .graphify-state/)"
  - "wiki/concepts/factory-compression-layer.md (design doc + Aggiornamento Fase 2)"
related:
  - factory-compression-layer
  - graphify
  - knowledge-graph-codebase
  - token-compression
  - parallel-scheduler
  - code-quality-review-layer
  - sync-adapters
  - migration-v214
  - migration-v213
tags: [runbook, migrazione, v2-14-fase2, compression, context, graphify, sync-adapters, opt-in]
---

# Migrazione v2.14 Fase 1 → v2.14 Fase 2 (Context Compression Layer)

> Runbook della seconda fase di v2.14 che introduce il **Context Compression Layer**
> via [[graphify]] come quarto sync adapter. Bypass esplicito del gate Fase 1.5 (validation
> empirica ancora pending) per priorità di delivery: implementazione resta
> completamente opt-in (R.G6).

## Contesto: perché Fase 2

La Fase 1 di v2.14 ha introdotto l'asse **output** del Compression Layer
([[caveman]]). La roadmap prevedeva:
- Fase 1.5 — Validation empirica su factory derivata (gate pre-Fase 2)
- Fase 2 — Asse **context** via [[graphify]] come 4° sync adapter

In assenza di una factory derivata candidate v2.14 + Caveman installato (vedi
[[compression-validation-template]]), procediamo con Fase 2 in modalità **opt-in
totale**: implementazione completa ma `compression.context.enabled: false` di
default. Quando la Fase 1.5 sarà eseguibile, validerà entrambi gli assi insieme.

Tre motivazioni concrete per la Fase 2 (PATTERN §20.10):
1. **Codebase grandi (>10k LOC)**: file sorgente raw nel context dei dev-agent
   sono proibitivi su sessioni multiple
2. **Wave parallele moltiplicative**: ogni dev-agent nella wave paga il costo del
   context indipendentemente (4 agent × N file → 4N file letti)
3. **Blast radius analysis pre-fix**: il code-reviewer può anticipare regressioni
   downstream usando `get_impact_radius` sui file della fix

## Modifiche introdotte

### PATTERN.md

- **§0**: aggiunta menzione di context compression nell'origine (oltre output)
- **§4**: nuove entry naming per `raw/YYYY-MM-DD-graph-<slug>.md` (summary
  umano-leggibile) + side-channel `.graphify-state/code_paths/<slug>/`
- **§16** (esteso): Graphify come **4° sync adapter**:
  - Tabella sub-agent supportati aggiornata (PDF, Figma, Repo, **Graph**)
  - Invariante di isolamento esteso a `graphify-sync` (mai tocca scope altri adapter,
    mai modifica `<code_path>` scansionato, §7 r.17)
  - Nuova sub-sezione «Side-channel storage per `graphify-sync`»
- **§20.10** (nuovo): «Context Compression Layer (v2.14 Fase 2, Graphify code_path)»
  con 5 subsezioni:
  - §20.10.1 — Confidence-gated dispatch (EXTRACTED/INFERRED/AMBIGUOUS per ruolo)
  - §20.10.2 — `factory.config.yaml.compression.context` schema completo
  - §20.10.3 — Integrazione con code-reviewer (CQRL §19): `get_impact_radius`
  - §20.10.4 — Drift mitigation (cron weekly, drift monitoring, ci_strategy)
  - §20.10.5 — Pipeline completa con context compression attiva (diagramma)
- **§20.11** (nuovo): «Invarianti del Context Compression (R.G1–R.G6)»
- **§21**: entry v2.14 changelog estesa con Fase 2 deliverable

### Sei invarianti R.G1–R.G6 (PATTERN §20.11)

| Invariante | Sintesi | Bypassabile? |
|---|---|---|
| **R.G1** | Filesystem è single source of truth; graph è view derivata mai authoritative | NO |
| **R.G2** | Confidence-gated dispatch obbligatorio: executor → `EXTRACTED` only; explorer → `+INFERRED`; reviewer → tutto | NO |
| **R.G3** | Blast radius pre-check obbligatorio su modifiche se context.enabled (incluso in task_package code-reviewer §20.10.3) | NO |
| **R.G4** | Drift mitigation obbligatoria: 4 protezioni (incremental update + cron weekly + drift monitoring + alert) | NO |
| **R.G5** | Side-channel `.graphify-state/**` write-restricted: solo `graphify-sync` scrive | NO |
| **R.G6** | Opt-in totale (default `enabled: false`); backward compat verso v2.14 Fase 1-only | NO |

### Configurazione (`factory.config.yaml.compression.context`)

Blocco esteso da placeholder a fully-functional. Schema v2.14 Fase 2:

```yaml
compression:
  context:
    provider: none                 # none (default) | graphify-cloud | graphify-ollama
    enabled: false                 # DEFAULT OFF (R.G6 opt-in)
    package: graphifyy             # PyPI doppia y | graphify-ts
    install_command: "pip install graphifyy"
    ollama:
      model: llama3.1:8b
      vram_gb_min: 16
    targets: []                    # esempi commentati in factory.config.yaml
    update_strategy: incremental
    full_rebuild_cron: "0 0 * * 0"
    drift_alert_days: 7
    full_rebuild_cost_warn: 5      # USD, gate esplicito sopra soglia
    ghost_duplicates_warn: 10
    ci_strategy:
      mode: cache-with-fallback    # default OK per CI
      cache_provider: actions
      cache_key_prefix: graphify-state
      stale_threshold_hours: 168
      full_rebuild_on_demand: true
    confidence_gating:
      executor: [EXTRACTED]
      explorer: [EXTRACTED, INFERRED]
      reviewer: [EXTRACTED, INFERRED, AMBIGUOUS]
    mcp_server:
      enabled: false               # opt-in
      topology: per-agent
      crg_tools_max: 8
```

### `.gitignore` (nuovo file)

Aggiunto al root del meta-framework. Contiene `.graphify-state/` come pattern
versato (R.G6). Le factory derivate erediteranno via bootstrap (auto-scaffolding del
.gitignore al primo `compression.context.enabled: true`).

### Agent + Skill + Command (3 file nuovi)

**`.claude/agents/graphify-sync.md`** (thin, analogo a `repo-sync` v2.12):
- Sub-agent del ruolo Sync (§2 + §16)
- Read-only verso `<code_path>` (§7 r.17)
- Scrive in `raw/*-graph-*.md` + side-channel `.graphify-state/code_paths/<slug>/`
- `caveman_policy:` opzionale con `to_artifact: off` esplicito (R.C1)

**`.claude/skills/graphify-extraction-protocol.md`** (5 fasi):
| Fase | Scope |
|---|---|
| 1. Bootstrap | Read config, verifica `graphifyy`/`graphify-ts`, dedup manifest |
| 2. Discovery + Cost Estimation | Auto-detect full vs incremental, STOP se cost > warn |
| 3. Build Graph | Invoca Graphify CLI, cattura metriche stdout |
| 4. Side-channel write + Summary | Scrive `.graphify-state/`, genera `raw/<data>-graph-<slug>.md`, append manifest |
| 5. Log | Append `wiki/log.md` + chat output |

**`.claude/commands/graphify-sync.md`** (4 sub-comandi):
- `/graphify-sync <target>` — estrazione standard (5 fasi)
- `/graphify-sync show` — lista estrazioni dal manifest
- `/graphify-sync status [<target>]` — drift monitoring
- `/graphify-sync refresh [<target>]` — incremental update (zero token, no gate)

### Aggiornamenti agent/skill esistenti

**`.claude/agents/code-reviewer.md`** (§Procedura estesa):
- Nuovo blocco «Blast radius pre-check (v2.14 Fase 2, opzionale)»
- Se `compression.context.enabled: true` E `.graphify-state/code_paths/<slug>/`
  esiste → invoca `graphify get_impact_radius` per i file della fix
- Pass blast radius al `feedback-router` come constraint nel `task_package` (R.G3)
- Riduce regression detection risk (R.Q4-ter §19.4)

**`.claude/skills/parallel-scheduling.md`** (§Fase 5 estesa):
- Step 1 nuovo: «Context compression resolve (v2.14 Fase 2, opzionale)»
- Determina ruolo dell'agent destinatario (executor/explorer/reviewer)
- Filtra `GRAPH_REPORT.md` per `confidence_gating.<role>` (R.G2)
- Pass il GRAPH_REPORT filtrato come context al posto dei file sorgente raw
- Fallback automatico a scansione filesystem se `.graphify-state/` assente o stale

Step 2-7 (precedenti 1-6) rinumerati.

## Procedura di adozione

### Per factory esistenti v2.14 Fase 1-only (backward compat — R.G6)

**Zero azioni richieste**. La factory continua a funzionare identica:
- `factory.config.yaml.compression.context.enabled: false` default → no-op
- `.graphify-state/` non esiste → fallback automatico in `parallel-scheduling`
- Code-reviewer skip blast radius pre-check
- Nessuna migrazione del frontmatter agent

### Per attivare context compression in una factory derivata

Step 1 — Installa Graphify:
```bash
# Opzione A: Python (raccomandato, 20 linguaggi supportati)
pip install graphifyy   # PyPI: doppia y, ufficiale

# Opzione B: TypeScript (12 linguaggi via tree-sitter WASM)
npm install -g graphify-ts

# Verifica
graphifyy --version  # o graphify-ts --version
```

Step 2 — Configura il provider:
```bash
/compression set context.provider graphify-cloud   # o graphify-ollama
/compression set context.enabled true
```

Per `graphify-cloud`: setta `ANTHROPIC_API_KEY` o `OPENAI_API_KEY` (env var, mai
committata).

Per `graphify-ollama`: avvia Ollama localmente con modello (es. `llama3.1:8b`,
richiede 16+ GB VRAM).

Step 3 — Definisci target in `factory.config.yaml.compression.context.targets`:
```yaml
targets:
  - kind: code_path
    name: backend           # match a code_paths[].name
    gitignore_patterns:
      - "*.env"
      - "secrets/**"
```

Step 4 — Aggiungi `.graphify-state/` al `.gitignore` della factory (mai versionato).

Step 5 — Esegui prima estrazione (full rebuild):
```bash
/graphify-sync backend
# Mostra cost estimation, attendi conferma se > 5$, procede
```

Step 6 — Verifica stato:
```bash
/graphify-sync show       # lista estrazioni
/graphify-sync status     # drift monitoring
ls .graphify-state/code_paths/backend/   # graph.json, GRAPH_REPORT.md, last_full_rebuild.txt
```

Step 7 — Configura cron per refresh weekly:
```cron
0 0 * * 0 cd /path/to/factory && /graphify-sync backend --force
```

Step 8 — Configura post-commit hook (opzionale, incremental update):
```bash
# .git/hooks/post-commit
#!/bin/bash
cd $(git rev-parse --show-toplevel)
/graphify-sync refresh backend   # zero token, AST update only
```

Da questo momento i dev-agent nella factory consumano automaticamente
`GRAPH_REPORT.md` filtrato per confidence al posto dei file sorgente raw.

### Per nuove factory (post-v2.14 Fase 2 bootstrap)

Il `factory-bootstrap` meta-prompt (v2.14+) chiederà `compression_context_mode`
come opt-in:
- `none` (default, deferred)
- `graphify-cloud` (richiede install + API key)
- `graphify-ollama` (enterprise data residency)

Se attivato, il bootstrap:
- Scaffolda `.graphify-state/` nel `.gitignore` automaticamente
- Popola `compression.context.targets` con i `code_paths` dichiarati durante setup
- Suggerisce in chat il primo `/graphify-sync <target>` post-bootstrap (cost-gated)

## Verifica post-migrazione

### Coerenza statica (`wiki-lint` Check 4l, v2.15)

- `compression.context.enabled: true` ⇒ Graphify installato + topology compatibile + `code_paths` non vuoto
- `targets[i].kind == code_path` ⇒ `code_paths[name == target.name]` esiste
- `targets[i].kind == wiki` ⇒ riservato v2.15 con PoC karpathy (gate)
- `policy_profile` di output e `provider` di context coerenti con topology

### Stress test manuale

1. Esegui `/graphify-sync backend` su un code_path reale (>10k LOC)
2. Verifica `.graphify-state/code_paths/backend/{graph.json,GRAPH_REPORT.md}` presenti
3. Verifica `raw/<data>-graph-backend.md` summary umano-leggibile
4. Esegui un wave di dev-agent paralleli (es. 4 TSK)
5. Misura context window dei dev-agent prima/dopo (target: riduzione 10-70×)
6. Verifica `wave_report.md` include sezione `## Compression stats` per context axis

### Smoke test confidence gating (R.G2)

1. Verifica che `be-dev` riceva solo nodi `EXTRACTED` (no inferenza semantica)
2. Verifica che `lead-architect` riceva `EXTRACTED + INFERRED`
3. Verifica che `code-reviewer` riceva tutto, ma con flag visibile

### Smoke test blast radius (R.G3)

1. Su un TSK con `review_status: pending` + `compression.context.enabled: true`:
2. Verifica che `code-reviewer` invochi `graphify get_impact_radius` come pre-check
3. Verifica che il `task_package` per il dev-agent includa `blast_radius_warning` list

## Trade-off documentati

| Pro | Contro |
|---|---|
| Riduzione 10-70× context tokens per dev-agent | Costo primo build 2-20$ (full rebuild) |
| Blast radius pre-check riduce regression risk | Drift asincrono AST↔semantica (mitigato R.G4) |
| Composabilità con Fase 1 (output + context multiplicative) | Aggiunge un nuovo sync adapter da debuggare |
| Confidence gating riduce rischio modifiche su `INFERRED` | Ghost duplicates bug noto Graphify (mitigato `ghost_duplicates_warn`) |
| Cache-with-fallback in CI azzera costo recurring | Setup iniziale richiede install + API key |
| Backward compat tot. (R.G6) | Single-maintainer rischio (mitigato design provider-agnostic) |

## Rollback

Per disattivare context compression mantenendo Fase 1 (output) attivo:

```bash
/compression set context.enabled false
```

Effetto immediato: i dev-agent tornano a scansione filesystem standard (comportamento
v2.14 Fase 1). Side-channel `.graphify-state/` resta sul disco ma non viene letto.
Per **rimuovere completamente** la side-channel: `rm -rf .graphify-state/` (sempre
sicuro, rebuildable da `<code_path>`).

Per disattivare entrambi gli assi (output + context):

```bash
/compression set enabled false             # Fase 1 (Caveman)
/compression set context.enabled false     # Fase 2 (Graphify)
```

La factory torna al comportamento v2.13.

## Roadmap post-Fase 2

Vedi [[factory-compression-layer]] §Roadmap:
- **v2.14 Fase 1**: Output Compression Layer (Caveman) ✓
- **v2.14 Fase 1.5**: validation empirica (setup ready, run pending)
- **v2.14 Fase 2 (corrente)**: Context Compression Layer base (Graphify code_path) ✓
- **v2.15 Fase 3a**: Karpathy preservation PoC (gate obbligatorio per Fase 3b)
- **v2.15 Fase 3b**: Wiki-as-graph (subordinata a PoC pass su 4 check non-negoziabili)

## Riferimenti

- Design doc: [[factory-compression-layer]] (concept, status: approved + Aggiornamento Fase 2)
- Concept: [[graphify]], [[knowledge-graph-codebase]], [[token-compression]], [[caveman]]
- Synthesis: [[token-reduction-tools]] (comparativa Caveman vs Graphify)
- Pattern: PATTERN.md §16 (sync adapters esteso), §20.10 (Context Compression), §20.11 (R.G1-R.G6), §21
- Skill: `.claude/skills/graphify-extraction-protocol.md`, `.claude/skills/parallel-scheduling.md`
- Agent: `.claude/agents/graphify-sync.md`, `.claude/agents/code-reviewer.md`
- Comando: `.claude/commands/graphify-sync.md`, `.claude/commands/compression.md`
- Runbook: [[migration-v214]] (Fase 1), [[compression-validation-template]] (Fase 1.5)
