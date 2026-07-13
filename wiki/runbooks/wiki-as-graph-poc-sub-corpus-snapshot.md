---
id: wiki-as-graph-poc-sub-corpus-snapshot
type: runbook
title: "Wiki-as-Graph PoC — Sub-corpus snapshot + baseline metriche"
status: draft
created: 2026-05-28
updated: 2026-05-28
sources:
  - "wiki/concepts/factory-compression-layer.md (design doc §Fase 3a)"
  - "wiki/runbooks/wiki-as-graph-poc-template.md (procedura)"
related:
  - factory-compression-layer
  - wiki-as-graph-poc-template
  - graphify
tags: [runbook, poc, fase-3a, sub-corpus, baseline, snapshot, 2026-05-28]
---

# Wiki-as-Graph PoC — Sub-corpus snapshot

> Snapshot delle 20 pagine selezionate per il PoC karpathy preservation (Fase 3a) +
> baseline metriche misurate il 2026-05-28. Riferimento per [[wiki-as-graph-poc-template]]:
> i target dei 4 check sono questi numeri.

## Criteri di selezione

Il sub-corpus mira a **stress-testare i 4 check** del PoC con una distribuzione
strategica delle 20 pagine richieste dalla roadmap (10 concept + 5 entity + 3 synthesis
+ 1 source + 1 runbook):

| Criterio | Strategia | Pagine target |
|---|---|---|
| **Citation density** (Check 1) | High-cit pages includono pattern di citazione complessi | `framework-v28-articolo` (58 cit), `code-quality-review-layer` (15), `knowledge-graph-codebase` (14), `parallel-scheduler` (13), `agentic-workflow-patterns` (14) |
| **Wikilink density** (Check 2) | High-wikilink pages includono pattern di risoluzione cross-namespace | `factory-compression-layer` (43 link), `agentic-workflow-patterns` (28), `token-reduction-tools` (15), `anthropic` (14), `parallel-scheduler` (14) |
| **Frontmatter ricchezza** (Check 3) | Pages con campi opzionali (related/aliases/tags ricchi) | `graphify`/`caveman`/`andrej-karpathy`/`anthropic`/`julius-brussee` (11 ff ciascuna) |
| **Namespace coverage** (Check 4) | Distribuzione 5/5 namespace richiesta | concepts(10) + entities(5) + syntheses(3) + sources(1) + runbooks(1) = 20 |
| **Edge case: low-density** | Includere pagine "minimali" per testare boundary | `julius-brussee` (44 lines), `andrej-karpathy` (32 lines), `2026-05-28-caveman-deep-dive` (43 lines) |
| **Edge case: long-form** | Includere pagine con sezioni multiple | `factory-compression-layer` (583 lines), `framework-v28-articolo` (474), `parallel-scheduler` (268), `migration-v214` (269) |
| **Recency variety** | Mix di pagine recenti e stabilizzate | recenti (2026-05-28): caveman/graphify/julius-brussee/factory-compression-layer; stabili (pre-2026-05-22): orchestrator-workers, evaluator-optimizer, anthropic |

## Sub-corpus selezionato (20 pagine)

### Concepts (10/40 nel corpus)

| # | Path | Citation | Wikilink | Frontmatter fields | Lines |
|---|---|---:|---:|---:|---:|
| 1 | `concepts/factory-compression-layer.md` | 11 | 43 | 6 | 583 |
| 2 | `concepts/code-quality-review-layer.md` | 15 | 11 | 6 | 156 |
| 3 | `concepts/parallel-scheduler.md` | 13 | 14 | 9 | 268 |
| 4 | `concepts/knowledge-graph-codebase.md` | 14 | 7 | 9 | 87 |
| 5 | `concepts/publisher-adapters.md` | 12 | 12 | 9 | 243 |
| 6 | `concepts/sync-adapters.md` | 9 | 12 | 9 | 139 |
| 7 | `concepts/multi-adapter-scaffolding.md` | 9 | 10 | 6 | 126 |
| 8 | `concepts/token-compression.md` | 5 | 9 | 9 | 69 |
| 9 | `concepts/orchestrator-workers.md` | 7 | 4 | 10 | 58 |
| 10 | `concepts/evaluator-optimizer.md` | 6 | 2 | 10 | 55 |

### Entities (5/11 nel corpus)

| # | Path | Citation | Wikilink | Frontmatter fields | Lines |
|---|---|---:|---:|---:|---:|
| 11 | `entities/graphify.md` | 12 | 1 | 11 | 109 |
| 12 | `entities/caveman.md` | 8 | 3 | 11 | 88 |
| 13 | `entities/andrej-karpathy.md` | 3 | 6 | 11 | 32 |
| 14 | `entities/anthropic.md` | 6 | 14 | 11 | 50 |
| 15 | `entities/julius-brussee.md` | 4 | 1 | 11 | 44 |

### Syntheses (3/9 nel corpus)

| # | Path | Citation | Wikilink | Frontmatter fields | Lines |
|---|---|---:|---:|---:|---:|
| 16 | `syntheses/framework-v28-articolo.md` | 58 | 7 | 9 | 474 |
| 17 | `syntheses/agentic-workflow-patterns.md` | 14 | 28 | 10 | 100 |
| 18 | `syntheses/token-reduction-tools.md` | 8 | 15 | 10 | 124 |

### Sources (1/10 nel corpus)

| # | Path | Citation | Wikilink | Frontmatter fields | Lines |
|---|---|---:|---:|---:|---:|
| 19 | `sources/2026-05-28-caveman-deep-dive.md` | 4 | 5 | 8 | 43 |

### Runbooks (1/17 nel corpus)

| # | Path | Citation | Wikilink | Frontmatter fields | Lines |
|---|---|---:|---:|---:|---:|
| 20 | `runbooks/migration-v214.md` | 0 | 11 | 9 | 269 |

## Baseline aggregato (target per i 4 check)

| Metrica | Valore | Note |
|---|---:|---|
| **Pagine totali** | 20 | distribuzione 10/5/3/1/1 |
| **Lines totali** | 3117 | range per-page: 32 – 583 |
| **Citation `[^src:]` totali** | **218** | target Check 1: 218/218 = 100% |
| **Wikilink `[[name]]` totali** | **215** | target Check 2: 215/215 = 100% |
| **Wikilink unique target** | **57** | risoluzioni distinte da raggiungere |
| **Namespace distinti** | **5** | sources, concepts, entities, syntheses, runbooks; target Check 4: 5 distinguibili |
| **Frontmatter fields min (type, status)** | 20/20 | target Check 3: 100% obbligatori |
| **Frontmatter fields aggregati** | 169 | media 8.45 ff/pagina |

## Distribuzione campi frontmatter (per Check 3)

Campi presenti in tutte/quasi-tutte le pagine (≥ 95%):
- `type:` (20/20, 100%)
- `status:` (20/20, 100%)
- `sources:` (20/20, 100% — campo §5 obbligatorio per wiki page)
- `created:` (20/20, 100%)
- `updated:` (20/20, 100%)
- `tags:` (19/20, 95%)

Campi presenti in molte pagine ma non tutte:
- `id:` (16/20, 80% — alcune pages legacy senza id esplicito; § frontmatter dice "deducibile dal path")
- `title:` (16/20, 80%)
- `related:` (12/20, 60% — opzionale, denso nei pages più recenti)
- `aliases:` (3/20, 15% — solo alcuni entities)

Pages con frontmatter fields > 10:
- Entities (graphify, caveman, andrej-karpathy, anthropic, julius-brussee): 11 ff ciascuna — ricchi di `related`, `aliases`, `tags`
- Concepts recenti (orchestrator-workers, evaluator-optimizer): 10 ff
- Pages legacy con pattern v2.2: 6 ff (es. `factory-compression-layer` con 6 ff base)

## Profile di stress test per ciascun check

### Check 1 (Citation integrity, target 218)

Pages contribuenti maggiormente:
- `framework-v28-articolo` (58 cit): blog-style con citation interleaved
- `code-quality-review-layer` (15): citation a `raw/code_quality_review_layer.md` con `§<sezione>`
- `agentic-workflow-patterns` (14): citation cross-paper
- `knowledge-graph-codebase` (14): citation a `raw/graphify_deep_dive.md`
- `parallel-scheduler` (13)

Pattern di citation più complessi nel sub-corpus:
- `[^src: raw/code_quality_review_layer.md §Aggregator]` (path + section markdown)
- `[^src: raw/2026-05-28-figma-<file-key>.kb.json §screens[0].name]` (path JSON + dotted-path v2.9)
- `[^src: meta-prompt-llm-wiki-factory.md §0]` (path con sub-sezione numerata)

Edge case: `runbooks/migration-v214.md` ha 0 citation (i runbook spesso citano PATTERN.md generico, non con `[^src:]` formale). Questo verifica che Check 1 sia tollerante a pages con 0 citation (deve essere PASS, non FAIL).

### Check 2 (Wikilink resolution, target 215 occurrence / 57 unique)

Pages con maggiore densità di wikilink:
- `factory-compression-layer` (43 link, 583 lines): wikilink density elevata, include molti `[[X]]` cross-namespace
- `agentic-workflow-patterns` (28): wikilink a pattern concept frequenti
- `token-reduction-tools` (15)
- `anthropic` (14): wikilink a prodotti/MCP/altri concetti
- `parallel-scheduler` (14)

Pattern di wikilink più complessi:
- Cross-namespace: concepts/X.md → entities/Y, syntheses/Z (testato in factory-compression-layer)
- Self-namespace: concepts/X.md → concepts/Y (testato in molti)
- Broken-link risk: pages che citano `[[non-existent]]` per riferimento futuro → il check deve flaggare 0 broken nel sub-corpus, ma il graph deve esporre l'edge non risolto come `resolved: false`

### Check 3 (Frontmatter integrity)

Stress: pages con frontmatter più ricco (entities con 11 ff) sono i casi limite per
preservazione. Test che `aliases:` (lista YAML) sia preservato come array nel graph.

### Check 4 (Layering preservato)

Distribuzione attesa nel graph:
```
concepts:  10 nodi
entities:   5 nodi
syntheses:  3 nodi
sources:    1 nodo
runbooks:   1 nodo
```

Test: la query `nodes WHERE namespace == "entities"` deve ritornare esattamente le 5
pagine entity selezionate (no cross-contamination da concept/synthesis che parlano di
entity).

## Pagine NON incluse nel sub-corpus (per audit)

Sono escluse intenzionalmente:
- Tutti i `wiki/incidents/**` (namespace coperto a livello logico ma nessuna pagina
  selezionata; il PoC focalizza sulle 5 namespace principali)
- Pages molto stabili (es. `concepts/agent-agnostic.md`, `concepts/two-phase-commit.md`):
  meno discriminanti per il PoC, restano in corpus principale
- Pages molto recenti senza promote-history: `wiki-as-graph-poc-*` (questo runbook stesso),
  `compression-validation-template`
- Pages di workflow secondari: `framework-v22-articolo`, `patch-v26-soft-gate-state-propagation`
  (zero citation, scarsa rilevanza per stress test)

Se il PoC dà GO ma vuoi confermare su scala maggiore, ripeti su sub-corpus esteso a
40 pages (raddoppia il sample) prima di pianificare Fase 3b. Costo +50%, sicurezza
maggiore.

## Riproducibilità

Comandi per ri-calcolare il baseline (dovrebbero ritornare gli stessi numeri al
2026-05-28):

```bash
WIKI=/Users/simone.olivieri/Documents/Personal/Repos/soli-multi-agents-factory/wiki
PAGES=(
  concepts/factory-compression-layer.md
  concepts/code-quality-review-layer.md
  concepts/parallel-scheduler.md
  concepts/knowledge-graph-codebase.md
  concepts/publisher-adapters.md
  concepts/sync-adapters.md
  concepts/multi-adapter-scaffolding.md
  concepts/token-compression.md
  concepts/orchestrator-workers.md
  concepts/evaluator-optimizer.md
  entities/graphify.md
  entities/caveman.md
  entities/andrej-karpathy.md
  entities/anthropic.md
  entities/julius-brussee.md
  syntheses/framework-v28-articolo.md
  syntheses/agentic-workflow-patterns.md
  syntheses/token-reduction-tools.md
  sources/2026-05-28-caveman-deep-dive.md
  runbooks/migration-v214.md
)
TOTAL_CIT=0; TOTAL_LINK=0; TOTAL_LINES=0
for p in "${PAGES[@]}"; do
  c=$(grep -c '\[\^src:' "$WIKI/$p" 2>/dev/null)
  l=$(grep -ohE '\[\[[a-z0-9-]+\]\]' "$WIKI/$p" 2>/dev/null | wc -l | tr -d ' ')
  ln=$(wc -l < "$WIKI/$p" | tr -d ' ')
  TOTAL_CIT=$((TOTAL_CIT + c))
  TOTAL_LINK=$((TOTAL_LINK + l))
  TOTAL_LINES=$((TOTAL_LINES + ln))
done
echo "Citations: $TOTAL_CIT (target 218)"
echo "Wikilinks: $TOTAL_LINK (target 215)"
echo "Lines: $TOTAL_LINES (target 3117)"
echo "Unique wikilink targets: $(for p in "${PAGES[@]}"; do grep -ohE '\[\[[a-z0-9-]+\]\]' "$WIKI/$p" 2>/dev/null; done | sort -u | wc -l | tr -d ' ') (target 57)"
```

Se i numeri cambiano nel tempo (modifiche alle 20 pagine), aggiorna **questo snapshot**
prima di rieseguire il PoC: i target dei 4 check devono riflettere il sub-corpus
corrente.

## Riferimenti

- Procedura completa: [[wiki-as-graph-poc-template]] (6 step + 4 check + decision gate)
- Design doc: [[factory-compression-layer]] §Fase 3a (invariante non negoziabile)
- Pattern: PATTERN.md §6 (citation grammar), §10 (wiki maintenance)
- Concept correlati: [[graphify]], [[knowledge-graph-codebase]], [[citation-grounded]]
