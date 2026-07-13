---
id: migration-v211
type: runbook
title: "Migrazione v2.10 → v2.11 (parallel scheduler DAG-driven)"
status: draft
created: 2026-05-22
updated: 2026-05-22
sources:
  - "PATTERN.md §5, §7 r.5/r.12/r.15, §18 (R.S1–R.S8), §19 (versioning)"
  - "meta-prompt-llm-wiki-factory.md (v2.11)"
  - "factory.config.yaml (blocco scheduler:)"
  - ".claude/agents/orchestrator.md"
  - ".claude/skills/parallel-scheduling.md"
  - ".claude/skills/state-scan.md (step 8.bis)"
  - ".claude/skills/ingest-protocol.md (cross-link §18)"
  - ".claude/skills/scrivi-task.md (frontmatter v2.11)"
  - ".claude/skills/scrivi-user-story.md (frontmatter v2.11)"
  - ".claude/skills/scrivi-epica.md (frontmatter v2.11)"
  - ".claude/skills/lint-checks.md (Check 4g)"
related:
  - parallel-scheduler
  - publisher-adapters
  - sync-adapters
  - migration-v210
  - migration-v29
  - parallelization
  - dependency-ordered-dag
  - write-scope
  - multi-agent-factory
tags: [runbook, migration, v2.11, scheduler, dag, parallelism, antichain, depends_on, code_path, frontmatter]
---

# Migrazione v2.10 → v2.11 — Parallel scheduler DAG-driven

> Playbook riproducibile della migrazione applicata in data 2026-05-22.
> Versione precedente archiviata in `meta-prompt-llm-wiki-factory-v2.10.md`.

## Sintesi

| Voce | Prima (v2.10) | Dopo (v2.11) |
|---|---|---|
| Ruoli §2 | 9 core + 0..4 dev + 0..N publisher | Invariati (Orchestrator esteso con dispatch parallelo) |
| Operazioni canoniche §3 | 11 (con `Publish` v2.10) | Invariate (lo scheduler dispatcha le 11 esistenti, non aggiunge verbi) |
| Frontmatter EP/US/TSK | `id`, `title`, `status`, `external_id`, … (v2.10) | + opzionali **`depends_on`** (EP/US/TSK), **`blocked_by`** esteso a TSK (era solo US), **`code_path`** (solo TSK) |
| Regole inviolabili §7 | 15 (r.15 cross-tool publish gate v2.10) | 15 + **8 regole scheduler R.S1–R.S8** (estensione runtime, attive solo se `scheduler.enabled: true`) |
| `factory.config.yaml` | `topology`, `code_path`, `vcs`, `stack_mode`, `routing`, `stack`, `kanban_publish` | + blocco **`scheduler:`** (`enabled`/`max_parallel`/`parallel_gate_threshold`/`code_path_conflict`/`empty_code_path_policy`/`domains`) |
| `.claude/agents/` | 8 core + 0..4 dev + 0..N publisher + `wiki-keeper-worker` (v2.4) | Invariati (Orchestrator esteso, nessun nuovo agente) |
| `.claude/skills/` | 20 (con `publisher-protocol` + `github-mapping` v2.10) | + **`parallel-scheduling`** (provider-agnostic, 5 fasi) = 21 totale |
| `.claude/commands/` | 10 (con `/kanban-publish` v2.10) | Invariati. `/run` esteso per invocare `parallel-scheduling` se ≥ 2 candidati. |
| Lint checks | 4 + 4b + 4c + 4d + 4e + 4f | + **4g** (coerenza scheduler/depends_on: cycle detection + drift body↔frontmatter + validation `code_path`/`blocked_by`/`scheduler:`) |
| Sezioni PATTERN.md | §0–§17 + Versioning §18 | §0–§17 + **§18 «Parallel scheduling»** + Versioning §19 (bumpato) |
| Domini parallelism attivi | 1 (ingest, hardcoded v2.4) | 5 attivi default (ingest/develop/lint/query/sync) + 3 opt-in (plan/design/publish off) |

## Pre-condizioni

1. Pattern version corrente = v2.10.
2. Backup: `meta-prompt-llm-wiki-factory-v2.10.md` archiviato accanto al canonical.
3. Tag git suggerito: `pre-v211-migration-2026-05-22`.
4. Lint pulito o solo WARNING.
5. Nessun TSK in `in-progress` (la migrazione tocca lo schema frontmatter dei TSK: meglio mondare lo sprint prima).

## Vincoli

- **`scheduler.enabled: true` è il default v2.11**. Repo che vogliono mantenere comportamento legacy seriale: settare esplicitamente `scheduler.enabled: false` nel `factory.config.yaml`. Nessun cambio comportamentale automatico.
- **Backward-compatibility totale sui frontmatter**: artefatti senza `depends_on` sono trattati come "no deps" → finiscono al level 0. TSK senza `code_path` sono serializzanti per default (`empty_code_path_policy: serial`). Nessuna migrazione di file esistenti richiesta.
- **Single-committer su `wiki/log.md` invariato** (§7 r.12): anche con N dev-agent in parallelo, l'Orchestrator appende le entry una alla volta (R.S1).
- **VCS sempre serializzato** (R.S8): `vcs-handoff` (§15) resta sequenziale, anche con dev-agent paralleli — preserva `git index lock` + gate umano §7 r.14.
- **`depends_on` body ↔ frontmatter**: il frontmatter prevale per lo scheduler; la sezione `## Dependencies` body diventa opzionale (documentazione human-readable). Lint Check 4g warna sul drift.
- **Mai parallelizzare `consumer: human`**: lo scheduler filtra solo `consumer: agent`. Gli umani restano single-threaded.

## Steps

### 1. Backup meta-prompt

```bash
cp meta-prompt-llm-wiki-factory.md meta-prompt-llm-wiki-factory-v2.10.md
```

### 2. Aggiorna `PATTERN.md` a v2.11

Sezioni toccate:
- §0 — bump versione 2.10 → 2.11, Origine estesa con "parallel scheduler basato su DAG di dipendenze frontmatter".
- §5 — nuovi campi opzionali documentati (`depends_on` su EP/US/TSK, `blocked_by` esteso a TSK, `code_path` solo TSK) con semantica formale.
- §18 nuova — **Parallel scheduling (DAG-driven)**: modello `E_dep ∪ E_conf`, algoritmo 3-step (build DAG → toposort + level grouping → graph-coloring partition), domini di parallelismo (§18.3), 8 regole inviolabili R.S1–R.S8 (§18.4), `factory.config.yaml.scheduler:` schema (§18.5), wave plan output (§18.6), anti-pattern (§18.7).
- §19 (ex §18) — Versioning con voce v2.11 in testa.

**Nota di numerazione**: §17 (Publisher adapters v2.10) resta intatta. §18 nuovo entra subito prima del Versioning (che diventa §19), seguendo il pattern storico (ogni nuova sezione si inserisce prima del Versioning, che bumpa di 1).

### 3. Estendi `factory.config.yaml`

Aggiungi blocco `scheduler:` dopo `kanban_publish:`:

```yaml
scheduler:
  enabled: true                    # false → comportamento pre-v2.11 (seriale)
  max_parallel: 4                  # cap fan-out per turno (R.S3)
  parallel_gate_threshold: 3       # ≥ N parallel → gate umano (R.S4)
  code_path_conflict: strict       # strict | warn | off
  empty_code_path_policy: serial   # serial (default) | parallel
  domains:
    ingest: true
    develop: true
    lint: true
    query: true
    plan: false
    design: false
    publish: false
    sync: true
```

Per repo che vogliono mantenere comportamento legacy: `enabled: false` esplicito.

### 4. Estendi gli schemi frontmatter delle skill kanban

Aggiorna i template in `.claude/skills/`:
- **`scrivi-task.md`**: aggiungi `depends_on: []`, `blocked_by: []`, `code_path: []` al frontmatter; mantieni `## Dependencies` body come documentazione opzionale; aggiungi nota su priorità frontmatter vs body per lo scheduler.
- **`scrivi-user-story.md`**: aggiungi `depends_on: []` con sezione che spiega differenza vs `blocked_by` (causale vs Q-block).
- **`scrivi-epica.md`**: aggiungi `depends_on: []` (lista EP prerequisite).

### 5. Crea adapter Claude Code (1 skill + edit di 3 file esistenti)

- **Nuovo**: `.claude/skills/parallel-scheduling.md` (fat, provider-agnostic, 5 fasi: Discovery → Build DAG → Toposort/Partition → Gate → Dispatch + Log; include esempio dry-run di calcolo wave su sprint da 5 TSK).
- **Edit**: `.claude/agents/orchestrator.md` (aggiungi scope `wave dispatch`, regole R.S1/R.S4/R.S6/R.S8 esplicite; nuova procedura `parallel-scheduling` invocata da `/run` se ≥ 2 candidati).
- **Edit**: `.claude/skills/state-scan.md` (nuovo step 8.bis "Parallel scheduler probe"; nuova heuristica 0 next-step "Wave dispatch" come priorità su single-step).
- **Edit**: `.claude/skills/ingest-protocol.md` (cross-link a §18; rispetto di `scheduler.max_parallel` con chunking se `N > max_parallel`; R.S1/R.S3/R.S7 esplicite per ingest paralleli — fan-out già presente v2.4, ora formalizzato).

Nessun nuovo comando: `/run` esistente diventa il punto d'ingresso del dispatch parallelo. Nessun nuovo agente: l'Orchestrator gestisce tutto.

### 6. Aggiorna `lint-checks` con Check 4g

Aggiungi sezione "4g — Coerenza scheduler/depends_on":
- Per ogni EP/US/TSK con `depends_on: [...]`:
  - Stesso prefisso (EP→EP, US→US, TSK→TSK); cross-tipo → ERROR `invalid-depends-on-type`.
  - Ogni `<id>` deve esistere; assente → WARNING `orphan-depends-on`.
  - Auto-riferimento → ERROR `self-depends-on`.
- **Cycle detection**: toposort sull'insieme; ciclo presente → ERROR `depends-on-cycle` con lista nodi (non `heal-eligible`).
- **Drift body ↔ frontmatter** (solo TSK): `## Dependencies` body contiene `TSK-XXX` non presente in `depends_on:` frontmatter (o viceversa) → WARNING `dependencies-drift`.
- **`code_path` validation** (solo TSK): glob vuoto → WARNING; overlap esatto fra TSK al level 0 → INFO informativo.
- **`blocked_by` su TSK** (esteso da US): `Q_NNN` orfano → WARNING; Q in `[RISOLTE]` ancora referenziata → WARNING `stale-blocked-by-tsk`.
- **`scheduler:` block coerenza**: validate `enabled` (bool), `max_parallel` (int ≥ 1), `parallel_gate_threshold` (int ≥ 1 e ≤ `max_parallel`), `code_path_conflict` ∈ `{strict,warn,off}`, `empty_code_path_policy` ∈ `{serial,parallel}`.

### 7. Aggiorna meta-prompt a v2.11

Sezioni toccate nel `meta-prompt-llm-wiki-factory.md`:
- Intro — bump versione + nuovo principio v2.11 sul parallel scheduler.
- §5 — embedded PATTERN.md template aggiornato (campi frontmatter v2.11) + nota.
- §7 — regole inviolabili: aggiunto blocco R.S1–R.S8 in coda al §7 (estensione runtime).
- §13 — schema `factory.config.yaml` esteso con blocco `scheduler:`.
- §18 nuova — embed dell'algoritmo + schema config + domini + anti-pattern.
- §19 — Versioning con voce v2.11.
- §7 (skill count) — bump da 20 a 21 (`+ parallel-scheduling`).
- §9 (test di accettazione) — bump `pattern_version: "2.11"` + presenza blocco `scheduler:`.
- §12 (changelog) — nuova riga **v2.11** in testa.

### 8. Crea documentazione wiki

- `wiki/runbooks/migration-v211.md` (questo file).
- `wiki/concepts/parallel-scheduler.md` — concept del pattern (riferito da PATTERN §19 changelog v2.11).
- Update `META-PROMPTS-INDEX.md` con riga v2.11 HEAD + spostamento v2.10 in archivio + naming convention v2.10 snapshot creato.
- Update `CLAUDE.md` con riferimenti al parallel scheduler v2.11 + nuovi domini + `wiki-keeper-worker` nel mapping ruoli.
- Update `README.md` con sezione **Stato attuale** che cita v2.11 + parallel scheduler.
- Update `wiki/index.md` con link a [[parallel-scheduler]] e [[migration-v211]].
- Append entry `migration` su `wiki/log.md`.

## Test di accettazione

- [ ] `PATTERN.md` dichiara `v2.11` in §0; contiene §18 (Parallel scheduling) e §19 (Versioning bumpato).
- [ ] `factory.config.yaml` ha blocco `scheduler:` con `enabled` valorizzato.
- [ ] `.claude/skills/parallel-scheduling.md` esiste con 5 fasi (Discovery → Build DAG → Toposort/Partition → Gate → Dispatch).
- [ ] `.claude/agents/orchestrator.md` cita esplicitamente R.S1–R.S8 + skill `parallel-scheduling`.
- [ ] `.claude/skills/state-scan.md` ha step 8.bis "Parallel scheduler probe" + heuristica 0.
- [ ] `lint-checks.md` ha sezione "4g — Coerenza scheduler/depends_on".
- [ ] `meta-prompt-llm-wiki-factory.md` dichiara v2.11 nel changelog e nell'embedded PATTERN.
- [ ] `meta-prompt-llm-wiki-factory-v2.10.md` esiste come snapshot.
- [ ] Su uno sprint con ≥ 2 TSK indipendenti, `/run` mostra un **wave plan** prima del dispatch.
- [ ] Con `scheduler.enabled: false`, `/run` torna al comportamento single-step pre-v2.11.

## Rollback

1. `git reset --hard pre-v211-migration-2026-05-22` o revert dei commit di migrazione.
2. `rm .claude/skills/parallel-scheduling.md`.
3. Revert `PATTERN.md` (rimuovi §18 nuova, ripristina §18 Versioning), `factory.config.yaml` (rimuovi blocco `scheduler:`), `lint-checks.md` (rimuovi Check 4g), `meta-prompt-llm-wiki-factory.md`, `CLAUDE.md`, `README.md`, `state-scan.md`, `orchestrator.md`, `ingest-protocol.md`, 3 skill kanban (`scrivi-task`/`scrivi-user-story`/`scrivi-epica`).
4. **I frontmatter v2.11 (`depends_on`/`blocked_by`/`code_path`) restano nei file EP/US/TSK**: in v2.10 sono ignorati. Nessuna perdita di dati; rimozione opzionale.
5. **Nessun side effect esterno**: lo scheduler non tocca tool esterni, non crea branch, non chiama API. Rollback puramente locale.

## Errori comuni

- **`depends_on` con cycle** (es. `TSK-A → TSK-B → TSK-A`) → ABORT con report dei nodi nel ciclo. Risolvere a mano (R.S5 non auto-fix).
- **`code_path` vuoto su TSK in sprint attivo** → con `empty_code_path_policy: serial` (default), il TSK è serializzante: viene dispatchato da solo. Per attivare il parallelismo: popolare `code_path` o settare `empty_code_path_policy: parallel` (sconsigliato in sprint con dev-agent multipli).
- **Glob overlap involontario** (es. `src/auth/**` vs `src/**`): lo scheduler segnala come conflict → serializza i due TSK. Strategia: restringere il glob (`src/api/v1/auth/**` invece di `src/auth/**`).
- **`max_parallel` troppo alto** (es. 10): rischio di rate-limit sulle API del runtime + saturazione del contesto. Default 4 è ragionevole; non superare 6 senza misurare.
- **Drift body ↔ frontmatter** (`## Dependencies` cita TSK non in `depends_on:`): lint Check 4g segnala. Frontmatter prevale per dispatch; sincronizzare a mano per evitare confusione human-readable.
- **Test di accettazione fallisce su sprint con 1 solo TSK**: lo scheduler short-circuita a dispatch diretto (no wave plan). È atteso, non un bug.
- **Multi-`Agent` call eccede il cap del runtime**: alcuni runtime impongono `max_concurrent_tool_calls`. Adattare `max_parallel` al runtime (Claude Code: testato fino a 4; oltre verificare).

## Quando NON migrare

- **Repo `knowledge-only` o `plan-only`**: lo scheduler è no-op (no `consumer: agent`). Migrazione cosmetica, può attendere.
- **Sprint con ≤ 2 TSK** in pipeline: l'overhead di configurare `depends_on` + `code_path` non si ripaga. Lo scheduler short-circuita comunque, ma il valore è nullo.
- **Team che vuole review one-by-one dei dev-agent output**: settare `scheduler.enabled: false` esplicito; oppure rimandare la migrazione finché il workflow umano si adatta al wave dispatch.
- **Topologia `custom` con un solo dev-agent attivo**: niente da parallelizzare nel dominio `develop`. Domini ingest/lint/query restano paralleli — vale comunque la pena migrare per `state-scan` step 8.bis.

## Cross-reference

- Concept del pattern: [[parallel-scheduler]].
- Pattern affini (gate umano v2.10): [[publisher-adapters]].
- Pattern affini (pluralism v2.9): [[sync-adapters]].
- Migrazione precedente (v2.9 → v2.10, publisher adapters): [[migration-v210]].
- Pattern teorico: [[dependency-ordered-dag]], [[parallelization]], [[orchestrator-workers]].
- Disciplina di scrittura per ruolo: [[write-scope]].
- Adapter Claude Code: `.claude/agents/orchestrator.md`, `.claude/skills/parallel-scheduling.md`, `.claude/skills/state-scan.md`, `.claude/skills/lint-checks.md` (Check 4g), `.claude/skills/scrivi-{task,user-story,epica}.md`.
