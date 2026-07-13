---
id: migration-v22
type: runbook
title: "Migrazione P0/P1/P2 → v2.2 (LLM-trust + memory tree)"
status: approved
created: 2026-05-18
updated: 2026-05-18
sources:
  - "meta-prompt-llm-wiki-factory-v2.2.md"
  - "[[2026-05-15-hooks-not-loaded-mid-session]]"
related:
  - llm-wiki-pattern
  - agent-agnostic
  - two-phase-commit
  - verifier-as-gate
  - fail-closed
tags: [migrazione, v2.2, runbook, simplification]
---

# Migrazione P0/P1/P2 → v2.2

Runbook della migrazione eseguita il 2026-05-18 per snellire l'implementazione del framework dalle implementazioni intermedie P0/P1/P2 (hook-enforced + two-phase commit + JSON Schemas tipate + verifier subagent + tenant standards gate + regimi A/B duali) alla versione v2.2 (LLM-trust + memory tree). [^src: meta-prompt-llm-wiki-factory-v2.2.md §13]

## Razionale

Le implementazioni P0/P1/P2 avevano accumulato ~3-4× la massa di codice/contratto del pattern v2.1 originale per via di meccanismi reali emersi da incidenti (hooks-not-loaded-mid-session, allowManagedHooksOnly). Il trade-off era: enforcement deterministico vs portabilità agent-agnostic e leggibilità del contratto. [^src: meta-prompt-llm-wiki-factory-v2.2.md §13]

La decisione del 2026-05-18 ha privilegiato leggibilità e agent-agnosticità, accettando come trade-off la perdita di:
- Enforcement deterministico via hook bash/python (~1000 righe)
- Two-phase commit `wiki-staging/` → `verifier-*` → `wiki/` (~400 righe orchestrator + script)
- Validazione frontmatter automatica via JSON Schemas (11 schemi)
- Tenant standards gate (`enforce_standards.sh` + lookup table OIDC/SAML/SPID)
- Verifier budget circuit breaker (rimosso perché senza two-phase commit perde soggetto)
- Regimi A/B duali (necessari solo per ambienti enterprise con `allowManagedHooksOnly`)

Conservato: memory tree cross-conversazione (`episodic/semantic/procedural/`), tutto il contenuto wiki sostanziale (concepts, entities, sources, runbooks, incidents), citazione obbligatoria come pattern LLM-trust segnalato dal `wiki-lint` (read-only). [^src: meta-prompt-llm-wiki-factory-v2.2.md §13]

## File eliminati

| Path | Motivo |
|---|---|
| `.claude/hooks/` (9 script) | LLM-trust regime, no enforcement deterministico |
| `.claude/scripts/` (gate.sh, emit_marker.sh) | Two-phase commit rimosso |
| `schemas/` (11 JSON Schemas) | Validazione frontmatter è lint, non gate |
| `wiki-staging/` (dopo aver promosso 2 file in `wiki/concepts/`) | Two-phase commit rimosso |
| `dashboard/`, `inbox/`, `docs/`, `variants/` | Non previsti dal pattern v2.2 |
| `project_manifest.json` | Stato dedotto dal filesystem + `wiki/log.md` |
| `requirements.txt` | Dipendenze Python erano solo per gli hook |
| `.claude/agents/{indexer,renderer,verifier-extraction,verifier-grounding,verifier-task-atomicity}.md` | Rimossi (5 agenti) |
| `.claude/skills/*` (8 file) | Sostituite dalle 7 skill v2.2 |
| `.claude/commands/{audit,ingest,close-sprint}.md` | Sostituiti dai 5 commands v2.2 |
| `prompts/` (7 file) | Sostituiti dai 5 commands pass-through |
| `AGENTS.md` (525 righe), `constitution.md` (377 righe) | Fusi in `PATTERN.md` (~130 righe) |

## File archiviati (preservati come archeologia)

I log operativi sono stati archiviati in [`wiki/incidents/archive-logs-2026-05-18/`](../incidents/archive-logs-2026-05-18/): [^src: meta-prompt-llm-wiki-factory-v2.2.md §13]
- `audit_log.md` (audit costituzionale)
- `runs/` (JSONL per-run dell'ultimo periodo P2)
- `verifier_requests/` (2 marker pendenti citation-grounded e promotion-pipeline)

Le pagine `wiki/concepts/` che descrivono i meccanismi rimossi (two-phase-commit, verifier-as-gate, fail-closed, write-scope, citation-grounded, promotion-pipeline, circuit-breaker) sono **conservate intatte** come documentazione storica del design pre-v2.2. [^src: meta-prompt-llm-wiki-factory-v2.2.md §13]

Gli incidents `2026-05-15-hooks-not-loaded-mid-session.md` e `2026-05-15-p0-silent-guardrail-degradation.md` sono conservati come post-mortem dei punti di svolta che hanno motivato l'evoluzione del framework. [[2026-05-15-hooks-not-loaded-mid-session]]

## File creati

- `PATTERN.md` (~130 righe) — contratto universale agent-agnostic v2.2
- `meta-prompt-llm-wiki-factory-v2.2.md` (~1170 righe) — meta-prompt che riproduce il pattern
- `management/` (`kanban/`, `roadmap.md`, `questions.md`) — L3 vuoto pronto per il primo PM run
- `design_&_architecture/` (`api_specs/`, `db_schemas/`, `decisions/`) — L4 vuoto
- `memory/{semantic,procedural}/.gitkeep` — completamento del tree memoria
- `wiki/gaps.md` — registro gap (sostituisce `wiki/05-gap-e-aperti.md` mai creato)

## File riscritti

- `CLAUDE.md` (8 righe → ~30 righe) — pointer all'adapter
- `README.md` (171 righe → ~80 righe) — sintesi 1 pagina
- `.claude/settings.json` — rimosso blocco hooks
- 8 agenti `.claude/agents/*.md` — riscritti in stile v2.2 (~30 righe l'uno)
- 7 skill `.claude/skills/*.md` — riscritte in stile v2.2 (~50 righe l'una)
- 5 command `.claude/commands/*.md` — riscritti come pass-through (~15 righe l'uno)

## Backup e rollback

Tag git pre-migrazione: `pre-v22-migration-2026-05-18` → commit `ab9b8e1`. [^src: meta-prompt-llm-wiki-factory-v2.2.md §13]

Per rollback completo:
```bash
git reset --hard pre-v22-migration-2026-05-18
```

## Test di accettazione

Eseguiti contro §9 del meta-prompt v2.2:
- [x] `PATTERN.md` ≤ 150 righe (effettivo: 129)
- [x] `CLAUDE.md` ≤ 30 righe (effettivo: ~30)
- [x] `PATTERN.md` agent-agnostic (nessun riferimento a Read/Write/Glob/Sonnet/Opus/slash command)
- [x] Ogni agente ≤ 45 righe
- [x] Ogni skill ≤ 80 righe
- [x] `wiki/log.md` esiste con entry migration aggiunta
- [x] `memory/{episodic,semantic,procedural}/` esistono
- [x] Nessun riferimento legacy a `docs/`, `project_manifest.json`, `wiki/confidences/`, `wiki-staging/`, hook bash, agenti verifier/indexer/renderer

## Effetti collaterali e nuove convenzioni

Dopo la migrazione il framework opera in regime **LLM-trust**: niente fail-closed deterministico, niente `gate.sh` da invocare. Il rispetto del contratto è responsabilità degli agenti producer, e le violazioni vengono segnalate retroattivamente dal `wiki-lint` (read-only report). Questa è una **scelta di trade-off documentata**: privilegia portabilità cross-runtime (agent-agnostic) e leggibilità del contratto rispetto alla garanzia hard di non-violabilità del passato P0/P1/P2. [^src: meta-prompt-llm-wiki-factory-v2.2.md §13]

Il pattern di [[two-phase-commit]] e [[verifier-as-gate]] resta documentato per chi vuole reintrodurlo in futuro come overlay opzionale, ma non è più il default.

## Pagine wiki collegate

- [[llm-wiki-pattern]] — il pattern Karpathy alla base del substrato
- [[agent-agnostic]] — principio che ha motivato la rimozione di hook claude-specific
- [[two-phase-commit]] — meccanismo rimosso, documentato per archeologia
- [[verifier-as-gate]] — pattern rimosso, documentato per archeologia
- [[fail-closed]] — principio non più applicato deterministicamente
- [[citation-grounded]] — principio mantenuto, ma enforced via lint anziché hook
- [[promotion-pipeline]] — pipeline mantenuta come convenzione, non più gated
- [[circuit-breaker]] — pattern rimosso (verifier budget perde soggetto senza two-phase commit)
- [[bootstrap-record-2026-05-14]] — record del bootstrap originale
