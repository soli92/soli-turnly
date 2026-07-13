---
id: bootstrap-record-2026-05-14
type: runbook
title: Bootstrap record — 2026-05-14
status: draft
created: 2026-05-14
updated: 2026-05-15
sources: []
tags: [bootstrap, history, governance]
---

# Bootstrap record — 2026-05-14

Registro operativo dell'evento di bootstrap iniziale del repository. Generato
seguendo il meta-prompt v1 conservato in [^code: docs/meta-prompt-llm-wiki-factory.md:1].

## Health-check finale

| Voce | Valore |
|---|---|
| Path | `/Users/simone.olivieri/Documents/Personal/Repos/soli-multi-agents-factory` |
| Variant | `tech-project` |
| Language | `it` |
| Owner | `soli92` |
| Agents | 11 |
| Schemas | 11 |
| Hooks | 5 |
| Skills | 8 |
| Prompts | 7 |
| Slash commands | 8 |
| Git commit root | `f526b21` |
| Files | 92 |
| Insertions | 4280 |

I conteggi sopra riflettono lo stato del filesystem al momento del commit
iniziale; sono riproducibili scansionando le rispettive directory definite
nello schema di repository [^code: AGENTS.md:36].

## Cosa è stato prodotto

### Schema & governance (Layer 3)

- Substrate schema [^code: AGENTS.md:1] — single source of truth per ogni
  agente LLM, sezioni §0–§11 (architettura tre-layer, operazioni canoniche,
  citation rule, page conventions, language policy, behavioural rules).
- Constitution di progetto [^code: constitution.md:1] con vincolo ABSOLUTO
  "tech-stack agnostic" come anti-pattern primario: il framework NON deve
  imporre uno stack ai progetti che produce.
- Thin pointer Claude [^code: CLAUDE.md:1] e thin pointer Cursor
  [^code: .cursor/rules/wiki.md:1], entrambi sotto 6 righe e privi di
  duplicazione delle regole sostantive.
- 11 JSON Schemas draft 2020-12 in [^code: schemas/agent.schema.json:1]
  più gli altri sotto la stessa directory: agent, wiki-page, source, concept,
  entity, epic, story, task, adr, component, run-log.

### Wiki seeds (Layer 2)

- Navigation hub [[index]] e audit trail [[log]] inizializzati al bootstrap.
- Roadmap factory placeholder [[roadmap]] in `wiki/product/` con sequenza
  prevista descritta in attesa dei primi raw.
- Parking-lot questions [[questions]] e risk register [[risks]] pronti per
  ricevere le prime `Q_NNN` e `R_NNN` quando emergeranno dal lavoro reale.

### Agenti factory (`.claude/agents/`)

Undici agenti, ognuno con frontmatter validato da
[^code: schemas/agent.schema.json:1] e `write_scope:` enforced dall'hook
[^code: .claude/hooks/enforce_write_scope.sh:1]. Set minimo come da §6 del
meta-prompt: orchestrator, wiki-keeper, sync-docs, product-manager,
lead-architect, tpm, verifier-grounding, verifier-task-atomicity,
verifier-extraction, indexer, renderer.

### Hook deterministici

Cinque hook bash collegati via [^code: .claude/settings.json:1], tutti
`chmod +x`. Quattro PreToolUse — write-scope, citations, frontmatter
schema, promotion pipeline — e uno PostToolUse, l'emissione del JSONL
run-log [^code: .claude/hooks/emit_run_log.sh:1] verso `logs/runs/`.

## Smoke test

Verifica funzionale di [^code: .claude/hooks/enforce_citations.sh:1]
eseguita prima del commit, secondo il protocollo §10 step 13 del
meta-prompt [^code: docs/meta-prompt-llm-wiki-factory.md:483].

| Caso | Atteso | Osservato | Esito |
|---|---|---|---|
| Paragrafo ≥ 20 parole senza citazione in `wiki/` | exit ≠ 0 | exit 2 | PASS |
| Paragrafo ≥ 20 parole con `[^src: …]` in `wiki/` | exit 0 | exit 0 | PASS |
| Stesso paragrafo non citato fuori da `wiki/` | exit 0 | exit 0 | PASS |

Il primo run dello smoke test era apparentemente "passato" per un artefatto di
`echo` zsh che interpretava `\n` come newline, corrompendo il payload JSON
inviato all'hook; risolto in fase di test usando `printf '%s'` per preservare
i caratteri letterali della stringa. L'hook in sé è funzionalmente corretto.

## Note importanti per chi userà il framework

Il meta-prompt originale è preservato in
[^code: docs/meta-prompt-llm-wiki-factory.md:1] come riferimento storico e
per garantire la riproducibilità del bootstrap in altre cartelle. Reinvocando
lo stesso meta-prompt con parametri diversi si ottiene un nuovo progetto
tenant con lo stesso scaffold.

Le dipendenze runtime dei hook sono `jq`, `python3`, `pyyaml`, `jsonschema`.
In assenza di `pyyaml` o `jsonschema`, l'hook di validazione frontmatter
[^code: .claude/hooks/validate_frontmatter.sh:1] degrada graciously saltando
il controllo schema; l'hook di citazioni resta sempre funzionale poiché usa
solo Python stdlib [^code: .claude/hooks/enforce_citations.sh:1].

Le decisioni umane ancora aperte vivono nella sezione "Pending decisions" di
[^code: constitution.md:172]: conferma del vincolo agnostic, estensione dei
forbidden patterns, decisione su template "progetti-tenant tipo" e ricalibro
delle soglie di confidence iniziali (0.70 design, 0.75 execution).

## Prossimi passi operativi

Sequenza standard per cominciare a produrre output:

1. Mettere documenti raw in `raw/` rispettando il naming
   `YYYY-MM-DD-<slug>.<ext>` definito dal vincolo schema [^code: AGENTS.md:111].
2. Invocare `/sync-docs` per estrarre testo e immagini come da contratto
   [^code: .claude/agents/sync-docs.md:1].
3. Invocare `/run` (orchestrator decide la topologia) oppure direttamente
   `/ingest raw/` per delegare a [^code: .claude/agents/wiki-keeper.md:1].
4. Iterare ingest + lint citation-audit finché l'avg confidence sui concept
   supera il `confidence_for_design_layer` definito in
   [^code: constitution.md:80].

## Stato dello status

Status iniziale `draft`. Promotion a `reviewed` quando un eventuale
verifier-grounding confermerà che tutte le citazioni `[^code: …]` di questo
registro risolvono a file effettivamente presenti nel repository — operazione
opzionale e non obbligatoria per un runbook storico.

## Contradictions

Sezione introdotta il 2026-05-15 per segnalare claim della prima stesura che
sono stati invalidati da hardening successivi. Pattern conforme ad AGENTS.md
§3.1 "Flag, don't resolve" [^code: AGENTS.md:122].

### "L'hook validate_frontmatter degrada graciously se pyyaml manca" — FALSO

Affermazione originale (righe 105–109 di questo stesso documento): se
`pyyaml` o `jsonschema` mancano, l'hook validate_frontmatter "degrada
graciously saltando il controllo schema". Questa è la descrizione del
comportamento al bootstrap. Dopo l'hardening P0 del 2026-05-15
[^code: logs/audit_log.md:30] non è più vero: l'hook ora rifiuta la write
con `exit 2` se le librerie mancano (fail-closed). Razionale e procedure
operative in [[hook-dependencies]]; post-mortem in
[[2026-05-15-p0-silent-guardrail-degradation]] §Bug 1.

### Dipendenze pinned non erano installate al bootstrap

Affermazione originale: lista delle dipendenze runtime senza indicazione
dell'effettivo stato. In realtà al bootstrap `pyyaml` e `jsonschema` non
erano installati sull'ambiente, rendendo due hook su quattro silenziosamente
inerti per circa 24 ore [^code: logs/audit_log.md:31]. La risoluzione e le
misure preventive sono in [[hook-dependencies]] e
[[2026-05-15-p0-silent-guardrail-degradation]] §Bug 1.
