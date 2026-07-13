---
id: migration-v27
type: runbook
title: "Migrazione v2.6 → v2.7 (execution layer L5 + topology + stack modes)"
status: draft
created: 2026-05-20
updated: 2026-05-20
sources:
  - "PATTERN.md §1, §2, §3, §7 r.13, §13, §14, §15"
  - "meta-prompt-llm-wiki-factory.md (v2.7)"
  - "factory.config.yaml (template)"
related:
  - topology-and-dev-agents
  - migration-v26
  - migration-v22
  - thin-agents-fat-skills-refactor
tags: [runbook, migration, v2.7, topology, dev-agents, execution-layer, stack-mode]
---

# Migrazione v2.6 → v2.7 — execution layer L5, topology, stack modes

> Playbook riproducibile della migrazione applicata in data 2026-05-20 sul repo
> `soli-multi-agents-factory`. Versione precedente archiviata in
> `meta-prompt-llm-wiki-factory-v2.6.md`.

## Sintesi

| Voce | Prima (v2.6) | Dopo (v2.7) |
|---|---|---|
| Layer modello (PATTERN §1) | L1-L4 + memory | L1-L5 + memory (L5 opzionale, `code_path` può essere esterno al repo) |
| Ruoli (PATTERN §2) | 8 core | 8 core + 4 dev-agent opzionali (`be-dev`, `fe-dev`, `db-dev`, `qa-dev`) |
| Operazioni canoniche (§3) | 8 (Ingest, Query, Lint, Plan, Design, Execute, Promote, Heal, Propagate) | 10 (+ `Develop`, `Tech-scout`) |
| Frontmatter TSK (§5) | `id, sprint, team, priority, estimate, status` | `id, sprint, layer, consumer, priority, estimate, status` (`team` deprecato) |
| Regole inviolabili (§7) | 12 | 13 (+ r.13: topology + routing dichiarati e coerenti) |
| Config | nessuna (filesystem only) | `factory.config.yaml` al root (CONFIG, non stato — distinzione esplicita §8) |
| Topologie | implicita (sempre `plan-only`) | esplicite: `knowledge-only`, `plan-only`, `full-stack-agents`, `hybrid-be-agents`, `hybrid-fe-agents`, `custom` |
| Tech stack mode | implicito (manual) | `manual`, `guided`, `auto` (con skill `tech-scout`) |
| Skill `.claude/skills/` | 15 | 18 (+ `dev-protocol`, `dev-handoff`, `tech-scout` condizionali) |
| Agenti `.claude/agents/` | 9 (inclusi worker) | 9 core + 0..4 dev-agent secondo topologia |
| Commands `.claude/commands/` | 6 (`/run`, `/sync-docs`, `/query`, `/lint`, `/promote`, `/heal`) | + 2 condizionali (`/dev`, `/topology`) |
| Lint checks | 4 + 4b | 4 + 4b + 4c (coerenza topology v2.7) |
| Citazioni codice prodotto | non previsto | `[^src5: <code_path>/<path>:<line>]` (interno) o `[^src5-ext: <abs-path>:<line> @ <commit>]` (esterno) |

## Pre-condizioni

1. Pattern version corrente = v2.6.
2. Backup esistente: `meta-prompt-llm-wiki-factory-v2.6.md` archiviato accanto al canonical (snapshot creato 2026-05-20 durante questa migrazione).
3. Tag git suggerito: `pre-v27-migration-2026-05-20` (non richiesto, ma utile per rollback).
4. Lint pulito o solo WARNING (nessun ERROR pendente).

## Vincoli

- **Backward-compat per frontmatter TSK**: i TSK esistenti con `team:` restano validi; il `wiki-lint` emette WARNING `deprecated-field`. Non si fa migration automatica (umano migra manualmente quando tocca quei TSK, o lascia legacy).
- **Topology di default per repo esistenti**: se manca `factory.config.yaml` al momento dell'upgrade, scrivere uno con `topology: plan-only`, `code_path: ""`, `stack_mode: manual`, `routing.*: human`. Non rompe nulla; preserva il comportamento v2.6.
- **L5 path esterno**: se `code_path` è assoluto fuori dal repo, il dev-agent scrive lì senza che il framework crei la directory. Cita commit hash quando possibile (`[^src5-ext: ... @ <hash>]`).
- **Standards verbatim** (§11) preservati. La skill `tech-scout`, in modalità `auto`, **non sostituisce mai** uno standard normativo già citato in `raw/` o `wiki/`. Output è `.proposal`, gate umano obbligatorio.
- **Single-committer su wiki/** invariato (§7 r.12). I dev-agent appendono solo a `wiki/log.md` (entry `develop`) e a `wiki/gaps.md`; mai scrivono altrove in `wiki/`.

## Steps

### 1. Backup meta-prompt

```bash
cp meta-prompt-llm-wiki-factory.md meta-prompt-llm-wiki-factory-v2.6.md
```

(Già fatto in questo repo; archiviato 2026-05-20.)

### 2. Riscrivi `PATTERN.md` a v2.7

Sezioni toccate:
- §0 — bump versione a 2.7.
- §1 — aggiungi L5 (`<code_path>/`, può essere esterno al repo).
- §2 — aggiungi riga ruolo *Dev* nella tabella.
- §3 — aggiungi operazioni `Develop` e `Tech-scout`.
- §5 — frontmatter TSK: `team` deprecato → `layer` + `consumer`.
- §6 — citazione codice prodotto (`[^src5:` interno, `[^src5-ext:` esterno).
- §7 — aggiungi regola 13 (topology + routing dichiarati e coerenti).
- §8 — distinzione `factory.config.yaml` = config (non stato).
- §10 — aggiungi evento `Develop completato`.
- §13 (nuovo) — Topology & consumer routing.
- §14 (nuovo) — Tech stack modes.
- §15 (ex §13) — versioning.

### 3. Crea `factory.config.yaml` al root

Template minimo (vedi `factory.config.yaml` al root del repo):

```yaml
pattern_version: "2.7"
topology: plan-only      # o quello scelto
code_path: ""            # o path relativo o assoluto
stack_mode: manual
routing:
  be: human
  fe: human
  db: human
  qa: human
  infra: human
stack:
  backend: ""
  frontend: ""
  database: ""
  qa: ""
```

### 4. Scaffolda i dev-agent (se topology lo richiede)

Per topologie con dev-agent attivi: crea `be-dev.md`, `fe-dev.md`, `db-dev.md`, `qa-dev.md` in `.claude/agents/` secondo i template di §6 del meta-prompt v2.7. Per topology `plan-only` o `knowledge-only`: salta questo step (i dev-agent file non devono esistere — il `wiki-lint` check 4c segnala incoerenze).

### 5. Crea le skill v2.7

In `.claude/skills/`:
- `dev-protocol.md` — procedura `Develop` (5 fasi: gate, contesto, handoff iniziale, implementazione, DoD + handoff finale).
- `dev-handoff.md` — entry append-only su `wiki/log.md` a chiusura di un TSK.
- `tech-scout.md` — proposta stack via WebSearch (solo se `stack_mode: auto`, ma utile averla sempre disponibile per re-valutazioni a runtime).

### 6. Crea i commands v2.7

In `.claude/commands/`:
- `dev.md` — `/dev <TSK-id>` (solo se topology include dev-agent).
- `topology.md` — `/topology [show|set <topology>]` (solo se topology include dev-agent).

### 7. Aggiorna `tpm.md` + `scrivi-task.md`

- `tpm.md`: legge `factory.config.yaml` per `routing:` e applica `consumer: <routing[layer]>` come default sui nuovi TSK.
- `scrivi-task.md`: frontmatter TSK ora ha `layer:` (`be|fe|db|qa|infra`) + `consumer:` (`agent|human`). `team:` deprecato.

### 8. Aggiorna `lint-checks.md`

Aggiungi **Check 4c — Coerenza topology ↔ filesystem ↔ routing**:
- `routing.X: agent` ⇔ `<X>-dev.md` esiste in `.claude/agents/`.
- `topology:` valore ∈ tabella valida.
- TSK con `consumer: agent` ma layer senza dev-agent presente → WARNING `tsk-consumer-no-agent`.
- TSK con `team:` legacy → WARNING `deprecated-field`.

### 9. Aggiorna `CLAUDE.md` + `README.md`

- Bump version reference a v2.7.
- Aggiungi sezione **Configurazione factory** (link a `factory.config.yaml`).
- Aggiungi mapping ruoli per i 4 dev-agent.
- Aggiungi quick-start per `/dev` e `/topology`.

### 10. Append entry a `wiki/log.md`

```markdown
## YYYY-MM-DD HH:MM — migration v2.6 → v2.7
**Op:** migration (manual)
**Cambio:** L5 layer, topology selection, dev-agents, stack modes, factory.config.yaml
**File touched:** PATTERN.md, meta-prompt-llm-wiki-factory.md, factory.config.yaml,
.claude/agents/{be,fe,db,qa}-dev.md, .claude/skills/{dev-protocol,dev-handoff,tech-scout}.md,
.claude/commands/{dev,topology}.md, .claude/agents/tpm.md, .claude/skills/scrivi-task.md,
.claude/skills/lint-checks.md, CLAUDE.md, README.md
**Next:** documentation aggiornata (runbook + synthesis + META-PROMPTS-INDEX.md)
```

## Test di accettazione

- [ ] `PATTERN.md` dichiara `v2.7` in §0; contiene §13 (Topology) e §14 (Stack modes).
- [ ] `factory.config.yaml` esiste al root con tutti i campi obbligatori valorizzati.
- [ ] Se topology ∈ {`full-stack-agents`, `hybrid-*`, `custom` con dev}: tutti i `<X>-dev.md` corrispondenti a `routing.X: agent` esistono in `.claude/agents/`.
- [ ] Se topology è `knowledge-only` o `plan-only`: nessun dev-agent file in `.claude/agents/`.
- [ ] Skill `dev-protocol`, `dev-handoff`, `tech-scout` esistono se condizioni soddisfatte (topology con dev / `stack_mode: auto`).
- [ ] Commands `/dev` e `/topology` esistono se topology include dev-agent.
- [ ] `wiki-lint` check 4c eseguito: nessun ERROR `routing-missing-agent` o `orphan-dev-agent`.
- [ ] `scrivi-task` produce TSK con `layer:` + `consumer:` (e non più `team:`).
- [ ] `tpm.md` legge `factory.config.yaml` esplicitamente nella sua procedura.
- [ ] `meta-prompt-llm-wiki-factory.md` dichiara v2.7 nel changelog §12.
- [ ] `meta-prompt-llm-wiki-factory-v2.6.md` (snapshot) esiste per archeologia.

## Rollback (se necessario)

1. `git revert <commit-migration-v27>` OR `git reset --hard pre-v27-migration-2026-05-20`.
2. `rm factory.config.yaml`.
3. `rm .claude/agents/{be,fe,db,qa}-dev.md` (se creati).
4. `rm .claude/skills/{dev-protocol,dev-handoff,tech-scout}.md`.
5. `rm .claude/commands/{dev,topology}.md`.
6. Revert `PATTERN.md`, `tpm.md`, `scrivi-task.md`, `lint-checks.md`, `CLAUDE.md`, `README.md`, `meta-prompt-llm-wiki-factory.md` al v2.6.
7. I TSK già scritti con `layer:`+`consumer:` restano nei kanban — il `wiki-lint` v2.6 li ignora (riconosce solo `team:`). Non rompono nulla, ma sono effettivamente legacy.

## Errori comuni durante la migrazione

- **Dimentichi `factory.config.yaml`** → `wiki-lint` segnala `missing-config-file` (ERROR, manuale).
- **Topology dichiarata ≠ file presenti** → ERROR `routing-missing-agent` o `orphan-dev-agent`. Allinea o cambia topology.
- **`code_path` non valorizzato ma topology include dev-agent** → WARNING `dev-agents-without-code-path`. Definisci il path.
- **Dev-agent invocato su TSK senza `layer:`** → il dev-agent stesso STOP e segnala. Apri prima TPM per ri-taskizzare.
- **`tech-scout` scrive direttamente su `raw/tech_stack.md`** → violazione §7 r.1 (L1 read-only). Sempre output su `.proposal`, gate umano.

## Cross-reference

- Per la motivazione dietro le scelte di design (per-layer vs per-stack, filesystem-as-truth, `code_path` esterno): vedi `wiki/syntheses/topology-and-dev-agents.md`.
- Per la patch v2.6 (gate graduato + propagate): vedi `wiki/runbooks/migration-v26.md`.
- Per il principio "thin agents, fat skills" (v2.3): vedi `wiki/runbooks/thin-agents-fat-skills-refactor.md`.
- Per la migrazione storica v2.1 → v2.2: vedi `wiki/runbooks/migration-v22.md`.
