---
id: graphify-installation
type: runbook
title: "Installazione Graphify (v2.14 Fase 2 + Fase 3a)"
status: draft
created: 2026-05-28
updated: 2026-06-25
sources:
  - "wiki/concepts/factory-compression-layer.md (design doc)"
  - "PATTERN.md §20.10 (Context Compression Layer)"
  - "factory.config.yaml (compression.context.install_command)"
  - "graphifyy v0.8.22 PyPI (https://pypi.org/project/graphifyy/)"
  - "GitHub safishamsi/graphify"
related:
  - factory-compression-layer
  - graphify
  - knowledge-graph-codebase
  - migration-v214-fase2
  - wiki-as-graph-poc-template
tags: [runbook, installazione, graphify, v2-14, fase-2, fase-3a, setup]
pattern_section: "§16"
---

# Installazione Graphify

> Procedura operativa per installare [[graphify]] sulla macchina di sviluppo (o
> CI) prima di attivare la **Fase 2** del Compression Layer
> ([[factory-compression-layer]]) o eseguire il **PoC Fase 3a**
> ([[wiki-as-graph-poc-template]]).
>
> Confermato 2026-05-28: il pacchetto PyPI esiste (versione 0.8.22, MIT, autore
> Safi Shamsi, repo `safishamsi/graphify` su GitHub).

## Reality check sui pacchetti (verifica 2026-05-28)

| Variante | Sorgente | Stato | Linguaggi supportati |
|---|---|---|---|
| **Python** | PyPI `graphifyy` (doppia y) → binario `graphify` (singola y) | ✅ ESISTE v0.8.22, MIT | 30+ via tree-sitter (Python, JS, TS, Go, Rust, Java, C/C++, C#, Ruby, Swift, Kotlin, Scala, PHP, Lua, Julia, Elixir, Bash, Fortran, Groovy, Objective-C, PowerShell, Verilog, Zig, JSON, DM) |
| **TypeScript** | npm `graphify-ts` | ✅ ESISTE (404 alternative confermato) | 12 via tree-sitter WASM |

**Nota importante**: il nome del pacchetto su PyPI è `graphifyy` (doppia y) ma il binario installato è `graphify` (singola y). Mismatch documentato nei deep dive originali. Useremo nel framework:
- **Install command**: `pip install graphifyy`
- **Comandi CLI**: `graphify <subcommand>`

## Prerequisiti

- Python 3.10+ (verificato: `python3 --version`)
- pip 20+ (verificato: `pip3 --version`)
- ~500 MB di disco per le 30+ tree-sitter grammars
- Connessione internet per il pip download
- Per uso runtime con pass semantico: API key di un provider LLM (Anthropic, OpenAI, …) o Ollama locale (16+ GB VRAM)

## Procedura standard

### Step 1 — Install

```bash
pip3 install graphifyy
```

Cosa scarica (verificato 2026-05-28 v0.8.22):
- `graphifyy` core (modulo Python `graphify`)
- 68 dependency: `tree-sitter` + 30 grammars (`tree-sitter-python`, `tree-sitter-typescript`, etc.), `networkx`, `datasketch`, `rapidfuzz`, `scipy`, `numpy`
- Tempo download: ~30-60s su connessione 10 MB/s
- Footprint disco totale: ~500-800 MB

### Step 2 — Verifica installazione

```bash
which graphify
# Atteso: /Library/Frameworks/Python.framework/Versions/3.13/bin/graphify
# (o equivalente in altri Python env)

graphify --version
# Atteso: graphify 0.8.22 (o superiore)

graphify --help
# Atteso: lista completa di sub-comandi (path, explain, query, update, ...)
```

Se `which graphify` non trova nulla, il binario può essere in `~/.local/bin/`,
`/opt/homebrew/Caskroom/miniconda/base/bin/`, o simile in base al Python env.
Aggiungi al PATH:

```bash
# bash/zsh
export PATH="$(python3 -m site --user-base)/bin:$PATH"
```

### Step 3 — Sub-comandi rilevanti per il framework

Dopo install, i comandi che il framework `graphify-sync` adapter usa (PATTERN §16
+ §20.10):

| Comando CLI | Uso nel framework | Skill che lo invoca |
|---|---|---|
| `graphify update <path>` | Re-extract code files (AST update, no LLM) — incremental | `graphify-extraction-protocol §Fase 3` |
| `graphify update <path> --force` | Full rebuild (incluso LLM semantic pass) | `/graphify-sync <target> --force` |
| `graphify query "<question>"` | BFS traversal del graph per Q&A | Esposto via `wiki-query` in Fase 3b (gated) |
| `graphify affected "X"` | Reverse traversal — **equivalente al `get_impact_radius` del design doc** | `code-reviewer` per blast radius pre-check (R.G3) |
| `graphify path "A" "B"` | Shortest path tra due nodi | Future use cases |
| `graphify explain "X"` | Plain-language explanation di un nodo + vicini | Future use cases |
| `graphify diagnose multigraph` | Ghost duplicates / edge collapse risk | `graphify-extraction-protocol §Fase 4` (post-rebuild check) |
| `graphify watch <path>` | Watch folder + rebuild on changes | Opzionale, alternativa a post-commit hook |
| `graphify hook install` | Post-commit/post-checkout git hooks | Opzionale: integrazione VCS auto-update |
| `graphify merge-graphs <g1> <g2>` | Merge cross-repo graph | Future use cases per multi-repo v2.12 |

**Nota terminologica**: nel design doc abbiamo usato `get_impact_radius(file)` come
nome concettuale del check di blast radius. Nel CLI reale il sub-comando equivalente
è **`graphify affected "X"`** (reverse traversal). Le skill del framework usano il
nome `get_impact_radius` come metafora; chi invoca il CLI fa `graphify affected
<file>`.

### Step 4 — Output canonical

Graphify scrive di default in `graphify-out/` nella cwd:
- `graphify-out/graph.json` — graph machine-readable
- `graphify-out/GRAPH_REPORT.md` — report umano-leggibile (god nodes, surprising connections, …)
- `graphify-out/graph.html` — visualizzazione browser
- `graphify-out/memory/` — Q&A history (per il loop `save-result` → graph feedback)

**Mapping al framework** (PATTERN §16 + R.G5):
Il nostro adapter `graphify-sync` deve **ridireginare** l'output di Graphify dal
default `graphify-out/` al side-channel `.graphify-state/code_paths/<slug>/` per
conformarsi all'invariante di scope di scrittura. Vedi
`graphify-extraction-protocol §Fase 3-4` per la procedura.

In modalità "raw Graphify" (debug, fuori dal framework adapter) puoi anche usare
il default `graphify-out/` — ma quel path **non** è quello standardizzato dal
framework v2.14.

## Configurazione provider LLM

Per il pass semantico (estrazione concept/relazioni da docs/markdown/immagini),
Graphify richiede un provider LLM.

### Opzione A — Cloud (raccomandato, qualità superiore)

Setta una delle seguenti env var (mai committare):

```bash
# Anthropic (raccomandato per coerenza con Claude Code)
export ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI (alternativa)
export OPENAI_API_KEY="sk-..."
```

`factory.config.yaml.compression.context.provider: graphify-cloud`.

### Opzione B — Ollama locale (data residency enterprise)

```bash
# Install Ollama
brew install ollama   # macOS
# (Linux: https://ollama.com/install.sh)

# Pull model (richiede 16+ GB VRAM per llama3.1:8b)
ollama pull llama3.1:8b

# Avvia server
ollama serve
```

`factory.config.yaml.compression.context.provider: graphify-ollama`.

Trade-off: privacy completa (zero leak verso API) ma qualità del pass semantico
inferiore + richiede hardware con GPU sufficiente.

## Primo run (smoke test)

Dopo install + provider configurato, esegui un test minimal su un repo piccolo:

```bash
# Crea una directory di test
mkdir -p /tmp/graphify-test && cd /tmp/graphify-test
cat > hello.py << 'EOF'
def greet(name: str) -> str:
    """Saluta un utente."""
    return f"Hello, {name}!"

def main():
    print(greet("World"))

if __name__ == "__main__":
    main()
EOF

# Build graph (incremental se primo run = full)
graphify update .

# Verifica output
ls graphify-out/
# Atteso: graph.json, GRAPH_REPORT.md, graph.html

# Inspect graph
cat graphify-out/GRAPH_REPORT.md | head -30

# Query
graphify query "Cosa fa la funzione greet?"

# Cleanup
cd / && rm -rf /tmp/graphify-test
```

Se tutti gli step ritornano senza errori, l'install è funzionante.

## Integrazione col framework

Dopo l'install verificata, il framework v2.14 Fase 2 è abilitato a:

1. **Eseguire la Fase 2 reale** ([[migration-v214-fase2]]):
   ```bash
   /compression set context.provider graphify-cloud
   /compression set context.enabled true
   # Definisci target in factory.config.yaml.compression.context.targets
   /graphify-sync <target>
   ```

2. **Eseguire il PoC Fase 3a** ([[wiki-as-graph-poc-template]]):
   ```bash
   # Copia il sub-corpus delle 20 pagine in /tmp/wiki-as-graph-poc/sub-corpus/
   graphify update /tmp/wiki-as-graph-poc/sub-corpus/
   # Eseguire i 4 check sul graph prodotto in /tmp/wiki-as-graph-poc/graphify-out/
   ```

3. **Eseguire la Fase 1.5** ([[compression-validation-template]]) — Caveman è prerequisito separato (`curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash`).

## Aggiornamenti e mantenimento

```bash
# Aggiornare graphifyy
pip3 install --upgrade graphifyy

# Verificare versione installata
graphify --version

# Reinstall pulito (raro)
pip3 uninstall graphifyy
pip3 install graphifyy
```

Per la rimozione completa (incluso `graphify-out/` accumulato durante l'uso):

```bash
graphify uninstall --purge
pip3 uninstall graphifyy
```

## Hook git auto-update (opzionale ma raccomandato)

Per mantenere il graph aggiornato su ogni commit (R.G4 drift mitigation):

```bash
cd <factory-repo>
graphify hook install
# Installa post-commit + post-checkout hooks
# che richiamano `graphify update .` automaticamente

graphify hook status   # verifica
graphify hook uninstall # rimuove
```

I hook chiamano `graphify update <repo-root>` che è zero-token (AST only, no LLM)
e prende ~0.4s/1k file.

**Nota**: questi hook sono separati dai nostri agent `graphify-sync` del framework.
Sono complementari: il hook git mantiene fresh il graph "raw" Graphify in
`graphify-out/`, mentre il nostro `graphify-sync` produce anche il summary
`raw/<data>-graph-<slug>.md` + manifest entry secondo il contratto del framework.

## CI integration

Per CI (PATTERN §20.10.4 ci_strategy `cache-with-fallback`):

```yaml
# .github/workflows/ci.yml — example
- name: Cache graphify state
  uses: actions/cache@v4
  with:
    path: .graphify-state
    key: graphify-state-${{ hashFiles('src/**', 'docs/**') }}
    restore-keys: |
      graphify-state-

- name: Install graphifyy (if cache miss)
  if: steps.cache.outputs.cache-hit != 'true'
  run: pip install graphifyy

- name: Incremental update (zero token if cache hit)
  run: graphify update . || echo "Fallback: filesystem scan"
```

In assenza di cache valida, il CI usa fallback filesystem scan (comportamento
v2.14 Fase 2 pre-Graphify).

## Troubleshooting

### `graphify` non trovato dopo install

- Verifica PATH: `python3 -m site --user-base`/bin deve essere nel PATH
- Se installato in virtual env: assicurati che l'env sia activated
- Su macOS con Python.framework: il binario è in `/Library/Frameworks/Python.framework/Versions/<v>/bin/`

### Errore `import` con `tree-sitter`

```bash
pip3 install --force-reinstall --no-cache-dir tree-sitter
# Poi reinstall graphifyy
pip3 install --force-reinstall graphifyy
```

### Full rebuild fallisce con cost elevato

```bash
# Verifica scope corretto:
graphify update <code_path> --no-cluster   # skip semantic pass per debug
# Se OK → problema è nel pass semantico (API key, rate limit, modello)
```

### Ghost duplicates count elevato

```bash
graphify diagnose multigraph --json --max-examples 10
# Output JSON con node ID duplicati e count
# Workaround: full rebuild → graphify update <path> --force
```

## Verifica nel meta-framework (questo repo)

L'installazione che hai appena fatto è **system-wide** (Python user packages). NON
viene committata nel repo: i pacchetti Python non sono parte di
`soli-multi-agents-factory`. Quello che committiamo è la **documentazione + adapter
markdown + config schema** che fanno riferimento al CLI installato.

Per testare che il framework adapter funziona:

```bash
# In una factory derivata v2.14 Fase 2:
/compression show
# Atteso: context.provider non valorizzato, enabled=false (config-only)

/compression set context.provider graphify-cloud
/compression set context.enabled true

# Configura target in factory.config.yaml (manualmente per ora):
# compression.context.targets:
#   - kind: code_path
#     name: backend  # o nome del code_path reale
#     gitignore_patterns: ["*.env", "secrets/**"]

# Esegui il primo `graphify-sync`:
/graphify-sync backend
# Atteso: il sub-agent graphify-sync esegue 5 fasi, produce
#   raw/<data>-graph-backend.md + .graphify-state/code_paths/backend/{graph.json, GRAPH_REPORT.md}
```

## Riferimenti

- Pacchetto: PyPI [graphifyy](https://pypi.org/project/graphifyy/) v0.8.22 (2026-05-28)
- Sorgente: GitHub [safishamsi/graphify](https://github.com/safishamsi/graphify)
- Design doc: [[factory-compression-layer]] §Fase 2 + §Fase 3a
- Concept: [[graphify]], [[knowledge-graph-codebase]]
- Runbook correlati: [[migration-v214-fase2]] (procedura adozione), [[wiki-as-graph-poc-template]] (PoC Fase 3a)
- Skill: `.claude/skills/graphify-extraction-protocol.md` (5 fasi del framework adapter)
- Agent: `.claude/agents/graphify-sync.md`
- Comando: `.claude/commands/graphify-sync.md`

## Graphify come Sync Adapter §16 (aggiunto 2026-06-25)

> Sezione aggiunta per allineamento §16 PATTERN v2.21 (semantic drift fix, score 0.71 → target 0.85).
> Il corpo della pagina documenta l'installazione CLI di `graphifyy` e i comandi operativi. Questa
> sezione contestualizza Graphify nel framework contrattuale dei sync adapters §16 di PATTERN.md.

### Posizione nel framework §16 — Fase 2 (v2.14)

§16 definisce la famiglia di *sub-agent Sync* come i soli agenti autorizzati a scrivere in `raw/`
(§7 r.1). Graphify è il quarto adapter della famiglia, introdotto in v2.14 come "Fase 2":

| Sub-agent | Sorgente | Output L1 primario | Versione |
|---|---|---|---|
| `sync-docs` | PDF in `raw/` | `raw/*.txt`, `raw/images/*-fig-NN.md` | v2.0 |
| `figma-sync` | URL/file_key Figma | `raw/YYYY-MM-DD-figma-<key>.kb.json` | v2.9 |
| `repo-sync` | path repo locale | `raw/YYYY-MM-DD-repo-<slug>.md` | v2.12 |
| **`graphify-sync`** | **`code_path` da `factory.config.yaml`** | **`raw/YYYY-MM-DD-graph-<slug>.md`** | **v2.14 Fase 2** |

La specialità di Graphify rispetto agli altri tre adapter è la **sorgente graph-based**: invece di
estrarre testo da documenti o struttura da repository, costruisce un grafo semantico del codice
(nodi = file/funzioni/classi; archi = dipendenze, chiamate, ereditarietà) usando tree-sitter (AST)
+ un pass LLM per concetti e relazioni ad alto livello.

### Garanzia read-only verso `code_path` (§7 r.17)

Come tutti i sub-agent Sync, `graphify-sync` opera in **modalità read-only** sul path sorgente
analizzato (estensione di §7 r.17 a code_path scanning). Il `<code_path>` scansionato non viene
mai modificato dall'adapter. I comandi CLI `graphify update <path>` e `graphify update <path> --force`
leggono il codice sorgente e scrivono solo in output destinati al framework:

- `raw/YYYY-MM-DD-graph-<slug>.md` — output L1 standard, dentro la factory
- `.graphify-state/code_paths/<slug>/` — side-channel, dentro la factory (mai nel `<code_path>`)

### Architettura a due output paralleli (side-channel)

A differenza degli altri tre adapter (che producono un solo file in `raw/`), `graphify-sync`
produce **due output paralleli**:

1. **`raw/YYYY-MM-DD-graph-<slug>.md`** — riepilogo umano-leggibile (god nodes, surprising
   connections, confidence breakdown `EXTRACTED`/`INFERRED`/`AMBIGUOUS`). Ingestito da
   `wiki-keeper` come documento L1→L2 standard, analogo a `raw/*-repo-*.md` di `repo-sync`.

2. **`.graphify-state/code_paths/<slug>/`** — side-channel storage (analogia: `code_quality/`
   per CQRL). Contiene `graph.json` (machine-readable), `GRAPH_REPORT.md`, `last_full_rebuild.txt`.
   Non versionato in git (`.gitignore`-d). **Non fa parte del cascade L1→L5**: è una vista derivata
   consumata a runtime dai dev-agent e dal `code-reviewer` come **context replacement** dei file
   sorgente raw (§20.10 Context Compression).

Caratteristiche del side-channel (§16 §Side-channel storage):
- **Rebuildable**: full rebuild ricostruisce tutto da zero da `<code_path>` (zero perdita di stato).
- **Scritto solo da `graphify-sync`** (scope di scrittura chiuso, analogo a R.Q2 di CQRL).
- **Letto da molti**: dev-agent, code-reviewer, wiki-query (sperimentale v2.15).
- **Filesystem is source of truth**: il graph è una view derivata. In caso di conflitto
  graph ↔ filesystem, vince il filesystem.

### Il comando `/graphify-sync` — quando invocarlo

```bash
# Primo build (o rebuild forzato — include pass LLM semantico, costo 2-20 $ token):
/graphify-sync <target> --force

# Aggiornamento incrementale (AST only, zero token, ~0.4s/1k file):
/graphify-sync <target>
```

Il trigger raccomandato in §16:
- **Manuale**: `/graphify-sync <target>` dopo modifiche significative al codice sorgente.
- **Automatico** (opt-in): `graphify hook install` installa post-commit/post-checkout git hooks
  che chiamano `graphify update <path>` per mantenere il graph AST aggiornato.
- **Dev-agent context-compression**: invocato automaticamente dai dev-agent quando
  `compression.context.enabled: true` in `factory.config.yaml` (§20.10).

`<target>` è il campo `name` di un'entry in `compression.context.targets` (che
referenzia a sua volta un entry di `code_paths`).

### Confronto con gli altri tre adapter

| Dimensione | `sync-docs` | `figma-sync` | `repo-sync` | `graphify-sync` |
|---|---|---|---|---|
| **Tipo sorgente** | Documento (PDF) | Design file (Figma) | Codebase (repo locale) | Codebase (code_path) |
| **Output primario** | Testo estratto `.txt` | Knowledge blob `.kb.json` | Specifiche `.md` | Summary graph `.md` |
| **Side-channel** | No | No | No | Sì (`.graphify-state/`) |
| **Pass LLM nel sync** | Sì (estrazione testo) | Sì (layout→semantica) | Sì (stack detection) | Sì (semantic pass, opt-in) |
| **Costo token** | Basso (OCR/parse) | Medio (frame analysis) | Basso (struttura) | Alto primo run, poi zero (AST) |
| **Consumo downstream** | `wiki-keeper` L1→L2 | `wiki-keeper` L1→L2 | `wiki-keeper` L1→L2 | `wiki-keeper` L1→L2 **+ dev-agent context** |
| **Read-only verso sorgente** | N/A (PDF in `raw/`) | Sì (API Figma) | Sì (§7 r.17) | Sì (§7 r.17 esteso) |

La differenza qualitativa chiave di Graphify: è l'unico adapter il cui output viene **consumato
direttamente a runtime dai dev-agent** (come sostituto del contesto file sorgente) oltre che da
`wiki-keeper` per la wiki. Gli altri tre adapter alimentano solo la wiki e da lì indirettamente
il piano operativo (EP→US→TSK). Graphify chiude il loop anche su L5.
