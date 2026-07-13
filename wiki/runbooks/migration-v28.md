---
id: migration-v28
type: runbook
title: "Migrazione v2.7 → v2.8 (VCS integration esplicita)"
status: draft
created: 2026-05-20
updated: 2026-05-20
sources:
  - "PATTERN.md §1, §3, §6, §7 r.14, §15, §16"
  - "meta-prompt-llm-wiki-factory.md (v2.8)"
  - "factory.config.yaml (template con vcs:)"
  - ".claude/skills/vcs-handoff.md"
related:
  - vcs-and-code-path
  - migration-v27
  - topology-and-dev-agents
tags: [runbook, migration, v2.8, vcs, submodule, git, code-path]
---

# Migrazione v2.7 → v2.8 — VCS integration esplicita

> Playbook riproducibile della migrazione applicata in data 2026-05-20.
> Versione precedente archiviata in `meta-prompt-llm-wiki-factory-v2.7.md`.

## Sintesi

| Voce | Prima (v2.7) | Dopo (v2.8) |
|---|---|---|
| Relazione factory ↔ code repo | implicita (path opaco) | esplicita (`vcs.mode`: monorepo / submodule / sibling / external / none) |
| Bump submodule ref | manuale (utente) | proposto da `vcs-handoff`, gate umano |
| Branch strategy | implicita (sempre HEAD corrente) | dichiarata (`shared` / `per-tsk` / `per-sprint`) |
| Reproducibilità code ↔ factory | solo via commit hash nel log | opzionale `.factory-lock` con `commit_coupling: pin` |
| Citazione codice prodotto | 2 formati (`[^src5:`, `[^src5-ext:`) | 3 formati (+ `[^src5-sub:` per submodule) |
| Regole inviolabili | 13 | 14 (+ r.14 VCS gate umano) |
| Operazioni canoniche | 10 | 10 (Develop esteso con Fase 5 invoca `vcs-handoff`) |
| Skill `.claude/skills/` | 18 | 19 (+ `vcs-handoff`, condizionale) |
| Lint checks | 4 + 4b + 4c | 4 + 4b + 4c + 4d (coerenza VCS) |
| Operazioni VCS automatiche | nessuna | nessuna (invariato: la skill propone, l'umano esegue) |

## Pre-condizioni

1. Pattern version corrente = v2.7.
2. Backup: `meta-prompt-llm-wiki-factory-v2.7.md` archiviato accanto al canonical (snapshot 2026-05-20).
3. Tag git suggerito: `pre-v28-migration-2026-05-20`.
4. Lint pulito o solo WARNING.

## Vincoli

- **Nessuna operazione VCS automatica** (PATTERN §7 r.14). `vcs-handoff` propone, l'umano esegue. Mai `git push`, `git clone`, `git submodule add` automatici.
- **Retrocompat per `develop` pre-v2.8**: le entry log esistenti senza `**VCS mode:**` non sono ERROR — il lint check 4d emette solo WARNING `develop-without-vcs-info`.
- **Default conservativi**: per repo esistenti che fanno upgrade senza dichiarare `vcs.mode`, default suggerito = `external` (preserva comportamento v2.7).
- **`.factory-lock` opzionale**: serve solo se `commit_coupling: pin`. Default `float` (no lock file).

## Steps

### 1. Backup meta-prompt

```bash
cp meta-prompt-llm-wiki-factory.md meta-prompt-llm-wiki-factory-v2.7.md
```

### 2. Aggiorna `PATTERN.md` a v2.8

Sezioni toccate:
- §0 — bump versione 2.7 → 2.8.
- §1 — riga L5 estesa con riferimento a `vcs.mode`.
- §3 — operazione `Develop` cita la skill `vcs-handoff` in Fase 5.
- §6 — terzo formato di citazione `[^src5-sub:` per submodule.
- §7 — regola 14 nuova (gate umano VCS).
- §13 — schema `factory.config.yaml` esteso con blocco `vcs:`.
- §15 (nuovo) — VCS integration: tabella mode, procedura per-mode, `.factory-lock`.
- §16 (ex §15) — versioning.

### 3. Estendi `factory.config.yaml`

Aggiungi blocco `vcs:` dopo `code_path:`:

```yaml
vcs:
  mode: <monorepo|submodule|sibling|external|none>
  # opzionali in base al mode
  submodule_path: ./code/       # solo mode=submodule
  remote_url: ""                # solo mode=submodule|sibling
  branch_strategy: shared       # shared | per-tsk | per-sprint
  commit_coupling: float        # pin | float
```

Per repo esistenti senza dev-agent: `vcs.mode: none`.
Per repo esistenti con dev-agent ma `code_path` opaco: `vcs.mode: external`.

### 4. Crea skill `vcs-handoff`

In `.claude/skills/vcs-handoff.md`. La skill ha 5 fasi:

- Fase 0 — Pre-condizioni (verifica coerenza `vcs.mode` ↔ `code_path`).
- Fase 1 — Branch (per `submodule`/`sibling` con `branch_strategy != shared`).
- Fase 2 — Commit per-mode (procedure diverse per `monorepo`/`submodule`/`sibling`/`external`).
- Fase 3 — `.factory-lock` (solo se `commit_coupling: pin`).
- Fase 4 — Log entry estesa su `wiki/log.md`.

Gate umano obbligatorio per ogni `git commit` (mai automatico).

### 5. Aggiorna `dev-protocol`

In Fase 5, dopo `dev-handoff`, aggiungi invocazione `vcs-handoff`:

```markdown
3. **Invoca `vcs-handoff`** (skill, v2.8) per coordinare i commit con la
   topologia VCS dichiarata in `factory.config.yaml.vcs.mode`.
```

### 6. Aggiorna `lint-checks` con check 4d

Aggiungi sezione "4d — Coerenza VCS" che verifica:
- `vcs.mode` ammesso (`none|monorepo|submodule|sibling|external`).
- Coerenza `vcs.mode` ↔ `code_path` (relativo per monorepo/submodule, assoluto per sibling/external, vuoto per none).
- Se `mode: submodule`: `.gitmodules` esiste e contiene `submodule_path`.
- Se `commit_coupling: pin`: `.factory-lock` esiste al root.
- `branch_strategy` ∈ `{shared, per-tsk, per-sprint}`.
- Entry `develop` recenti hanno `**VCS mode:**` (WARNING se assente, retrocompat).

### 7. Aggiorna `factory-bootstrap` (skill globale)

Sezione D-bis: chiede `vcs.mode` con domande follow-up condizionali per `submodule_path`, `remote_url`, `branch_strategy`, `commit_coupling`.

Step 4-bis: VCS bootstrap (stampa istruzioni, non esegue `submodule add` / `clone` automaticamente).

### 8. Crea documentazione

- `wiki/runbooks/migration-v28.md` (questo file).
- `wiki/syntheses/vcs-and-code-path.md` — articolo che racconta le 5 modalità + design decisions.
- Update `META-PROMPTS-INDEX.md` con riga v2.8.
- Update `CLAUDE.md` e `README.md` con sezione VCS.
- Update `wiki/index.md` con link alle nuove pagine.
- Append entry `migration` su `wiki/log.md`.

### 9. Aggiorna meta-prompt a v2.8

Sezioni toccate nel `meta-prompt-llm-wiki-factory.md`:
- Intro — bump versione + paragrafo VCS.
- §0 — aggiungi domanda VCS mode.
- §3 — struttura cartelle con `vcs:` block e `.factory-lock`.
- §5 — sintesi differenze v2.7 → v2.8.
- §5b — CLAUDE.md template con sezione VCS.
- §7 — skill template `vcs-handoff`.
- §8 — step 4-bis VCS bootstrap.
- §9 — check accettazione v2.8.
- §12 — riga changelog v2.8.

## Test di accettazione

- [ ] `PATTERN.md` dichiara `v2.8` in §0; contiene §15 (VCS integration).
- [ ] `factory.config.yaml` ha `vcs:` block con `mode:` valorizzato.
- [ ] Se `vcs.mode != none`: `.claude/skills/vcs-handoff.md` esiste.
- [ ] Se `vcs.mode: submodule`: `.gitmodules` esiste + entry per `submodule_path`.
- [ ] Se `commit_coupling: pin`: `.factory-lock` esiste (anche vuoto, header solo).
- [ ] `dev-protocol.md` Fase 5 cita `vcs-handoff`.
- [ ] `lint-checks.md` ha sezione "4d — Coerenza VCS".
- [ ] `meta-prompt-llm-wiki-factory.md` dichiara v2.8 nel changelog.
- [ ] `meta-prompt-llm-wiki-factory-v2.7.md` esiste come snapshot.
- [ ] Una invocazione `/dev <TSK-id>` su mode `monorepo` produce: codice + commit factory (con gate) + entry log con `**VCS mode: monorepo**`.

## Rollback

1. `git reset --hard pre-v28-migration-2026-05-20` o revert dei commit di migrazione.
2. `rm .claude/skills/vcs-handoff.md`.
3. Rimuovi blocco `vcs:` da `factory.config.yaml`.
4. Revert `PATTERN.md`, `dev-protocol.md`, `lint-checks.md`, `factory-bootstrap.md`, `meta-prompt-llm-wiki-factory.md`, `CLAUDE.md`, `README.md`.
5. Se esiste `.factory-lock`: `rm .factory-lock` (era opzionale).
6. I commit prodotti durante l'uso di v2.8 restano validi (sono git commit normali); solo i bump submodule via `vcs-handoff` non sono più riproducibili — ma il submodule resta funzionante.

## Errori comuni

- **`vcs.mode: monorepo` ma `code_path` assoluto** → ERROR `vcs-mode-mismatch`. Cambia mode o cambia code_path.
- **`vcs.mode: submodule` ma `.gitmodules` assente** → ERROR `missing-gitmodules`. L'utente deve lanciare `git submodule add` manualmente (bootstrap NON lo fa automaticamente).
- **`commit_coupling: pin` ma `.factory-lock` assente** → WARNING `missing-factory-lock`. Crea il file (anche solo header) o cambia a `float`.
- **Dev-agent committa codice ma `vcs-handoff` non viene invocato** → entry `develop` su log.md priva di `**VCS mode:**`. Il `dev-protocol` Fase 5 va corretto.
- **HEAD detached in submodule** → `vcs-handoff` fallisce in Fase 2. L'utente deve `git checkout <branch>` nel submodule prima di rilanciare il dev-agent.

## Quando NON migrare

- **Repo a vita breve / proof-of-concept**: v2.7 va benissimo, `code_path` opaco è accettabile.
- **Setup solo `knowledge-only` o `plan-only`**: v2.8 non aggiunge valore (mode = `none` di default).
- **Pipeline CI che assume topologia VCS fissa**: prima verifica che la pipeline supporti i commit cross-repo proposti da `vcs-handoff`.

## Cross-reference

- Sintesi tematica sulle 5 modalità VCS, design decisions, esempi reali: [[vcs-and-code-path]].
- Migrazione precedente (v2.6 → v2.7, execution layer L5): [[migration-v27]].
- Topology e dev-agent: [[topology-and-dev-agents]].
