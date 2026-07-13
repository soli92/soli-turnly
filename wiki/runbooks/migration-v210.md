---
id: migration-v210
type: runbook
title: "Migrazione v2.9 → v2.10 (publisher adapters multi-target: GitHub Issues)"
status: draft
created: 2026-05-22
updated: 2026-05-22
sources:
  - "PATTERN.md §2, §3, §5, §7 r.15, §10, §17, §18 (versioning)"
  - "meta-prompt-llm-wiki-factory.md (v2.10)"
  - "factory.config.yaml (blocco kanban_publish:)"
  - ".claude/agents/github-publisher.md"
  - ".claude/skills/publisher-protocol.md"
  - ".claude/skills/github-mapping.md"
  - ".claude/commands/kanban-publish.md"
  - ".claude/skills/lint-checks.md (Check 4f)"
related:
  - publisher-adapters
  - sync-adapters
  - migration-v29
  - migration-v28
  - write-scope
  - multi-agent-factory
tags: [runbook, migration, v2.10, publisher, kanban, github, push-only, l3, l4, external-id]
---

# Migrazione v2.9 → v2.10 — Publisher adapters multi-target

> Playbook riproducibile della migrazione applicata in data 2026-05-22.
> Versione precedente archiviata in `meta-prompt-llm-wiki-factory-v2.9.md`.

## Sintesi

| Voce | Prima (v2.9) | Dopo (v2.10) |
|---|---|---|
| Ruoli §2 | Orchestrator, Sync (N sub-agent), Analyst, PM, Arch, TPM, Query, Lint, Dev | + **Publisher** (N sub-agent per provider) |
| Operazioni canoniche §3 | 10 (Ingest, Query, Lint, Plan, Design, Develop, Promote, Heal, Propagate, Tech-scout) | 11 (+ **Publish**) |
| Frontmatter EP/US/TSK | `id`, `title`, `status`, `layer`, `consumer`, … | + opzionale `external_id: <provider>:<id>` |
| Regole inviolabili §7 | 14 (r.14 VCS gate) | 15 (+ **r.15 cross-tool publish gate**) |
| `factory.config.yaml` | `topology`, `code_path`, `vcs`, `stack_mode`, `routing`, `stack` | + blocco `kanban_publish` (provider/target/auth_env/mode/batch_limit/mapping/labels/filter) |
| `.claude/agents/` | 8 core + 0..4 dev | + 0..N publisher (`github-publisher`, …) |
| `.claude/skills/` | 19 (con `figma-extraction-protocol` v2.9) | + `publisher-protocol` (agnostic) + `<provider>-mapping` (specific, es. `github-mapping`) |
| `.claude/commands/` | 8 (con `/figma-sync` v2.9) | + `/kanban-publish` |
| Lint checks | 4 + 4b + 4c + 4d + 4e | + 4f (coerenza Publisher) |
| Sezioni PATTERN.md | 0–16 + Versioning (§17) | 0–16 + **§17 «Publisher adapters»** + Versioning (§18 bumpato) |
| Direzione mirror | n/a | **push-only** (bidirectional candidato v2.11) |

## Pre-condizioni

1. Pattern version corrente = v2.9.
2. Backup: `meta-prompt-llm-wiki-factory-v2.9.md` archiviato accanto al canonical.
3. Tag git suggerito: `pre-v210-migration-2026-05-22`.
4. Lint pulito o solo WARNING.
5. Per usare `github-publisher`: `gh` CLI installato (https://cli.github.com/) + `gh auth login` eseguito + scope `repo:issues:write` + `repo:metadata:read` sul target.

## Vincoli

- **`management/kanban/**` resta canonico** (PATTERN §8 invariato). Il publisher è solo mirror; modifiche fatte sul provider esterno saranno sovrascritte al prossimo `run`.
- **Push-only solo in v2.10**. Bidirectional `status:` (issue chiusa → TSK done) è candidato v2.11, **non implementato**.
- **Mai DELETE/CLOSE automatici** (§7 r.15): se un TSK è rimosso da `management/`, l'issue esterna resta aperta. L'umano decide.
- **Mai create/update batch senza gate** (§7 r.15): conferma esplicita prima di ogni run; secondo gate se totale > `batch_limit` (default 10).
- **Token solo da env var** dichiarata in `kanban_publish.auth_env`; mai committato nel repo.
- **Scope sub-agent chiuso**: `github-publisher` modifica solo `external_id:` con prefisso `github:`. Mai sovrascrive `external_id: jira:...` (cross-provider collision → SKIP con warning).

## Steps

### 1. Backup meta-prompt

```bash
cp meta-prompt-llm-wiki-factory.md meta-prompt-llm-wiki-factory-v2.9.md
```

### 2. Aggiorna `PATTERN.md` a v2.10

Sezioni toccate:
- §0 — bump versione 2.9 → 2.10, Origine estesa con "publisher adapters multi-target".
- §2 — nuova riga ruolo *Publisher* (`github-publisher`, `gitlab-publisher`, …) pluralizzato per provider.
- §3 — nuovo verbo **Publish** (transizione L3/L4 → tool esterno, push-only, idempotente via `external_id:`).
- §5 — campo opzionale `external_id:` su EP/US/TSK (forma `<provider>:<id>`).
- §7 — nuova r.15 (cross-tool publish gate umano).
- §10 — tabella eventi: nuova riga "Kanban pubblicato" trigger.
- §17 nuova — **Publisher adapters (multi-target L3/L4)**: invariante di direzione (push-only), provider supportati, contratto per nuovo adapter, invariante di isolamento, procedura `publisher-protocol` 5 fasi.
- §18 (ex §17) — Versioning con voce v2.10.

**Nota di numerazione**: nella prima versione del bump, Publisher era stata inserita come §18 e Versioning come §19. Renumber successivo (§18→§17, §19→§18) per coerenza con il pattern storico (ogni nuova sezione si inserisce subito prima di Versioning, che bumpa di 1).

### 3. Estendi `factory.config.yaml`

Aggiungi blocco `kanban_publish:` dopo `stack:`:

```yaml
kanban_publish:
  provider: none                  # none | github | gitlab | jira | linear | custom
  # Solo se provider != none:
  # target: "<org>/<repo>"
  # auth_env: GH_TOKEN
  # mode: push-only
  # batch_limit: 10
  # mapping:
  #   epic_to: milestone           # milestone | issue-label | project-column
  #   story_to: issue-label
  #   task_to: issue-label
  #   sprint_to: milestone
  # labels:
  #   epic: "kanban:epic"
  #   story: "kanban:story"
  #   task: "kanban:task"
  #   layer_prefix: "layer:"
  # filter:
  #   only_consumer: any
  #   only_status: any
```

Per repo che non usano publisher: `provider: none` (default, nessuna configurazione richiesta).

### 4. Crea adapter Claude Code (1 agent + 2 skill + 1 command)

- `.claude/agents/github-publisher.md` (thin, sub-agent Publisher per GitHub).
- `.claude/skills/publisher-protocol.md` (fat, **provider-agnostic**, 5 fasi: Bootstrap → Discovery → Plan/Gate → Publish → Log).
- `.claude/skills/github-mapping.md` (fat, **provider-specific**: come EP/US/TSK ↔ Milestone/Issue/Label, comandi `gh` CLI esatti).
- `.claude/commands/kanban-publish.md` (slash command `/kanban-publish [show|set|run|dry-run]`).

Provider futuri (`gitlab`/`jira`/`linear`): contratto pronto in PATTERN §17, agente/skill da scaffoldare quando servono. **Mai** modifiche a PATTERN per un nuovo provider.

### 5. Aggiorna `lint-checks` con Check 4f

Aggiungi sezione "4f — Coerenza Publisher":
- `provider ∈ {none, github, gitlab, jira, linear, custom}`; altrimenti ERROR `invalid-publish-provider`.
- `mode ∈ {push-only}` per v2.10; altrimenti ERROR `invalid-publish-mode`.
- Se `provider ≠ none`: `target`, `auth_env`, `mapping` valorizzati; sub-agent `<provider>-publisher.md` esiste; skill `<provider>-mapping.md` esiste.
- Per ogni EP/US/TSK con `external_id:`:
  - Forma `<prefisso>:<id>`; altrimenti ERROR `invalid-external-id-format`.
  - Se `provider: none` → WARNING `orphan-external-id`.
  - Se prefisso ≠ provider → WARNING `external-id-cross-provider`.
- Per artefatti senza `external_id:` con `status ∈ {in-progress, done}` e `provider ≠ none` → WARNING `unpublished-active-artifact`.
- Verifica ultime 10 entry `publish` su `wiki/log.md`: presenza di `provider:` + counters.

### 6. Aggiorna meta-prompt a v2.10

Sezioni toccate nel `meta-prompt-llm-wiki-factory.md`:
- Intro — bump versione + nuovo principio v2.10 sui publisher adapters.
- §3 — struttura cartelle con `github-publisher.md`, `publisher-protocol.md`, `github-mapping.md`, `kanban-publish.md` (★ opzionali).
- §0 — nuovo input (`6-bis. Kanban publish target`).
- §5 — embedded PATTERN.md template aggiornato (nuova §17 Publisher + r.15 + ruolo + Publish verb + external_id).
- §6 — template agente `github-publisher` aggiunto.
- §7 — template skill `publisher-protocol` + `github-mapping` aggiunti.
- §10 — template comando `kanban-publish` aggiunto.

### 7. Crea documentazione wiki

- `wiki/runbooks/migration-v210.md` (questo file).
- `wiki/concepts/publisher-adapters.md` — concept del pattern (riferito da PATTERN §18 changelog v2.10).
- Update `META-PROMPTS-INDEX.md` con riga v2.10.
- Update `CLAUDE.md` e `README.md` con riferimenti a `github-publisher` + `/kanban-publish`.
- Update `wiki/index.md` con link alle nuove pagine.
- Append entry `migration` su `wiki/log.md`.

## Test di accettazione

- [ ] `PATTERN.md` dichiara `v2.10` in §0; contiene §17 (Publisher adapters) e §18 (Versioning bumpata).
- [ ] `factory.config.yaml` ha blocco `kanban_publish:` con `provider` valorizzato (`none` se non usato).
- [ ] Se `kanban_publish.provider != none`: `.claude/agents/<provider>-publisher.md` esiste + `.claude/skills/<provider>-mapping.md` esiste.
- [ ] `.claude/skills/publisher-protocol.md` esiste con 5 fasi (Bootstrap → Discovery → Plan/Gate → Publish → Log).
- [ ] `.claude/commands/kanban-publish.md` esiste con sub-comandi `show|set|run|dry-run`.
- [ ] `lint-checks.md` ha sezione "4f — Coerenza Publisher".
- [ ] `meta-prompt-llm-wiki-factory.md` dichiara v2.10 nel changelog e nell'embedded PATTERN.
- [ ] `meta-prompt-llm-wiki-factory-v2.9.md` esiste come snapshot.
- [ ] Una invocazione `/kanban-publish dry-run` (con `provider: github` configurato, `gh auth login` fatto, target valido) stampa un piano coerente con il contenuto di `management/kanban/`.
- [ ] Dopo `/kanban-publish run` (con conferma esplicita), gli artefatti pubblicati hanno `external_id: github:<num>` nel frontmatter; `wiki/log.md` ha entry `publish github created=N updated=M`.

## Rollback

1. `git reset --hard pre-v210-migration-2026-05-22` o revert dei commit di migrazione.
2. `rm .claude/agents/github-publisher.md .claude/skills/publisher-protocol.md .claude/skills/github-mapping.md .claude/commands/kanban-publish.md`.
3. Revert `PATTERN.md`, `factory.config.yaml` (rimuovi blocco `kanban_publish:`), `lint-checks.md`, `meta-prompt-llm-wiki-factory.md`, `CLAUDE.md`, `README.md`.
4. Le issue/milestone create sul provider esterno **restano aperte** sul provider — il rollback locale non le cancella (rispetto §7 r.15 "mai DELETE automatici"). L'umano decide se chiuderle a mano sul provider.
5. Il campo `external_id:` nei frontmatter di EP/US/TSK è opzionale: il rollback può lasciarlo (verrà ignorato in v2.9) o rimuoverlo a mano.

## Errori comuni

- **`kanban_publish.provider: github` ma `gh` CLI non installato** → publisher-protocol Fase 1 ABORT con "Installa gh CLI".
- **`gh auth status` fallisce** → ABORT Fase 1 con "Esegui `gh auth login` e riprova".
- **Target inesistente / 404** → ABORT Fase 1. Verifica `factory.config.yaml.kanban_publish.target`.
- **Token scaduto / 401** → ABORT Fase 4 al primo CREATE; rinnova il token.
- **Issue label inesistente sul repo** → `gh issue create` fallisce. `github-mapping` esegue pre-flight `gh label create ... --force` per `kanban:epic|story|task` + `layer:be|fe|db|qa|infra`.
- **Body troppo lungo per il provider** (GitHub limit ~65k chars) → troncamento con marker `[Body troncato — vedi file locale]` + WARNING in log.
- **Re-publish di un'issue cancellata a mano sul provider**: GET 404 → cancella `external_id:` locale, ricade in CREATE.
- **Milestone con stesso titolo ma `external_id` diverso** → SKIP con WARNING; risolvere manualmente (cancellare milestone duplicata o aggiornare `external_id`).
- **Conflitto cross-provider** (`external_id: jira:...` ma sub-agent attivo è `github-publisher`) → SKIP, segnala in chat.
- **Più di `batch_limit` operazioni in un solo run** → secondo gate letterale richiesto (es. digitare `publish 47`). Se l'utente nega → ABORT.

## Quando NON migrare

- **Team senza tool esterno di project tracking**: lasciare `provider: none` (default). La Factory funziona end-to-end senza publisher.
- **Knowledge-only o plan-only puro**: `kanban_publish` ha senso solo da v2.7+ con kanban popolato.
- **PoC ≤ 1 settimana**: l'overhead di configurare `kanban_publish` + mappare label/milestone non si ripaga.
- **Compliance vincola single tool**: se "tutto deve vivere in Jira", la Factory in `plan-only` + manual sync è più chiara del publisher push-only ambiguo.
- **Kanban con < 10 artefatti**: usa direttamente il tool esterno e skippa la Factory L3/L4. Il valore della Factory emerge a scala.

## Cross-reference

- Concept del pattern: [[publisher-adapters]].
- Pattern simmetrico (inbound L1): [[sync-adapters]] (v2.9).
- Migrazione precedente (v2.8 → v2.9, sync adapters): [[migration-v29]].
- Disciplina di scrittura per ruolo: [[write-scope]].
- Adapter Claude Code: `.claude/agents/github-publisher.md`, `.claude/skills/publisher-protocol.md`, `.claude/skills/github-mapping.md`, `.claude/commands/kanban-publish.md`.
