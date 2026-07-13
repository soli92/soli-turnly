---
id: wiki-as-graph-poc-template
type: runbook
title: "Wiki-as-Graph Karpathy Preservation PoC (Fase 3a) — template"
status: draft
created: 2026-05-28
updated: 2026-05-28
sources:
  - "wiki/concepts/factory-compression-layer.md (design doc §Fase 3a)"
  - "PATTERN.md §10 (wiki maintenance), §6 (citation grammar)"
  - "wiki/runbooks/wiki-as-graph-poc-sub-corpus-snapshot.md (snapshot sub-corpus + baseline)"
related:
  - factory-compression-layer
  - knowledge-graph-codebase
  - graphify
  - llm-wiki-pattern
  - citation-grounded
  - wiki-as-graph-poc-sub-corpus-snapshot
tags: [runbook, poc, fase-3a, wiki-as-graph, karpathy-preservation, gate, template]
---

# Wiki-as-Graph Karpathy Preservation PoC — Template

> ⚠️ **Status v2.15 (2026-05-29)** — Gate riformulato come **opt-in deferred**, non
> bloccante per il consolidamento del PATTERN. Fase 3b (wiki-as-graph runtime)
> resta **non attivabile** in assenza di un run di questo PoC con esito GO (R.K1
> invariante karpathy preservato). La differenza rispetto a v2.14 è che il gate
> non blocca più la versione del framework: chiunque (derivatore della factory,
> utente con factory candidata) può eseguirlo quando ha capacità di misurazione
> dei 4 check, e proporne l'esito come input per v2.16+ (per attivare Fase 3b)
> o come conferma della scelta di scartare wiki-as-graph (per chiudere
> definitivamente). Vedi [[factory-compression-layer]] §«v2.15 consolidation».

> Runbook **template** per la Fase 3a del Compression Layer: PoC isolato che misura
> empiricamente la **preservazione del pattern karpathy** quando Graphify viene
> applicato al corpus `wiki/`. Da copiare in
> `wiki/runbooks/wiki-as-graph-poc-YYYY-MM-DD.md` per esecuzione, lasciando questo
> file come riferimento.
>
> **Invariante non negoziabile** (vedi [[factory-compression-layer]] §Fase 3a):
> se anche **uno solo** dei 4 check fallisce → Fase 3b (wiki-as-graph runtime)
> viene scartata. Il filesystem resta single source of truth (R.G1) e
> `wiki-query` continua a scansionare le pagine, non il graph. Questo invariante
> (R.K1) **non è alterato da v2.15**: il gate opt-in deferred sposta «*quando*»
> il check viene eseguito, non «*se*» è un requirement per attivare Fase 3b.

## Scopo del runbook

Eseguire un PoC controllato che applica Graphify a un **sub-corpus rappresentativo**
del wiki/ (20 pagine, vedi [[wiki-as-graph-poc-sub-corpus-snapshot]]) e verifica con
4 check automatici la preservazione di:

1. **Citation integrity** (218 citation `[^src:]` baseline → graph node con `path` + `section` intatti)
2. **Wikilink resolution** (215 occurrence / 57 unique target → graph edge risolto)
3. **Frontmatter integrity** (campi obbligatori `type`/`status` + frequenti `sources`/`related`/`tags`)
4. **Layering preservato** (5 namespace distinguibili: sources/concepts/entities/syntheses/runbooks)

Output: decisione **GO** (procedi Fase 3b) o **NO-GO** (scarta wiki-as-graph, mantieni
filesystem-only).

## Prerequisiti — Checklist

### Ambiente Graphify (Fase 2 v2.14 OK)

- [ ] Graphify installato: `graphifyy --version` o `graphify-ts --version` ritorna OK
- [ ] Variante in uso: ___ (`graphifyy` Python | `graphify-ts` TypeScript)
- [ ] Provider attivo: ___ (`graphify-cloud` | `graphify-ollama`)
- [ ] API key (se cloud) o Ollama runtime (se ollama) configurato

### Factory candidate

- [ ] Una factory derivata aggiornata a v2.14 Fase 2 (con `compression.context.targets`
      che include `kind: code_path` per `code_path` reale + capacità di estendere a
      `kind: wiki`)
- [ ] Working tree pulito; branch dedicato `poc/wiki-as-graph-3a-YYYY-MM-DD`
- [ ] Backup recente di `wiki/` (per ripristinare se necessario)

### Sub-corpus

- [ ] Sub-corpus snapshot disponibile: [[wiki-as-graph-poc-sub-corpus-snapshot]]
- [ ] Le 20 pagine del sub-corpus esistono nella factory candidate (se diversa dal meta-framework, copiarle)

### Telemetria

- [ ] `jq` installato per query su `graph.json`
- [ ] Editor JSON o Python notebook per ispezione interattiva (opzionale ma raccomandato)

## Procedura — 6 step

### Step 1 — Estrazione PoC sul sub-corpus

Esegui Graphify in modalità **PoC isolata** su una copia del sub-corpus:

```bash
mkdir -p /tmp/wiki-as-graph-poc/sub-corpus
# Copia le 20 pagine dal corpus (vedi snapshot per lista esatta)
WIKI=/Users/simone.olivieri/Documents/Personal/Repos/soli-multi-agents-factory/wiki
cp $WIKI/concepts/factory-compression-layer.md /tmp/wiki-as-graph-poc/sub-corpus/
cp $WIKI/concepts/code-quality-review-layer.md /tmp/wiki-as-graph-poc/sub-corpus/
# ... [tutte le 20 pagine dal snapshot]

# Estrai graph (full rebuild, una sola volta)
graphifyy /tmp/wiki-as-graph-poc/sub-corpus/ \
  --output=/tmp/wiki-as-graph-poc/.graphify-state/ \
  --report \
  --include-confidence-tags
```

Cattura output:
- `/tmp/wiki-as-graph-poc/.graphify-state/graph.json` — graph completo
- `/tmp/wiki-as-graph-poc/.graphify-state/GRAPH_REPORT.md` — report umano-leggibile

Stats attese (da baseline snapshot, per confronto):
- Files analizzati: 20
- Citation totali: 218
- Wikilink totali: 215 (57 unique target)
- Frontmatter fields obbligatori: type=20, status=20

Costo stimato: 0.05–0.50 $ token (sub-corpus piccolo, 3117 lines).

### Step 2 — Check 1: Citation integrity

**Obiettivo**: ogni `[^src: <path> §<section>]` nel sub-corpus deve essere
rappresentata nel graph con `path` e `section` intatti.

**Estrai baseline empirica**:
```bash
WIKI=/Users/simone.olivieri/Documents/Personal/Repos/soli-multi-agents-factory/wiki
for f in [sub-corpus 20 pagine]; do
  grep -ohE '\[\^src: [^]]+\]' "$f"
done | sort -u > /tmp/poc-citations-raw.txt
# Atteso: ~218 occurrence
wc -l /tmp/poc-citations-raw.txt
```

**Query graph**:
```bash
# Schema atteso (varia per provider Graphify):
#   nodes[].kind == "source_citation" OR
#   nodes[].kind == "comment" with type "#NOTE/#WHY/#HACK" OR
#   nodes[].metadata.citation == { path, section }
jq '.nodes[] | select(.kind == "source_citation" or .metadata.is_citation == true) | {path: .metadata.path, section: .metadata.section}' \
  /tmp/wiki-as-graph-poc/.graphify-state/graph.json > /tmp/poc-citations-graph.txt
```

**Confronto**:
```bash
diff <(sort /tmp/poc-citations-raw.txt) <(sort /tmp/poc-citations-graph.txt)
```

**Criterio PASS**:
- 100% delle citation preservate (218/218)
- `path` e `section` intatti (no normalization che cambi i valori)
- Zero false negative (citation persa = FAIL automatico)

Compila:
- Citation baseline: ___ / 218 atteso
- Citation in graph: ___
- Match: ___ %
- Verdict Check 1: **PASS** | **FAIL**

Se FAIL: documenta esempi di citation perse:
```
- "raw/example.md §Section" non trovata nel graph (presente in concepts/X.md riga Y)
```

### Step 3 — Check 2: Wikilink resolution

**Obiettivo**: ogni `[[name]]` nel sub-corpus deve avere un edge nel graph che risolve
alla pagina corretta.

**Estrai baseline empirica**:
```bash
for f in [sub-corpus]; do
  grep -ohE '\[\[[a-z0-9-]+\]\]' "$f" | sed 's/\[\[//;s/\]\]//'
done | sort | uniq -c | sort -rn > /tmp/poc-wikilinks-raw.txt
# Atteso: 215 totali, 57 unique target
wc -l /tmp/poc-wikilinks-raw.txt
awk '{s+=$1} END {print "total:", s}' /tmp/poc-wikilinks-raw.txt
```

**Query graph**:
```bash
# Edges di tipo wikilink che risolvono a un nodo target
jq '.edges[] | select(.kind == "wikilink") | {source: .source, target: .target, name: .metadata.name, resolved: .metadata.resolved}' \
  /tmp/wiki-as-graph-poc/.graphify-state/graph.json > /tmp/poc-wikilinks-graph.txt
```

**Verifica risoluzione**:
- Per ogni `[[name]]`, controlla che esista un edge con `target == <pagina-target-attesa>`
- Es. `[[caveman]]` in `factory-compression-layer.md` deve avere edge target = `entities/caveman`

**Criterio PASS**:
- 100% wikilink resolution corretta (215/215)
- 57/57 unique target raggiunti
- Zero broken links nel graph (edge `resolved: false`)

Compila:
- Wikilink baseline: ___ / 215 atteso
- Wikilink edge in graph: ___
- Broken links: ___
- Unique target raggiunti: ___ / 57
- Verdict Check 2: **PASS** | **FAIL**

Se FAIL: lista broken links:
```
- [[ralph]] in syntheses/agentic-workflow-patterns.md non risolto nel graph
```

### Step 4 — Check 3: Frontmatter integrity

**Obiettivo**: per ogni pagina nel graph, il frontmatter YAML originale deve essere
preservato (modulo ordine campi e whitespace).

**Estrai baseline**:
```bash
for f in [sub-corpus]; do
  awk '/^---$/{c++; next} c==1' "$f" > /tmp/poc-frontmatter-raw/$(basename "$f").yaml
done
```

**Query graph**:
```bash
# Estrai frontmatter ricostruito dal graph per ogni pagina
jq '.nodes[] | select(.kind == "page") | {path: .metadata.path, frontmatter: .metadata.frontmatter}' \
  /tmp/wiki-as-graph-poc/.graphify-state/graph.json > /tmp/poc-frontmatter-graph.json
```

**Confronto semantico** (modulo whitespace + ordine campi YAML):
```bash
for f in [sub-corpus]; do
  baseline=/tmp/poc-frontmatter-raw/$(basename "$f").yaml
  from_graph=$(jq -r ".frontmatter // {} | to_entries | sort_by(.key) | from_entries" \
    /tmp/poc-frontmatter-graph.json --arg path "$(basename "$f")")
  diff <(yq -P 'sort_keys(..)' "$baseline") <(echo "$from_graph" | yq -P 'sort_keys(..)')
done > /tmp/poc-frontmatter-diff.txt
```

**Criterio PASS**:
- 100% delle pagine ha campi obbligatori `type` + `status` preservati
- ≥ 95% delle pagine ha campi frequenti `sources`/`related`/`tags`/`id`/`title`/`created`/`updated` preservati
- Tolleranza: campi `aliases` (rari) possono mancare per il PoC

Compila:
- Pagine con frontmatter intact (type+status): ___ / 20
- Pagine con frontmatter completo (incl. sources/related/tags): ___ / 20
- Verdict Check 3: **PASS** | **FAIL**

### Step 5 — Check 4: Layering preservato

**Obiettivo**: il graph deve esporre i 5 namespace distinguibili (sources/concepts/
entities/syntheses/runbooks); le 20 pagine devono essere assegnate al loro namespace
corretto.

**Query graph**:
```bash
jq '.nodes[] | select(.kind == "page") | .metadata.namespace' \
  /tmp/wiki-as-graph-poc/.graphify-state/graph.json | sort | uniq -c
```

**Atteso**:
```
  10 concepts
   5 entities
   3 syntheses
   1 sources
   1 runbooks
```

**Criterio PASS**:
- Esattamente 5 namespace distinti emergono dal graph
- Distribuzione: 10/5/3/1/1 esatta (no cross-namespace contamination)
- Ogni pagina del sub-corpus è assegnata al namespace corretto in base al path
  originale (concepts/X.md → namespace `concepts`)

Compila:
- Namespace rilevati: ___
- Distribuzione: ___
- Pagine misclassificate: ___ / 20
- Verdict Check 4: **PASS** | **FAIL**

### Step 6 — Decision gate

Compila la matrice di decisione:

| Check | Risultato | Target | OK? |
|---|---|---|---|
| 1. Citation integrity | ___ / 218 (___ %) | 100% (218/218) | ☐ |
| 2. Wikilink resolution | ___ / 215 (___ %), broken=___ | 100% (215/215, 0 broken) | ☐ |
| 3. Frontmatter integrity (type+status) | ___ / 20 | 100% obbligatori | ☐ |
| 3. Frontmatter integrity (frequenti) | ___ / 20 | ≥ 95% | ☐ |
| 4. Layering preservato (namespace count) | ___ / 5 | esattamente 5 | ☐ |
| 4. Layering preservato (distribuzione) | ___ | 10/5/3/1/1 | ☐ |

**Decisione**:

- **TUTTI i 4 check PASS** → ✅ **GO Fase 3b**.
  - Aggiorna design doc [[factory-compression-layer]] §Fase 3a con risultati + decisione GO.
  - Apri pianificazione Fase 3b (wiki come `target.kind: wiki` in
    `compression.context.targets`, aggiornamenti a `wiki-keeper` e `wiki-query`,
    Karpathy invariant monitoring daily).

- **Anche uno solo FAIL** → ❌ **NO-GO Fase 3b** (decisione non negoziabile per invariante).
  - Documenta il fail mode esatto in `wiki/runbooks/wiki-as-graph-poc-YYYY-MM-DD.md`
    (sezione `## Risultati` + sezione `## Fail mode`).
  - Aggiorna design doc [[factory-compression-layer]] §Fase 3a con NO-GO + rationale.
  - **Fase 3b viene scartata** dalla roadmap. `wiki-query` continua a scansionare
    le pagine. Filesystem resta authoritative (R.G1).
  - Apri post-mortem in `wiki/incidents/YYYY-MM-DD-wiki-as-graph-poc-no-go.md` se i
    fail sono sistemici (es. citation grammar non parsata = problema di Graphify per
    domini markdown-heavy).

Compila qui:

```
DECISIONE FINALE: ___ (GO Fase 3b | NO-GO Fase 3b)
RATIONALE:
___
PATH FORWARD:
___
```

## Reporting (post-decision)

1. **Compila questo runbook** rinominato `wiki-as-graph-poc-YYYY-MM-DD.md`
   con tutti i valori misurati + decisione.

2. **Aggiorna design doc** [[factory-compression-layer]] §Fase 3a non-distruttivamente
   (PATTERN §7 r.7):

   ```markdown
   ## Aggiornamenti (vYYYY-MM-DD)

   ### Fase 3a PoC eseguito (YYYY-MM-DD HH:MM)

   Sub-corpus: 20 pagine (vedi [[wiki-as-graph-poc-sub-corpus-snapshot]]).
   Provider: <graphify-cloud | graphify-ollama>.
   Cost effettivo: $<C>.

   Risultati 4 check:
   - Citation integrity: <PASS|FAIL> (___/218)
   - Wikilink resolution: <PASS|FAIL> (___/215, broken=___)
   - Frontmatter integrity: <PASS|FAIL> (___/20)
   - Layering preservato: <PASS|FAIL> (___ namespace)

   DECISIONE: <GO|NO-GO>
   Rationale: ___
   ```

3. **Aggiorna wiki/log.md** del meta-framework:
   ```
   [YYYY-MM-DD HH:MM] poc — wiki-as-graph karpathy preservation: decisione=<GO|NO-GO>,
   check=<count_pass>/4 — files touched: 1
   ```

4. Se decisione = **GO**: apri TSK per Fase 3b nel meta-framework
   (`graphify-sync` target esteso a `wiki`, modifiche a `wiki-keeper` e `wiki-query`,
   monitoring daily karpathy invariant).

   Se decisione = **NO-GO**: deprecare Fase 3b nel design doc; aggiornare PATTERN.md
   §20.10.2 per rimuovere `kind: wiki` come target supportato.

## Anti-pattern da evitare

- **Sub-corpus troppo piccolo**: < 20 pagine non è rappresentativo. Mantieni la
  selezione standard 10+5+3+1+1.
- **Sub-corpus monolingue**: il wiki ha contenuto in italiano principalmente; il
  sub-corpus deve includerlo. Verifica che Graphify gestisca correttamente UTF-8.
- **Skip Check 4 (layering)**: anche se Citation/Wikilink/Frontmatter passano, se
  il graph non distingue namespace → wiki-query non può filtrare per tipo → NO-GO.
- **Confondere `INFERRED` con `EXTRACTED`**: i check del PoC devono lavorare solo
  su `EXTRACTED` (deterministico). Includere `INFERRED` introduce noise non valutabile.
- **Decisione GO con FAIL parziale**: l'invariante è non negoziabile. Anche 1
  check su 4 FAIL = NO-GO automatico.
- **Validare su corpus diverso dal target Fase 3b**: il PoC deve girare su un
  campione del corpus REALE che andrà in produzione. Non un dataset esterno.

## Trade-off documentati

| Esito GO | Esito NO-GO |
|---|---|
| `wiki-query` riduce context 10-70× | `wiki-query` continua a scansionare le pagine (comportamento v2.14 Fase 2) |
| `wiki-keeper` ha duplicate detection automatica via graph | `wiki-keeper` continua filesystem-based |
| Karpathy invariant da monitorare daily | Filesystem è authoritative come da sempre |
| Costo build settimanale del graph wiki/ | Zero costo aggiuntivo |
| Drift wiki/ → graph da gestire (R.G4) | Nessun drift possibile |
| Fase 3b implementabile in v2.15 | Roadmap fermata a Fase 2 v2.14 |

## Riferimenti

- Design doc: [[factory-compression-layer]] §Fase 3a (invariante non negoziabile)
- Snapshot sub-corpus: [[wiki-as-graph-poc-sub-corpus-snapshot]] (20 pagine + baseline)
- Pattern: PATTERN.md §6 (citation grammar), §10 (wiki maintenance), §20.10-§20.11
- Concept correlati: [[graphify]], [[knowledge-graph-codebase]], [[llm-wiki-pattern]],
  [[citation-grounded]]
- Runbook Fase 2: [[migration-v214-fase2]] (Context Compression base)
- Pattern Wiki invariant: [[citation-grounded]], [[promotion-pipeline]]
