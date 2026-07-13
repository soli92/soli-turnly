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

| Capability | Stato | Note |
|---|---|---|
| CQRL Code Quality Review | **ON** | v2.12 — `/review` |
| Analytics Dogfooding (EP-013) | **ON** | v2.19 — hook SessionEnd |
| Token Ledger (EP-022) | **ON** | v2.21 — hook Stop |
| Runtime Contextual Suggestions (EP-033) | sempre scaffoldata | v2.24 |
| Premortem (EP-016) | **ON** | v2.16 — `/premortem` |
| Visual Oracle FE (EP-005) | **ON** | v2.17 — visual-regression + axe-a11y + interaction-test |
| A11y WCAG 2.2 AA (EP-007) | **ON** | v2.18 — `a11y-specialist`, required_on_fe_done |
| UX/UI Review & Design (EP-008) | **ON** | v2.18 — `ux-ui-reviewer` + `ui-designer` |
| Functional Oracle (EP-018) | **ON** | v2.20 — Playwright acceptance spec |
| Design Intelligence (EP-019) | **ON** | v2.21 — art-director + critic-judge (richiede ux_ui.enabled) |
| Semantic Drift Detection (EP-031) | **ON** | v2.23 — L3 embedding (voyage-3) |
| VCS Branch Awareness (EP-034) | **ON** | v2.25 — preflight + dispatch_gate: warn |
| Prototype Generation (EP-035) | **ON** | v2.26 — backend: auto (figma/penpot/react/html) |
| Tavola Rotonda (EP-039) | **ON** | v2.27 — `/tavola-rotonda` |
| Voice Channel (EP-041/EP-046) | **ON** | v2.28/v2.32 — richiede `/voice-install` |
| Hybrid Wiki Search (EP-042) | **ON** | v2.29 — richiede `pip install sentence-transformers lancedb` |
| Temporal Estimate (EP-043) | **ON** | v2.30 — sprint-progress |
| Capability Formativa (EP-045) | **ON** | v2.32 — wiki_search_integration: true |
| OCL Output Compression | **ON** | v2.14 — caveman provider, conservative |
| CCL Context Compression (Graphify) | off | v2.14 — richiede graphify provider configurato |
| Analytics Estimation (EP-010) | **ON** | v2.19 |

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
