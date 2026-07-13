# CLAUDE.md — soli-turnly

Applicazione per la gestione della turnazione del personale e staff.

Questo repo segue il pattern definito in [`PATTERN.md`](PATTERN.md) (v2.32, agent-agnostic,
multi-adapter, Compression Layer a due assi opt-in).

## Quick start

- Scoprire la capability giusta per il task: `/help <domanda>`
- Stato del progetto + wave dispatch: `/run`
- Nuovo PDF in `raw/`: `/sync-docs` → poi `wiki-keeper` per l'ingest
- Domanda al wiki: `/query <domanda>`
- Health check: `/lint`
- Heal ERROR meccanici da lint report: `/heal [<report-path>]`
- Consumare un TSK con dev-agent: `/dev <TSK-id>`
- Code review di un TSK done (CQRL): `/review <TSK-id>`
- Topologia / routing: `/topology [show|set <topology>]`
- Pubblicare kanban: `/kanban-publish [show|set <provider>|run|dry-run]`
- Promote pagina: `/promote <path> <new-status>`

## Capability attive

| Capability | Stato | Versione |
|---|---|---|
| CQRL Code Quality Review | **ON** | v2.12 |
| Analytics Dogfooding (EP-013) | **ON** | v2.19 |
| Token Ledger (EP-022) | **ON** | v2.21 |
| Runtime Contextual Suggestions | sempre scaffoldata | v2.24 |
| Tutte le altre capability | off (default) | — |

## Token Ledger (EP-022)

`analytics.token_ledger.enabled: true` — a fine di ogni risposta che include tool call,
sub-agent o modifiche file, esegui e mostra inline:

```bash
python3 "$(pwd)/tools/analytics/show-session-tokens.py"
```

Output compatto (default) — oppure `--full` per il box completo.
Invariante: mai omettere il token count se `token_ledger.enabled: true` e la risposta ha
prodotto lavoro concreto (modifica file, tool use, lancio agente).

## Configurazione

[`factory.config.yaml`](factory.config.yaml) — configura topologia, code paths, VCS,
scheduler, CQRL, analytics, e tutte le capability opt-in.

## Struttura

- `raw/` — input multi-sorgente (PDF, Figma, repo). Read-only.
- `wiki/` — wiki llm-style append-only.
- `management/` — kanban EP/US, roadmap, questions.
- `design_&_architecture/` — ADR, spec tecniche.
- `code/app/` — codice sorgente applicazione turnazione.
- `memory/` — memoria cross-conversazione.
- `code_quality/` — regole CQRL, report, acceptance spec.
- `analytics/` — pricing, event store EP-013.
- `tools/` — script analytics, a11y, visual.
