---
id: thin-agents-fat-skills-refactor
type: runbook
title: "Refactor thin-agents fat-skills (v2.2 → v2.3)"
status: draft
created: 2026-05-19
updated: 2026-06-25
sources:
  - "PATTERN.md"
  - ".claude/agents/"
  - ".claude/skills/"
tags: [refactor, runbook, agents, skills, framework, evoluzione]
pattern_section: "§2"
---

# Runbook — Refactor "thin agents, fat skills" (v2.2 → v2.3)

> Playbook riproducibile per il refactor che ha spostato le procedure ricorrenti
> dagli agenti (8 file) alle skill (da 7 a 13), lasciando negli agenti solo
> identità contrattuale (scope, trigger, modello) e i puntatori alle skill.

## Tesi

In un sistema multi-agente con scope di scrittura disgiunti, le **procedure**
(come scrivere una pagina, come citare, come loggare) sono ortogonali alle
**identità** (chi può scrivere cosa, su quale trigger, con quale modello). La
factory v2.2 le mescolava: ogni agente ripeteva la grammatica delle citazioni,
il formato dei log entry, il protocollo dei gap. Risultato: parafrasi
divergenti, costo di edit alto, leggibilità bassa.

La v2.3 separa i due piani: agenti sottili (identità + scope), skill grasse
(procedure canoniche). Pattern di riferimento:

- *Building Effective Agents* (Anthropic, dic 2024) — `keep agents thin, push
  procedures into reusable tools`
- *How we built our multi-agent research system* (Anthropic, mag 2025) —
  separazione per ruolo con scope ristretti, narrow context per subagent
- Single Responsibility Principle (Uncle Bob) applicato ai prompt: ogni file
  ha **una** ragione per cambiare

## Diagnosi iniziale

Le 6 procedure ricorrenti identificate nella codebase v2.2:

| # | Procedura | Duplicata in (v2.2) |
|---|---|---|
| 1 | Gap discovery & feedback loop | `lead-architect.md` (block full), `tpm.md` (rimanda), `wiki-keeper.md` (Fase 0) |
| 2 | Grammatica citazioni (`[^src:]`, `[[…]]`, soglia 20 parole) | `wiki-keeper.md`, `wiki-query.md`, `scrivi-wiki-page.md`, `lint-checks.md`, `scrivi-epica.md`, `scrivi-user-story.md` |
| 3 | Template log entry per tipo operazione | `ingest-protocol.md`, `wiki-query.md`, `lint-checks.md`, `orchestrator.md` |
| 4 | Operazione `/promote` | `orchestrator.md` (10 righe inline) |
| 5 | State scan dei 4 layer | `orchestrator.md` (6 righe inline) |
| 6 | Procedura Query | `wiki-query.md` (5 righe inline) |

## Architettura target

### Skill canoniche nuove (3, read-only reference)

- `citation-rules` — grammatica unica di `[^src:]`, `[[…]]`, soglia 20 parole,
  cascade per layer, anti-pattern
- `wiki-log-entry` — template canonici per ogni tipo di operazione (ingest,
  query, lint, promote, plan, design, execute, bootstrap, policy)
- `wiki-gap-protocol` — formato gap canonico + ciclo apertura/pickup/chiusura
  + bloccante/non-bloccante + scope di scrittura

### Skill procedurali nuove (3, playbook autonomi)

- `promote-status` — transizioni legali + edit meccanico frontmatter +
  refusal cases
- `state-scan` — scan 4 layer + gate + heuristica next-step + episodic memory
- `query-protocol` — bootstrap → candidate pages → sintesi → persistenza →
  log → proposta synthesis (simmetrico a `ingest-protocol`)

### Skill esistenti (7, snellite)

Ognuna referenzia le canoniche invece di duplicare le regole:
- `ingest-protocol` → riferisce a `wiki-gap-protocol`, `wiki-log-entry`, `citation-rules`
- `lint-checks` → riferisce a `citation-rules` (def. di claim non citato), `wiki-log-entry`
- `scrivi-wiki-page` → riferisce a `citation-rules`, `wiki-gap-protocol`
- `scrivi-epica`, `scrivi-user-story`, `scrivi-task` → riferiscono a `citation-rules`
- `apri-question` → invariata (autonoma e già focalizzata)

### Agenti (8, snelliti a identità + scope + skill refs)

Ogni agente conserva: **identità contrattuale** (`name`, `model`, `tools`),
**scope** (read/write paths inviolabili), **trigger** (cosa lo invoca),
**puntatori alle skill** che ne descrivono il "come". Le regole specifiche del
ruolo (non procedurali) restano nell'agente — es. wiki-keeper "mai leggere i
PDF direttamente", lead-architect "gerarchia delle fonti", tpm "atomicità task".

## Procedura (5 step + 2 di documentazione)

L'ordine seguente è progettato per essere **reversibile** ad ogni step. Si può
fermare in qualsiasi punto senza rompere la factory.

### Step 1 — Crea le 3 skill canoniche read-only

Crea `citation-rules`, `wiki-log-entry`, `wiki-gap-protocol`. Nessun agente o
skill le referenzia ancora. Zero impatto operativo.

**Test di sanità**: invoca `wiki-keeper` su un ingest sample. Nessun
comportamento osservabile cambia (le skill nuove non sono ancora linkate).

### Step 2 — Snellisci le skill esistenti

Modifica `ingest-protocol`, `lint-checks`, `scrivi-wiki-page`, `scrivi-epica`,
`scrivi-user-story`, `scrivi-task` per **rimandare** alle canoniche invece di
duplicare regole. Esempio prima/dopo (frammento `lint-checks.md`):

**Prima**:
```
## Check 2 — Claim senza fonte
Per ogni wiki/**/*.md:
- Identifica frasi affermative ≥ 20 parole che NON sono dentro un blocco
  YAML, header markdown o lista di TODO.
- Per ognuna: verifica che entro 3 righe ci sia un [^src: …] o un [[…]].
- Assenza → WARNING unsourced-claim.
```

**Dopo**:
```
## Check 2 — Claim senza fonte
Vedi `citation-rules` per la definizione canonica.
Procedura:
- Per ogni wiki/**/*.md, identifica claim secondo citation-rules.
- Verifica adiacenza citazione (entro 3 righe).
- Assenza → WARNING unsourced-claim.
```

**Test di sanità**: la regola operativa è identica (la skill rimanda); il
comportamento osservabile non cambia.

### Step 3 — Crea le 3 skill procedurali

Crea `promote-status`, `state-scan`, `query-protocol`. Ancora nessun agente
le referenzia: le skill esistono ma sono "dormienti".

### Step 4 — Snellisci gli 8 agenti

Modifica gli agenti referenziando le skill invece di descrivere le procedure
inline. Esempio prima/dopo (frammento `orchestrator.md`):

**Prima** (46 righe, di cui ~25 procedura inline):
```
## Procedura
1. State scan: Glob raw/*.pdf + Read raw/.extraction-manifest.json → L1 status.
2. Read wiki/log.md (ultima entry per tipo) + count wiki/**/*.md → L2 status.
3. Read wiki/gaps.md → count gap aperti.
4. Glob management/kanban/EP-*/EP-*.md + Read management/questions.md → L3.
5. Read design_&_architecture/be_architecture.md + Glob TSK-*.md → L4 status.
6. Read ultimo file in memory/episodic/ per continuità.

## Operazione /promote
Quando l'umano invoca /promote <path> [<new-status>]:
1. Read della pagina target.
2. Estrai status: corrente dal frontmatter.
[... +8 righe]
```

**Dopo** (36 righe, di cui ~5 procedura):
```
## Procedura
- Dashboard di stato + suggerimento next-step + episodic memory: vedi state-scan
- Operazione /promote: vedi promote-status
- Log entry: vedi wiki-log-entry
```

Ordina i commit per minimizzare il blast radius: prima gli agenti read-only
(orchestrator, wiki-lint, wiki-query), poi i writer (wiki-keeper, PM, Arch, TPM).

**Test di sanità**: per ogni agente, simula mentalmente il trigger principale
e verifica che la skill referenziata copra il "come". Se manca qualcosa,
torna allo Step 2 o 3 e completa la skill.

### Step 5 — Verifica end-to-end

- `grep -l "citation-rules\|wiki-log-entry\|wiki-gap-protocol"` su agenti e
  skill: ogni agente che scrive deve referenziare almeno una delle canoniche.
- `wc -l .claude/agents/*.md`: agenti tipicamente 27-55 righe.
- Esecuzione reale di un workflow completo (es. ingest di un nuovo PDF) per
  validare che le skill referenziate siano sufficienti.

### Step 6 — Documenta in wiki

Crea questo runbook (sei qui). Append a `wiki/log.md` un'entry per ogni step
significativo, secondo il template `policy` o `docs` di `wiki-log-entry`.

### Step 7 — Aggiorna il meta-prompt

Riscrivi `meta-prompt-llm-wiki-factory.md` per riprodurre la v2.3: la lista
skill passa da 7 a 13, i template degli agenti diventano più sottili, il
PATTERN.md cambia di micro (bump versione, voce changelog).

## Effetti collaterali

### Numeri (delta v2.2 → v2.3)

| Asse | v2.2 | v2.3 |
|---|---|---|
| File agenti | 8 | 8 (invariato) |
| Righe totali agenti | ~280 | 311 (+11%, ma molto più focalizzato) |
| File skill | 7 | 13 (+86%) |
| Righe totali skill | ~470 | 1032 (+120%, ma single-source-of-truth) |
| Procedure duplicate | 6 procedure × ~3-6 luoghi = ~25 duplicazioni | 0 (ogni procedura vive in 1 skill) |
| Mass totale `.claude/` | ~750 righe | ~1340 righe |

La massa totale **cresce**, ma il **costo di edit** crolla: modificare la
grammatica delle citazioni costa 1 edit (oggi era 6 edit con rischio di
drift). Modificare il template di log entry costa 1 edit (oggi era 5 edit).

### Portabilità agent-agnostic

La separazione **migliora** la portabilità verso altri runtime (Cursor,
OpenAI Assistants, Aider). Le skill sono **procedure descritte in markdown**,
non costrutti di Claude Code. Un adapter `.cursor/` può riusare le 13 skill
1:1, scrivendo solo i suoi 8 file agente nel formato Cursor. È un guadagno
diretto per `PATTERN.md §12 — Adapter (runtime-specific)`.

## Trade-off accettati

- **Più file**: 13 skill invece di 7. Mitigation: naming `<verbo>-<oggetto>` o
  `<dominio>-<azione>` per scopri-via-`ls`. La description nel frontmatter
  agisce come tooltip.
- **Indirection in più**: leggere un agente non basta più, serve aprire la
  skill referenziata per la procedura completa. Mitigation: le skill sono
  brevi (45-130 righe) e auto-contenute; l'agente resta abbastanza
  esplicativo per capire il "cosa".
- **Rischio di skill orfana**: una skill non più referenziata da nessun agente
  resta nel filesystem. Mitigation: `wiki-lint` Check 1 (orphan) può essere
  esteso in futuro per coprire anche `.claude/skills/`.

## Verifica retroattiva

Dopo il refactor, il `wiki-lint` deve passare pulito:
- Check 1 (wikilink): nessun link rotto sulle pagine wiki (il refactor non
  tocca `wiki/`, solo `.claude/`)
- Check 2 (claim senza fonte): non applicabile a `.claude/` (le skill non
  hanno claim citazionali, sono procedure)
- Check 3 (integrità kanban): non applicabile (refactor non tocca `management/`)
- Check 4 (coerenza wiki ↔ kanban): non applicabile

Verifica supplementare specifica al refactor:
- Ogni agente referenzia almeno una skill canonica (read-grep)
- Ogni skill canonica è referenziata da almeno un agente (no orphan skill)
- Nessun agente duplica regole già in skill canonica

## Pagine collegate

- [[migration-v22]] — il refactor precedente (P0/P1/P2 → v2.2)
- [[llm-wiki-pattern]] — sostrato karpathy alla base
- [[agent-agnostic]] — principio architetturale fondante (rinforzato dal refactor)
- [[multi-agent-factory]] — pattern multi-agente che il refactor preserva

## Tabella ruoli corrente §2 (v2.21 — aggiunto 2026-06-25)

> Sezione aggiunta per allineamento §2 PATTERN v2.21 (semantic drift fix, score 0.63→target 0.82).
> Il refactor descritto nel corpo della pagina portò alla separazione thin-agents/fat-skills
> che è ora codificata in §2. Questa sezione riporta la tabella normativa corrente.

**Principio §2**: `wiki/` è **read-universal** (ogni agente la legge), **write-restricted**
(solo wiki-keeper scrive contenuto; eccezioni puntuali nella colonna Scrive). Tutti gli agenti
L3+ possono e devono leggere `wiki/` per contesto, anche se la loro citazione formale
segue il cascade di layer.

| Ruolo | Legge | Scrive | Trigger |
|---|---|---|---|
| **Orchestrator** | tutto (read-only) | `memory/episodic/**`, `wiki/log.md`, eccezione: edit `status:` frontmatter di `wiki/**/*.md` (operazione `/promote`) | richiesta dashboard di stato; comando `/promote` |
| **Sync** (`sync-docs`, `figma-sync`, `repo-sync`, …) — un sub-agent per sorgente (§16) | input di propria competenza (PDF locali, URL/`file_key` Figma, repo esterno, …) | `raw/**` nel proprio scope di naming (§4): `sync-docs` → `*.txt` + `images/*-fig-NN.md`; `figma-sync` → `*.kb.json` + `images/*-frame-NN.{png,md}`; `repo-sync` → `*.md` descrittivo nel formato `raw/YYYY-MM-DD-repo-<slug>.md`. Tutti scrivono `raw/.extraction-manifest.json` (append-only per chiave) | nuovo input nella sorgente del sub-agent |
| **Analyst** (`wiki-keeper`) | `raw/**` (`.txt`, `.kb.json`, `images/**/*.md`), `raw/tech_stack.md`, `memory/**`, `wiki/**` (rilegge per cross-link + `wiki/gaps.md` all'inizio di ogni ingest) | `wiki/**` (escluso `query/`, `lint/`) + append `wiki/log.md` | L1 aggiornato OR gap aperti OR `heal-eligible` nel lint report (operazione `Heal`, §3) |
| **PM** (`product-manager`) | `wiki/**`, `memory/**` | `management/kanban/EP-*/**`, `management/{roadmap,questions}.md`, **append-only**: `wiki/gaps.md` + sezione `## Storie collegate` di pagine wiki impattate | L2 aggiornato |
| **Arch** (`lead-architect`) | `management/kanban/**`, `management/questions.md`, `raw/tech_stack.md`, `factory.config.yaml`, `memory/**`, `wiki/**` (contesto) | `design_&_architecture/**`, **append-only**: `wiki/gaps.md` + (opzionale, se `stack_mode: auto`) `raw/tech_stack.md.proposal` via skill `tech-scout` | L3 OK + gate questions resolved |
| **TPM** (`tpm`) | `design_&_architecture/**`, `management/kanban/**`, `raw/tech_stack.md`, `factory.config.yaml`, `memory/**`, `wiki/**` (contesto) | `management/kanban/**/TSK-*.md` (con campi `layer:` e `consumer:` derivati dal routing §14), `management/kanban/sprint.md`, **append-only**: `wiki/gaps.md` | L4 architettura OK |
| **Query** (`wiki-query`) | `wiki/**` (esclusivo) | `wiki/query/` (opt-out con `--ephemeral`) + append `wiki/log.md` | domanda NL |
| **Lint** (`wiki-lint`) | `wiki/**`, `management/kanban/**`, `design_&_architecture/**`, `factory.config.yaml` | `wiki/lint/` + append `wiki/log.md` | richiesta health check |
| **Dev** (`be-dev`, `fe-dev`, `db-dev`, `qa-dev`) — opzionali (topologia §14) | `management/kanban/**/TSK-*.md` (filtrato per `layer:` proprio + `consumer: agent`), `design_&_architecture/**`, `raw/tech_stack.md`, `factory.config.yaml`, `<code_path>/**`, `wiki/**` (contesto) | `<code_path>/**` (path da `factory.config.yaml`), **append-only**: `wiki/log.md` (entry `develop`), `wiki/gaps.md` (se gap), `management/kanban/**/TSK-*.md` **solo per `status:` e `updated:`** (handoff: `todo → in-progress → done`, MAI editare il corpo) | TSK con `consumer: agent` + `layer:` corrispondente + `status: todo` + dipendenze risolte; OR comando manuale `/dev <TSK-id>` |
| **Publisher** (`github-publisher`, `gitlab-publisher`, …) — opzionali (§17) — un sub-agent per provider | `management/kanban/EP-*/**`, `management/kanban/sprint.md`, `management/{roadmap,questions}.md`, `factory.config.yaml`, `memory/**` | **append-only**: `wiki/log.md` (entry `publish`); **modifica del solo `external_id:` frontmatter** di `EP-*/US-*/TSK-*.md` (mai del corpo); chiamate read+write verso provider esterno via CLI/API dedicate | comando esplicito `/kanban-publish run` OR (in modalità auto, gate umano) trigger su nuovo TSK con `status: todo` + provider != `none` |
| **Code Reviewer** (`code-reviewer`) — opzionale (v2.12, §19) | TSK con `status: done` + `review_status: pending` (filtrato per `consumer: agent`), `<code_path>/**` (read-only — diff/file toccati), `code_quality/rules/**`, `factory.config.yaml`, `wiki/**` (contesto), `memory/**` | `code_quality/reports/**` (report machine-readable + digest umano-leggibile), **append-only**: `wiki/log.md` (entry `review TSK-ZZZ iter-N → <verdict>`); **modifica del solo `review_status:`/`review_iter:`/`review_report:` frontmatter** di `TSK-*.md` (mai del corpo); opzionale (gate umano): `code_quality/rules/emergent/**` come bozze candidate | TSK con `consumer: agent` + `status: done` + `review_status: pending` + `code_quality.enabled: true`; OR comando esplicito `/review <TSK-id>` |
| **Ingest worker** (`wiki-keeper-worker`) — sub-agent di Analyst (v2.4) | sottoinsieme di `raw/**` assegnato dall'Analyst per batch paralleli | nessuno (la scrittura su `wiki/` resta serializzata sull'Analyst — single-committer) | delegazione dall'Analyst su batch ≥ 3 nuovi raw |

> Per la versione storicamente prodromica a questa tabella, vedi il corpo di questa pagina
> (refactor v2.2→v2.3): il refactor "thin agents, fat skills" ha separato le procedure
> dagli scope di scrittura, rendendo lo scope dichiarabile in modo compatto come nelle
> colonne Legge/Scrive sopra.
