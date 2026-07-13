---
type: runbook
sources: ["raw/2026-05-27-meta-framework-v213-multi-adapter.md"]
status: draft
created: 2026-05-27
updated: 2026-05-27
tags: [v2.13, bootstrap, setup, multi-adapter, procedura, seed, portabilita]
---

# Bootstrap v2.13 — Procedura operativa

> Playbook per eseguire il bootstrap di una factory `llm-wiki++` v2.13:
> tre canali di accesso al seed, sette fasi di esecuzione, validazione con
> 28 check di accettazione, e configurazione multi-adapter.

## Contesto

Questo runbook si affianca al concept [[multi-adapter-scaffolding]] che descrive il
modello architetturale. Copre la dimensione operativa: come scegliere il canale di
accesso, quali input raccogliere, come eseguire le 7 fasi del seed v2.13, e come
verificare il risultato. [^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Procedura di setup v2.13]

Il seed v2.13 è il file `meta-prompts/v2-13/factory-bootstrap.md` nel repo
meta-framework. E' self-contained e portable: funziona indipendentemente dal runtime AI
usato per eseguirlo.

## Canale A — Claude Code (dispatcher locale)

Il comando `/factory-bootstrap nome /path/dest` invoca il dispatcher in
`~/.claude/commands/factory-bootstrap.md`, che carica il seed v2.13 come default.
Per usare versioni precedenti: flag `--version=v2-12` o `--version=v2-11`.
[^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Setup via Claude Code]

**Prerequisito**: il repo meta-framework deve essere clonato e il dispatcher installato
in `~/.claude/commands/`. Questo e' il percorso raccomandato per utenti Claude Code.

## Canale B — Qualunque AI agent (Cursor, OpenAI, Aider, Gemini, ChatGPT)

1. Fetch del seed v2.13 dal raw URL GitHub:
   `https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-13/factory-bootstrap.md`
2. Carica il seed come system prompt o file context nel runtime AI scelto.
3. Dichiara l'intent di bootstrap.

Il seed funziona indipendentemente dal runtime grazie alla tabella di conversione
(PATTERN §12 + adapter manifests). [^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Setup via qualunque AI agent]

**Prerequisito**: accesso rete al raw URL GitHub. Il seed e' ~470 righe / ~80KB,
compatibile con Opus 200K, GPT-4 128K, Sonnet 200K, Gemini 1M.

## Canale C — Offline / air-gapped

1. Pre-clona il repo meta-framework localmente.
2. Fornisci il path locale al seed al proprio agent runtime.
3. Il seed usa il clone come source invece dei raw GitHub URL.

**Prerequisito**: clone locale del repo disponibile. Utile per ambienti senza accesso
a Internet o per ci/cd pipeline isolate. [^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Setup offline]

## Le 7 fasi del seed v2.13

### Fase 1 — Setup

Parsing argomenti (`nome`, `path/dest`, flags opzionali `--version`, `--adapter`).
Verifica che il path destinazione sia accessibile e scrivibile. Verifica assenza di
conflitti con factory preesistenti nello stesso path.
[^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Bootstrap procedure (7 fasi)]

### Fase 2 — Input collection

Due percorsi: [^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Bootstrap procedure (7 fasi)]

- **Quick path** (raccomandato): scelta fra 5 archetipi predefiniti:
  - `knowledge-only` — solo wiki, nessun layer di esecuzione
  - `greenfield-full` — full stack con tutti i layer
  - `existing-monolith` — repo monolitico esistente con coupling mode
  - `microservices` — N backend con coupling per microservizio
  - `micro-frontend` — N frontend + 1+ backend shared

- **Linear path A→G** (scenari custom): domande esplicite su lingua, owner, topology,
  stack mode, standards, wiki feeding source, kanban publish, parallel scheduler,
  code quality review layer.

### Fase 2.bis — Adapter selection (NUOVO v2.13)

Multi-select fra adapter disponibili: `.claude/`, `.cursor/`, `.aider/`, `.openai/`,
`.gemini/`, `.chatgpt/`. Default raccomandato: `[claude]`.

Ogni adapter selezionato viene scaffoldato nella Fase 5 tramite la skill
`bootstrap-multiadapter-protocol`. Gli adapter non selezionati non vengono scaffoldati
e non consumano spazio nel repo. L'utente puo aggiungere adapter successivamente via
R.A5 (invocando `bootstrap-multiadapter-protocol` standalone).
[^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Bootstrap procedure (7 fasi)]

### Fase 3 — Multi-repo + coupling (condizionale)

Attivata solo se `wiki_feed_source: existing-repo`. Loop su N repository con
selezione del coupling mode per ognuno:

- `monorepo` — factory e repo codice nello stesso filesystem (al massimo 1 per factory, R.B6)
- `sibling-new-repo` — repo separato ma co-posizionato
- `submodule-new-repo` — submodule git (mai aggiunto automaticamente, §7 r.14)

[^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Bootstrap procedure (7 fasi)]

### Fase 4 — Read templates

Fetch dei template da GitHub (metodi A/B/C: git clone, curl, WebFetch) o da clone
locale (metodo D per offline). Template coperti: `PATTERN.md`, `CLAUDE.md`,
`README.md`, `factory.config.yaml`, strutture L1-L5, `memory/`, `code_quality/`.

### Fase 5 — Scaffolding

Scrittura di tutti i file nel path destinazione: [^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Bootstrap procedure (7 fasi)]

- Root files: `PATTERN.md`, `CLAUDE.md`, `README.md`, `factory.config.yaml`
- Directory L1-L5: `raw/`, `wiki/`, `management/`, `design_&_architecture/`, `code_path/`
- Side-channel: `memory/{episodic,semantic,procedural}/`, `code_quality/`
- Adapter folder(s) via `bootstrap-multiadapter-protocol` per ogni adapter selezionato

La skill `bootstrap-multiadapter-protocol` scaffolda gli adapter in parallelo
rispettando R.A1 (isolamento di cartella).

### Fase 6 — VCS bootstrap

Il seed **stampa** i comandi `git submodule add` ma **non li esegue** (§7 r.14: gate
umano per scritture VCS distruttive). L'utente li esegue manualmente dopo revisione.

Se `commit_coupling: pin`, viene generato il file `.factory-lock` con i commit SHA
da pinnare. [^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Bootstrap procedure (7 fasi)]

### Fase 7 — Validation + wiki feeding + report

**28 check di accettazione** verificano la factory scaffoldata: frontmatter corretto,
link interni validi, configurazione coerente con topology, adapter manifests presenti,
skill e agenti referenziati, etc.

**Wiki feeding** in base alla sorgente scelta:
- PDF: copia dei file in `raw/` + promemoria `/sync-docs`
- Figma: promemoria `/figma-sync <url>`
- Repo esistente: loop `/repo-sync` per ogni entry in `code_paths`

**Report finale**: tabella degli adapter installati con maturity, check passsati/falliti,
next steps raccomandati. [^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Bootstrap procedure (7 fasi)]

## Architettura del meta-prompt (thin orchestrator + 6 skill)

Il seed v2.13 applica la regola v2.3 «thin agents, fat skills» al meta-prompt stesso.
E' un orchestratore thin di ~470 righe che invoca 6 skill in sequenza:
[^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Architettura del meta-prompt]

| Skill | Responsabilita |
|---|---|
| `bootstrap-input-protocol` | Raccolta input + 5 archetipi |
| `bootstrap-multirepo-protocol` | Coupling multi-repo (R.B1-R.B6) |
| `bootstrap-multiadapter-protocol` | Adapter selection + scaffolding parallelo (R.A1-R.A6) |
| `bootstrap-scaffolding-protocol` | File + dir L1-L5 + adapter folder(s) |
| `bootstrap-vcs-protocol` | Submodule add stamps + `.factory-lock` |
| `bootstrap-validation-protocol` | 28 check accettazione + wiki feeding + report |

Le skill sono riusabili fuori dal bootstrap (es. futura skill `/retrofit-factory`
per aggiornare una factory v2.11 → v2.13).

## Checklist pre-bootstrap

- [ ] Scelto il canale (A/B/C) e verificati prerequisiti
- [ ] Path destinazione disponibile e scrivibile
- [ ] Archetipi esaminati — scelto quick path o linear path
- [ ] Adapter da installare identificati (default: solo `.claude/`)
- [ ] Per repo esistente: coupling mode per ogni repo definito

## Checklist post-bootstrap

- [ ] 28 check di accettazione tutti PASS
- [ ] Adapter folder(s) creati e manifests presenti
- [ ] `factory.config.yaml` con blocco `adapters:` corretto
- [ ] Comandi VCS eseguiti manualmente (se applicabile)
- [ ] Wiki feeding completato o pianificato

## Aggiornamento di una factory preesistente

Per aggiungere un adapter a una factory gia scaffoldata (R.A5):

1. Invocare `bootstrap-multiadapter-protocol` standalone con il nome dell'adapter.
2. La skill scaffolda solo la cartella del nuovo adapter rispettando R.A1.
3. Aggiornare `factory.config.yaml` blocco `adapters:` con il nuovo entry.
4. Eseguire la validazione (28 check) per verificare coerenza.

Per migrare da v2.12 a v2.13: rinviato a skill `/retrofit-factory` in roadmap v2.14.
[^src: raw/2026-05-27-meta-framework-v213-multi-adapter.md §Roadmap]

## Concetti correlati

[[multi-adapter-scaffolding]]
[[agent-agnostic]]
[[parallel-scheduler]]
[[sync-adapters]]
[[publisher-adapters]]
[[code-quality-review-layer]]

## Pagine collegate

[[2026-05-27-meta-framework-v213-multi-adapter]]

## Storie collegate
<!-- Sezione gestita dal product-manager — non modificare se sei wiki-keeper -->
