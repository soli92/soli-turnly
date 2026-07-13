---
id: migration-v29
type: runbook
title: "Migrazione v2.8 → v2.9 (sync adapters multi-sorgente: PDF + Figma)"
status: draft
created: 2026-05-22
updated: 2026-05-22
sources:
  - "PATTERN.md §1, §2, §3, §4, §6, §10, §16, §17 (versioning)"
  - "meta-prompt-llm-wiki-factory.md (v2.9)"
  - ".claude/agents/figma-sync.md"
  - ".claude/agents/sync-docs.md (manifest esteso)"
  - ".claude/skills/figma-extraction-protocol.md"
  - ".claude/skills/ingest-protocol.md (ramo Figma)"
  - ".claude/skills/lint-checks.md (Check 4e)"
  - ".claude/skills/citation-rules.md (grammatica JSON)"
related:
  - sync-adapters
  - migration-v28
  - migration-v210
  - chunked-extraction-pipeline
  - figma
  - figma-extraction-agent
tags: [runbook, migration, v2.9, sync, figma, pdf, multi-source, l1, kb-json]
---

# Migrazione v2.8 → v2.9 — Sync adapters multi-sorgente

> Playbook riproducibile della migrazione applicata in data 2026-05-22.
> Versione precedente archiviata in `meta-prompt-llm-wiki-factory-v2.8.md`.

## Sintesi

| Voce | Prima (v2.8) | Dopo (v2.9) |
|---|---|---|
| Ruolo *Sync* | unico agente `sync-docs` (PDF) | **N sub-agent per sorgente** (`sync-docs`, `figma-sync`, …) |
| Sorgenti L1 supportate | PDF (`*.txt`+`images/`) | PDF + Figma (`*.kb.json`+`images/`); contratto pronto per Notion/Confluence |
| Shape L1 strutturato | nessuno | `*.kb.json` (schema KB Figma: project/screens/components/flows/features/tokens) |
| Grammatica citazione | `[^src: <path>.md §<sez>]` | + `[^src: <path>.kb.json §<dotted-path>]` (dotted, idx, key) |
| `.extraction-manifest.json` | `{<nome>: {extracted_at, txt_path, ...}}` | `{<key>: {source, primary_artifact, secondary_artifacts, extractor_version, ...}}` (retrocompat) |
| `ingest-protocol` Fase 1 | un solo ramo (testuale) | due rami: testuale (PDF) + schema-driven (Figma) |
| `lint-checks` | 4 + 4b + 4c + 4d | + 4e (coerenza manifest ↔ raw filesystem) |
| Sezioni PATTERN.md | 0–15 + Versioning | + §16 «Sync adapters» (Versioning bumpata) |
| Regole inviolabili | 14 (r.14 VCS) | 14 (invariate; §16 introduce invarianti di isolamento dei sub-agent) |

## Pre-condizioni

1. Pattern version corrente = v2.8.
2. Backup: `meta-prompt-llm-wiki-factory-v2.8.md` archiviato accanto al canonical.
3. Tag git suggerito: `pre-v29-migration-2026-05-22`.
4. Lint pulito o solo WARNING.
5. Per usare `figma-sync`: `ANTHROPIC_API_KEY` settata + accesso Figma MCP configurato a parte (auth lato `https://mcp.figma.com/mcp`).

## Vincoli

- **L1 read-only invariato** (PATTERN §7 r.1): solo il ruolo *Sync* scrive in `raw/`, ma ora con N sub-agent — ciascuno solo nel proprio scope di naming.
- **Retrocompat manifest**: entries pre-v2.9 (`{<nome>: {extracted_at, txt_path, figures, pages}}`) restano valide; il `wiki-keeper` e il lint le interpretano come `source: pdf` di default.
- **Mai overwrite cross-adapter**: `sync-docs` non scrive entry con `source ≠ pdf`; `figma-sync` non tocca entries di altri provider.
- **Naming univoco**: ogni file in `raw/` prodotto da `figma-sync` ha prefisso `<data>-figma-<file-key>-` per evitare collisioni con `sync-docs`.
- **Mai API esterne in altri ruoli**: solo i sub-agent Sync chiamano Anthropic API / Figma MCP. Wiki-keeper resta agnostico (legge solo `raw/`).

## Steps

### 1. Backup meta-prompt

```bash
cp meta-prompt-llm-wiki-factory.md meta-prompt-llm-wiki-factory-v2.8.md
```

### 2. Aggiorna `PATTERN.md` a v2.9

Sezioni toccate:
- §0 — bump versione 2.8 → 2.9, Origine estesa con "sync adapters multi-sorgente".
- §1 — L1 description ampliata (PDF + KB JSON + futuri shape).
- §2 — riga *Sync* pluralizzata (`sync-docs`, `figma-sync`, …); riga *Analyst* estesa a `.kb.json`.
- §3 — operazione `Ingest` legge `.txt` o `.kb.json`.
- §4 — naming Figma: `raw/YYYY-MM-DD-figma-<key>.kb.json` + frame stub.
- §6 — grammatica citazione JSON `[^src: <path>.kb.json §<dotted-path>]` con convenzioni `§project.name`, `§screens[0]`, `§components[name=Button]`.
- §10 — tabella eventi: nuova riga "Nuovo Figma in raw/" trigger.
- §16 nuova — Sync adapters (multi-source L1).
- §17 (ex §16) — Versioning con voce v2.9.

### 3. Estendi `factory.config.yaml`

Nessun nuovo blocco obbligatorio. Il `figma-sync` non aggiunge campi a `factory.config.yaml`: è opt-in via comando `/figma-sync`.

### 4. Crea adapter Claude Code

- `.claude/agents/figma-sync.md` (thin, sub-agent Sync per Figma).
- `.claude/skills/figma-extraction-protocol.md` (fat, 5 fasi: Bootstrap → Discovery → Chunked Extraction parallela → Proposta → Scrittura).
- `.claude/commands/figma-sync.md` (slash command `/figma-sync <url|file_key>`).

Pattern di estrazione: istanzia [[chunked-extraction-pipeline]] (Discovery + Extraction parallela con worker-pool concorrenza limitata e backoff esponenziale).

### 5. Aggiorna `sync-docs` (manifest esteso)

In `.claude/agents/sync-docs.md`, sezione "Regole": il manifest entry diventa:

```json
{
  "<data>-<nome>": {
    "source": "pdf",
    "extracted_at": "<ISO-8601>",
    "primary_artifact": "raw/<data>-<nome>.txt",
    "secondary_artifacts": ["raw/images/<data>-<nome>-fig-01.md", "..."],
    "extractor_version": "sync-docs@2.9.0",
    "extraction_metadata": { "pages": N, "figures": M }
  }
}
```

Retrocompat: re-ingest di un PDF già nel manifest in forma pre-v2.9 → migra in-place al nuovo formato.

### 6. Aggiorna `wiki-keeper` per leggere `.kb.json`

In `.claude/agents/wiki-keeper.md`, sezione "Scope": aggiungi `raw/**/*.kb.json` alla lista di lettura. Aggiungi regola "Mai chiamare API esterne (Figma MCP, Anthropic): l'estrazione vive nei sub-agent Sync. Per la sorgente Figma il wiki-keeper legge solo `raw/*.kb.json` già prodotto da `figma-sync`."

### 7. Aggiorna `ingest-protocol` (Fase 0 + Fase 1)

- Fase 0: `Glob` esteso a `*.kb.json`; conteggio `N` include nuovi artefatti di qualsiasi shape.
- Fase 1: ramo `source: figma` schema-driven:
  - `project` → 1 source page per il file Figma.
  - Ogni `screens[i]` significativo → `wiki/entities/screen-<slug>.md`.
  - Ogni `components[i]` → `wiki/entities/component-<slug>.md`.
  - Ogni `flows[i]` → `wiki/concepts/flow-<slug>.md`.
  - Ogni `features[i]` → `wiki/concepts/feature-<slug>.md`.
  - `tokens` → `wiki/concepts/design-tokens-<key>.md`.
  - Soglia di significatività: scarta screen/component senza descrizione e con < 2 cross-reference (annota in `## Estratto non promosso a pagina`).
- Fase 1.bis (merge parallelo): ogni worker riceve `source` + `primary_path` invece di solo `txt_path`.

### 8. Aggiorna `citation-rules` (grammatica JSON)

Aggiungi forma `[^src: <path>.kb.json §<dotted-path>]` con convenzioni:
- chiavi dotted (`§project.name`, `§tokens.colors`)
- indice array (`§screens[0]`, `§flows[2].steps[0]`)
- selettore per chiave (`§components[name=Button]`)

Vietato JSONPath complesso o JMESPath (mantenere leggibilità).

### 9. Aggiorna `lint-checks` con Check 4e

Aggiungi sezione "4e — Coerenza manifest ↔ raw filesystem":
- `source ∈ {pdf, figma, notion, ...}`; assente → WARNING `manifest-source-implicit`.
- `primary_artifact` esiste sul filesystem; mancante → ERROR `manifest-primary-missing`.
- `source: pdf` → `primary_artifact` deve essere `.txt`; mismatch → ERROR `manifest-shape-mismatch`.
- `source: figma` → `primary_artifact` deve essere `.kb.json` parsabile; KB JSON deve avere top-level `project`/`screens`/`components`/`flows`/`features`/`tokens` (anche vuoti).
- `secondary_artifacts[]` esistono; mancanti → WARNING.
- Isolamento: `*.txt` con manifest `source: figma` → ERROR `sync-adapter-collision` (e viceversa).
- Orphan: `raw/*.kb.json` senza entry → WARNING `orphan-raw-artifact`.

### 10. Aggiorna meta-prompt a v2.9

Sezioni toccate nel `meta-prompt-llm-wiki-factory.md`:
- Intro — bump versione + nuovo principio v2.9 sui sync adapters.
- §3 — struttura cartelle con `figma-sync.md`, `figma-extraction-protocol.md`, `figma-sync` command (★ opzionali).
- §5 — embedded PATTERN.md template aggiornato (v2.9 changes + nuovo §16).
- §6 — template agente `figma-sync` aggiunto, `sync-docs` aggiornato, `wiki-keeper` aggiornato.
- §7 — template skill `figma-extraction-protocol` aggiunto, `ingest-protocol` aggiornato.
- §10 — template comando `figma-sync` aggiunto.

### 11. Crea documentazione wiki

- `wiki/runbooks/migration-v29.md` (questo file).
- `wiki/concepts/sync-adapters.md` — concept del pattern (riferito da PATTERN §17 changelog v2.9).
- Update `META-PROMPTS-INDEX.md` con riga v2.9.
- Update `CLAUDE.md` e `README.md` con riferimenti a `figma-sync` + `/figma-sync`.
- Update `wiki/index.md` con link alle nuove pagine.
- Append entry `migration` su `wiki/log.md`.

## Test di accettazione

- [ ] `PATTERN.md` dichiara `v2.9` in §0; contiene §16 (Sync adapters).
- [ ] `.claude/agents/figma-sync.md` esiste e dichiara scope corretto (mai `*.txt`).
- [ ] `.claude/skills/figma-extraction-protocol.md` esiste con 5 fasi (Bootstrap → Discovery → Chunked Extraction → Proposta → Scrittura).
- [ ] `.claude/commands/figma-sync.md` esiste.
- [ ] `sync-docs.md` aggiornato con manifest v2.9 + scope `figma` escluso.
- [ ] `wiki-keeper.md` legge `*.kb.json` in scope.
- [ ] `ingest-protocol.md` ha ramo `source: figma` con mapping schema-driven.
- [ ] `citation-rules.md` definisce grammatica `<dotted-path>` con esempi.
- [ ] `lint-checks.md` ha sezione "4e — Coerenza manifest ↔ raw filesystem".
- [ ] `meta-prompt-llm-wiki-factory.md` dichiara v2.9 nel changelog.
- [ ] `meta-prompt-llm-wiki-factory-v2.8.md` esiste come snapshot.
- [ ] Una invocazione `/figma-sync <url>` (con `ANTHROPIC_API_KEY` settata e Figma MCP configurato) produce `raw/<data>-figma-<key>.kb.json` valido + entry manifest con `source: figma`.

## Rollback

1. `git reset --hard pre-v29-migration-2026-05-22` o revert dei commit di migrazione.
2. `rm .claude/agents/figma-sync.md .claude/skills/figma-extraction-protocol.md .claude/commands/figma-sync.md`.
3. Revert `PATTERN.md`, `sync-docs.md`, `wiki-keeper.md`, `ingest-protocol.md`, `citation-rules.md`, `lint-checks.md`, `meta-prompt-llm-wiki-factory.md`, `CLAUDE.md`, `README.md`.
4. Le entries manifest in forma v2.9 (con `source`/`primary_artifact`/...) sono retrocompat con v2.8 (la chiave `source` viene ignorata).
5. Pagine wiki create dall'ingest di KB JSON restano (sono pagine valide); se rollback aggressivo, anche queste vanno rimosse.

## Errori comuni

- **`raw/*.kb.json` ingerito ma il KB JSON è malformato** → ingest fallisce o produce pagine vuote. Lint Check 4e segnala `manifest-shape-mismatch` con sub-categoria `kb-json-invalid`.
- **Cross-adapter collision**: `raw/X.txt` esiste e c'è anche un manifest entry `X` con `source: figma`. ERROR `sync-adapter-collision`. Risolvi rinominando il file o aggiornando il manifest.
- **`figma-sync` chiamato senza `ANTHROPIC_API_KEY`** → skill `figma-extraction-protocol` aborta in Fase 1 con messaggio chiaro.
- **File Figma protetto / 403 sull'MCP** → ABORT Fase 1 con istruzione di configurare l'accesso Figma MCP.
- **Manifest entry pre-v2.9 con campo `txt_path` ma senza `primary_artifact`** → lint Check 4e tollerante (interpreta come `source: pdf`); sync-docs migra in-place al primo re-ingest.
- **Wiki-keeper apre un `.kb.json` direttamente senza passare per il manifest** → comportamento non definito. Regola: leggi sempre il manifest in Fase 0 e usa il campo `source` per scegliere il ramo.

## Quando NON migrare

- **Setup senza Figma**: se non hai sorgenti Figma, `figma-sync` è puro overhead (file in più). Resti a v2.8 senza problemi. Il manifest pre-v2.9 funziona ancora.
- **Sorgenti L1 esotiche che non hai modo di adattare**: prima di scrivere un nuovo sync adapter, valuta se una conversione manuale a `.txt` + `sync-docs` esistente sia sufficiente per il volume previsto.
- **PoC ≤ 1 settimana**: l'overhead di `figma-sync` + ingest schema-driven non si ripaga.

## Cross-reference

- Concept del pattern: [[sync-adapters]].
- Pattern istanziato in `figma-sync`: [[chunked-extraction-pipeline]] + [[worker-pool-concurrency-limiter]] + [[exponential-backoff-retry]].
- Sorgente del pattern: [[figma-extraction-agent]] (JSX originario, ingerito 2026-05-21).
- Entità prodotto: [[figma]].
- Migrazione precedente (v2.7 → v2.8, VCS integration): [[migration-v28]].
- Migrazione successiva (v2.9 → v2.10, publisher adapters): [[migration-v210]].
