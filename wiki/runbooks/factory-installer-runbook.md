---
title: Factory Installer — Runbook
status: stable
version: v2.21
updated: 2026-06-18
tags: [installer, bootstrap, onboarding, distribution]
---

# Factory Installer — Runbook

Guida operativa completa al sistema installer della Soli Multi-Agents Factory.
Copre tutti e tre gli scenari d'uso: distribuzione zip, installazione da repo, aggiornamento.

---

## Panoramica

Il **factory installer** è l'alternativa deterministica al seeding `/factory-bootstrap`.
Invece di far generare ogni file da un LLM, copia i file pre-costruiti nella cartella
di destinazione. Il risultato è identico; il tempo scende da ~15 minuti a ~5 secondi.

```
Seeding (LLM)        →  ~15 min, richiede IDE + Claude
Installer (zip)      →  ~5 sec, richiede solo Python 3.6+
```

Entrambi gli approcci restano validi e complementari:

| Scenario | Approccio consigliato |
|---|---|
| Prima esplorazione del framework | Seeding (`/factory-bootstrap`) |
| Onboarding nuovo membro del team | Installer (zip) |
| Setup su macchina senza accesso al repo | Installer (zip) |
| Pipeline CI/CD che scaffolda factory | Installer (zip o repo-local) |
| Personalizzazione topologia interattiva | Seeding |

---

## File coinvolti

```
installers/
  v2.21/
    build-dist.py   ← genera lo zip distribuibile (resta nel repo)
    setup.py        ← installer standalone (va dentro lo zip)
    install.py      ← installer repo-local (richiede il repo presente)
  README.md         ← reference rapido
dist/
  factory-installer-v2.21.zip   ← artefatto distribuibile (~670 KB)
```

---

## Scenario 1 — Distribuzione zip (consigliato)

### Passo 1 — Genera lo zip (una volta, chi mantiene il repo)

Dal repo factory, lancia:

```bash
python installers/v2.21/build-dist.py
```

Output: `dist/factory-installer-v2.21.zip` (~670 KB, 160 file).

Opzioni build:

```bash
# scegli una cartella di output diversa
python installers/v2.21/build-dist.py --output /tmp/releases

# anteprima senza scrivere
python installers/v2.21/build-dist.py --dry-run

# specifica il repo sorgente se non sei nella root
python installers/v2.21/build-dist.py --source /path/to/soli-multi-agents-factory
```

### Passo 2 — Distribuisci lo zip

Passa `factory-installer-v2.21.zip` al destinatario tramite:
- condivisione file (Teams, Slack, email, chiavetta USB)
- artefatto in un sistema CI (GitHub Actions, GitLab CI, Artifactory, …)
- storage condiviso (S3, SharePoint, Drive)

Lo zip è completamente self-contained: non richiede accesso al repo originale.

### Passo 3 — Installa la factory (destinatario)

**Prerequisito**: Python 3.6+ installato (`python --version` o `python3 --version`).

```bash
# decomprimi lo zip
unzip factory-installer-v2.21.zip -d factory-installer

# entra nella cartella
cd factory-installer

# installazione minimale (topology: knowledge-only, adapter: claude)
python setup.py --target /path/to/my-new-project

# installazione con opzioni
python setup.py \
  --target   /path/to/my-new-project \
  --name     "Nome Progetto"          \
  --topology full-stack-agents        \
  --adapters claude cursor

# anteprima senza scrivere nulla
python setup.py --target /path/to/my-new-project --dry-run
```

Su Windows il comando è identico (usa `python` al posto di `python3` se necessario):

```cmd
python setup.py --target C:\Projects\my-factory --name "My Factory" --topology knowledge-only
```

---

## Scenario 2 — Installazione da repo locale

Se il repo è già clonato sulla macchina:

```bash
python installers/v2.21/install.py --target ../my-new-project
```

Con opzioni:

```bash
python installers/v2.21/install.py \
  --target   ../my-project         \
  --name     "Nome Progetto"       \
  --topology full-stack-agents     \
  --adapters claude cursor

# repo in posizione non standard
python installers/v2.21/install.py \
  --source /path/to/soli-multi-agents-factory \
  --target /path/to/my-project
```

---

## Riferimento opzioni

Opzioni valide per entrambi `setup.py` e `install.py`:

| Flag | Default | Descrizione |
|---|---|---|
| `--target` | *(obbligatorio)* | Cartella di destinazione |
| `--name` | `my-factory` | Nome progetto in `factory.config.yaml` |
| `--topology` | `knowledge-only` | Vedi tabella sotto |
| `--adapters` | `claude` | Uno o più adapter (vedi tabella sotto) |
| `--dry-run` | `false` | Mostra le azioni senza scrivere file |
| `--force` | `false` | Sovrascrive file e cartelle esistenti |

Solo `install.py`:

| Flag | Default | Descrizione |
|---|---|---|
| `--source` | *(auto)* | Root del repo factory (rilevato automaticamente dalla posizione dello script) |

### Topologie

| Valore | Agenti attivi | Caso d'uso tipico |
|---|---|---|
| `knowledge-only` | nessuno | Solo wiki + kanban, team usa LLM manualmente |
| `plan-only` | nessuno | Epiche, storie, task ma nessun esecutore automatico |
| `full-stack-agents` | be/fe/db/qa/docs | Team che delega tutta la produzione agli agenti |
| `hybrid-be-agents` | be + db | Backend automatizzato, frontend manuale |
| `hybrid-fe-agents` | fe + qa | Frontend automatizzato, backend manuale |
| `custom` | da configurare | Routing manuale in `factory.config.yaml` |

### Adapter

| Slug | Cartella installata | Stato |
|---|---|---|
| `claude` | `.claude/` | Full — agenti, skill, comandi, tool, schema |
| `cursor` | `.cursor/` | Full — template rules `.mdc` + comandi |
| `aider` | `.aider/` | Full — template prompt + comandi shell |
| `openai` | `.openai/` | Partial — stub `setup.py` + orchestrator JSON |
| `gemini` | `.gemini/` | Manifest only |
| `chatgpt` | `.chatgpt/` | Manifest only |

---

## Struttura della factory installata

```
<target>/
  .claude/                    ← adapter Claude Code
  │  agents/                  ← 25 file: orchestrator, wiki-keeper, be-dev, fe-dev, …
  │  skills/                  ← 56 file: dev-protocol, caveman-protocol, …
  │  commands/                ← 28 file: /run, /dev, /review, /lint, …
  │  tools/                   ← script analytics, temporal, a11y, screenshot
  │  schemas/                 ← JSON schema (acceptance-spec, ecc.)
  │  settings.json
  .cursor/                    ← (solo se --adapters cursor)
  .aider/                     ← (solo se --adapters aider)
  PATTERN.md                  ← framework reference v2.21
  CLAUDE.md                   ← istruzioni progetto
  CHANGELOG.md                ← storico versioni
  factory.config.yaml         ← config generata dall'installer
  wiki/                       ← vuota
  raw/                        ← vuota
  management/kanban/          ← vuota
  memory/{episodic,semantic,procedural}/
  code_quality/rules/{canonical,emergent,team-specific}/
  code_quality/reports/
```

---

## Passi successivi dopo l'installazione

### 1. Configura `factory.config.yaml`

Apri `factory.config.yaml` e compila i campi essenziali:

```yaml
# Punta al repo del progetto
code_path: "/path/to/my-application"

# Dichiara lo stack
stack:
  backend: "Python / FastAPI"
  frontend: "React / TypeScript"
  database: "PostgreSQL"
  qa: "pytest / Playwright"
  infra: "Docker / GitHub Actions"
```

### 2. Lancia l'orchestrator

Apri la cartella target nel tuo IDE e lancia:

```
/run
```

L'orchestrator mostra il dashboard di stato e suggerisce il prossimo passo.

### 3. Abilita le feature opzionali (se necessario)

In `factory.config.yaml`:

```yaml
# Code quality review post-develop
code_quality:
  enabled: true

# Publish kanban su GitHub Issues
kanban_publish:
  provider: github
  target: "org/repo"
  auth_env: GH_TOKEN

# Token ledger (visibilità costi sessione)
analytics:
  token_ledger:
    enabled: true
```

---

## Aggiornare una factory esistente

Per aggiornare una factory installata alla versione corrente senza perdere le
personalizzazioni, usa il comando dedicato (non re-installare da zero):

```
/factory-upgrade [factory-path] --to=v2-21 --dry-run
/factory-upgrade [factory-path] --to=v2-21 --apply
```

Per sovrascrivere completamente (perdendo tutte le personalizzazioni):

```bash
python setup.py --target /path/to/existing-factory --force
```

---

## Rigenerare lo zip dopo modifiche al repo

Ogni volta che aggiorni agenti, skill o comandi nel repo, rigenera lo zip:

```bash
python installers/v2.21/build-dist.py
```

Lo zip in `dist/` viene sovrascritto. Distribuisci il nuovo artefatto al team.

---

## Troubleshooting

### `ERROR: source/.claude not found`

Stai eseguendo `setup.py` da una cartella sbagliata o lo zip è stato estratto
parzialmente. Verifica:

```bash
ls source/.claude   # deve esistere
```

Se la struttura è corrotta, re-estrai lo zip da zero.

### `ERROR: factory source not found`

Stai usando `install.py` o `build-dist.py` da fuori il repo e non hai passato
`--source`. Aggiungi:

```bash
--source /path/to/soli-multi-agents-factory
```

### Il file `.claude/` non è visibile su Windows Explorer

I file e cartelle che iniziano con `.` sono nascosti di default su Windows.
Attiva "Mostra file nascosti" in Esplora File → Visualizza → Opzioni.
Lo script Python li copia correttamente indipendentemente da questa impostazione.

### `python: command not found`

Prova `python3` al posto di `python`. Su alcuni sistemi i due comandi puntano
a versioni diverse. Verifica con:

```bash
python3 --version   # deve essere 3.6+
```

### La factory target esiste già

Di default l'installer non sovrascrive file esistenti (SKIP). Per aggiornare:

```bash
python setup.py --target /path/to/existing --force
```

---

## Versioning degli installer

Ogni cartella `installers/vX.YY/` corrisponde alla versione PATTERN per cui è
stata scritta. Lo zip installato riflette sempre lo stato dei file nel repo al
momento del build.

Per installare una versione precedente, fai checkout del tag corrispondente
prima di lanciare il build:

```bash
git checkout v2.20.0
python installers/v2.21/build-dist.py   # script v2.21, file sorgente v2.20
```

---

## Riferimenti

- [installers/README.md](../../installers/README.md) — reference rapido
- [PATTERN.md](../../PATTERN.md) — contratto agent-agnostic completo
- [wiki/getting-started/factory-installer-quickstart.md](../getting-started/factory-installer-quickstart.md) — guida rapida per nuovi utenti
- [wiki/runbooks/bootstrap-v213-procedure.md](bootstrap-v213-procedure.md) — procedura seeding (approccio alternativo)
