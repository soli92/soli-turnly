# CHANGELOG — soli-turnly

Formato ispirato a [Keep a Changelog](https://keepachangelog.com/).
Versionamento allineato a `pattern_version` in `factory.config.yaml`.

## [v2.42.0] — 2026-09-08

Upgrade cumulativo v2.32 → v2.42 (10 delta), applicato in modalità
**additiva pura** (eccetto bugfix `tools/analytics/harvest-session-tokens.py`).
Tutte le nuove capability sono opt-in (`enabled: false` di default): a config
invariato la factory si comporta come v2.32.

### Added

- **v2.33 — Content Share Consumer Layer** (EP-048, PATTERN §32, opt-in)
  - Skill `content-share-protocol` + comando `/share`
  - Dispatch fire-and-forget verso repo consumer via `repository_dispatch`
  - Human gate obbligatorio (R.CS3, non bypassabile)
- **v2.37 — Code Intelligence Stack** (EP-054, PATTERN §33, opt-in)
  - Layer L1 (ctags) / L2 (tree-sitter + nomic-embed + LanceDB) / L3 (graphify)
  - Comando `/code-search` + tools/code-intelligence/
  - Zero dipendenze SaaS
- **v2.38 — Semantic Purpose Layer** (EP-055, PATTERN §34, opt-in)
  - Template `wiki/purpose.md` con frontmatter YAML
  - Blocco `wiki_purpose:` in factory.config.yaml
- **v2.38 — Wiki Keeper 2.0 — CoT Handoff & Semantic Sweep** (EP-056, PATTERN §35, opt-in)
  - Skill `sweep-reviews-protocol` + comando `/sweep-reviews`
  - Blocco `wiki_sweep:` in factory.config.yaml
- **v2.39 — Ponytail Decision Ladder** (EP-057, opt-in, HARD DEP `code_quality.enabled`)
  - Skill `ponytail-review` + `ponytail-audit`
  - Comandi `/ponytail-review` + `/ponytail-audit`
  - Blocco `ponytail:` in factory.config.yaml (invariante R.PY1)
- **v2.39 — Factory-as-MCP-Server adapter** (EP-058, opt-in read-only)
  - `adapters/mcp/` con server.py + manifest.yaml + tools/
  - Blocco `mcp_server:` in factory.config.yaml (R.MCP1 no-write)
- **v2.40 — Backport delta portale-servizi-factory** (EP-059)
  - Agente `release-manager` (`.claude/agents/release-manager.md`)
  - Skill `tpm-reconcile`, `deep-functional-probe`, `release-protocol`
  - Tool `tools/analytics/statusline-ledger.py`
- **v2.41 — Refactor Skill Layer / Fleet Health** (EP-060, PATTERN §36, opt-in)
  - Agente `fleet-doctor`
  - Skill `refactor-agent-skills` + foglie `references/refactor/`
  - Comando `/refactor` + `tools/refactor/` (3 script Python stdlib)
  - Runbook `wiki/runbooks/skill-hygiene.md`
  - Blocco `refactor_agent_skills:` in factory.config.yaml
- **v2.42 — Session Observability** (EP-061 + EP-062, PATTERN §37, opt-in)
  - Skill `session-analysis-protocol` + comando `/session-analysis`
  - `tools/session-analysis/` (parse-transcript, detect-anomalies, fleet-metrics, generate-report)
  - Wiki concept `session-agentic-analyser.md` + runbook handoff fleet-doctor
  - Test contract (`tests/test_harvest_contract.py`, `tests/test_session_analysis_e2e.py`)
  - Fixture transcripts (`tests/fixtures/transcripts/`)
  - Meta-prompt `meta-prompts/v2-42/factory-bootstrap.md`
  - Blocco `session_analysis:` in factory.config.yaml
- **PATTERN.md**: appese sezioni §32..§37 (~696 righe verbatim dal master).

### Changed

- `factory.config.yaml`: `pattern_version` `2.32` → `2.42`.
- `tools/analytics/harvest-session-tokens.py`: sostituito con master (bugfix
  EP-062: walker fan-in CC 2.1.258+ per sub-agent + schema-version guard
  `SUPPORTED_CC_VERSIONS`). La versione precedente era una snapshot storica
  in italiano senza logica personalizzata.
- `CLAUDE.md`: aggiornata sezione `## Meta-prompt versioning` con v2-42 corrente.

### Compatibility

- **Backward compat totale** con v2.32: tutte le nuove capability sono opt-in.
- **Nessuna nuova dipendenza esterna obbligatoria**: le capability che
  richiedono pacchetti extra (LanceDB, sentence-transformers, graphify, MCP SDK)
  restano gated dai rispettivi flag `enabled: false`.
- **Nuove invarianti locali**: R.CS1..R.CS4 (content share), R.CI1 (code intelligence),
  R.PY1 (ponytail), R.MCP1 (MCP server no-write), V-1..V-9 + G1..G11 (fleet health).
- File `test-results/` (untracked) ignorato dall'upgrade come previsto (artefatto CI).
