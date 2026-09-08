# CLAUDE.md — soli-turnly

Applicazione per la gestione della turnazione del personale e staff.

Questo repo segue il pattern definito in [`PATTERN.md`](PATTERN.md) (v2.42, agent-agnostic,
multi-adapter, Compression Layer a due assi opt-in; upgrade v2.32 → v2.42 applicato
2026-09-08 in modalità additiva — vedi [`CHANGELOG.md`](CHANGELOG.md)).

## Meta-prompt versioning (v2.42 — corrente)

Fonte di verità: `factory.config.yaml#pattern_version`. Delta cumulativi
applicati rispetto a v2.32 (backward compat totale, tutte opt-in):

- v2.33 — Content Share Consumer Layer (EP-048, PATTERN §32)
- v2.34 — Governance Enforcement + Adoption Onboarding + Bus Factor + Tech Debt (EP-049..052)
- v2.36 — Backport portale-servizi-factory (EP-053: R.21 cooperative locking, /onboarding, vcs-preflight, PATTERN §23.9)
- v2.37 — Code Intelligence Stack (EP-054, PATTERN §33 — L1 ctags + L2 semantic + L3 impact)
- v2.38 — Semantic Purpose Layer + Wiki Keeper 2.0 (EP-055 + EP-056, PATTERN §34 + §35)
- v2.39 — Ponytail Decision Ladder + Factory-as-MCP-Server (EP-057 + EP-058)
- v2.40 — Backport delta portale-servizi-factory (EP-059: release-manager, tpm-reconcile, deep-functional-probe, release-protocol, statusline-ledger)
- v2.41 — Refactor Skill Layer / Fleet Health (EP-060, PATTERN §36 — agente fleet-doctor + skill refactor-agent-skills)
- v2.42 — Session Observability (EP-061 + EP-062, PATTERN §37 — session-analysis + walker fan-in harvest CC 2.1.258+)

Meta-prompt seed: [`meta-prompts/v2-42/factory-bootstrap.md`](meta-prompts/v2-42/factory-bootstrap.md).

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
| Content Share Consumer (EP-048) | off | v2.33 — `/share` (richiede target_repo) |
| Code Intelligence Stack (EP-054) | off | v2.37 — L1 ctags / L2 semantic / L3 impact |
| Semantic Purpose Layer (EP-055) | off | v2.38 — `wiki/purpose.md` guida ingest wiki-keeper |
| Wiki Keeper 2.0 Sweep (EP-056) | off | v2.38 — `/sweep-reviews` |
| Ponytail Decision Ladder (EP-057) | off | v2.39 — `/ponytail-review`, `/ponytail-audit` (HARD DEP code_quality) |
| Factory-as-MCP-Server (EP-058) | off | v2.39 — `adapters/mcp/` read-only |
| Release Manager + tpm-reconcile (EP-059) | off | v2.40 — agente `release-manager`, skill backport |
| Fleet Health (EP-060) | off | v2.41 — agente `fleet-doctor`, `/refactor` |
| Session Observability (EP-061+EP-062) | off | v2.42 — `/session-analysis`, walker fan-in harvest |

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
