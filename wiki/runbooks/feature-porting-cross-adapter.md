---
type: runbook
status: draft
sources:
  - PATTERN.md
  - adapters/README.md
  - meta-prompts/README.md
created: 2026-06-03
updated: 2026-06-03
---

# Portare una feature cross-adapter — procedura v2.13+

Risolve il gap `adapter-porting-v216-non-claude` (2026-05-29).

Dalla v2.13 la factory supporta multi-adapter (`adapters/<name>/manifest.yaml`).
Le nuove feature vengono sviluppate sull'adapter Claude Code (`.claude/`) come
reference implementation, poi portate agli altri adapter. Questo runbook descrive
la procedura standard.

## Quando si usa

- Una milestone produce file in `.claude/` (skill, comandi, agenti, configurazione).
- Gli adapter `cursor/`, `aider/`, `openai/`, `gemini/`, `chatgpt/` (v2.13) non
  hanno equivalenti automatici di quei file.
- Si vuole portare la feature in uno o più adapter.

Caso concreto: la skill `premortem-protocol` e il comando `/premortem` esistono in
`.claude/` (v2.16) ma non in `adapters/cursor/`, `adapters/aider/`, ecc.

## Livelli di maturity degli adapter

| Adapter | Maturity v2.13 | Cosa ha |
|---|---|---|
| `.claude/` | full reference | tutto |
| `.cursor/` | full v2.13 | regole, agenti, comandi (formato Cursor) |
| `.aider/` | full v2.13 | conventions, skill-like files (formato Aider) |
| `.openai/` | partial | setup.py stub |
| `.gemini/`, `.chatgpt/` | manifest-only | solo `manifest.yaml` |

## Procedura (per ogni adapter target)

### Step 1 — Verifica compatibilità del concetto

Non tutto ciò che esiste in `.claude/` è portabile 1:1. Verifica:

- La feature usa tool specifici di Claude Code (es. `Agent`, `Skill`, `TodoWrite`)? → il porting richiede adattamento.
- La feature si basa su slash commands (`/nome`)? → ogni runtime ha la propria sintassi (Cursor: `/nome`, Aider: `--cmd`, OpenAI: function call…).
- La feature usa sub-agent? → Cursor e Aider hanno concetti analoghi ma con sintassi diversa.

### Step 2 — Leggi il manifest dell'adapter target

```
adapters/<name>/manifest.yaml
```

Il manifest dichiara: `runtime`, `supported_features`, `file_map` (come i path
`.claude/X` si mappano nell'adapter), e `notes` sulle limitazioni note.

### Step 3 — Porta i file secondo il `file_map`

| File `.claude/` | Mapping tipico |
|---|---|
| `.claude/skills/<skill>.md` | `.cursor/rules/<skill>.mdc` (Cursor) · `.aider/conventions/<skill>.md` (Aider) |
| `.claude/commands/<cmd>.md` | `.cursor/rules/<cmd>.mdc` con `/` trigger · comando Aider via `--read` |
| `.claude/agents/<agent>.md` | → omit se nessun equivalente runtime; documentare nel manifest |

Adatta il contenuto alla sintassi del runtime (rimuovi tool-call Claude Code,
sostituisci con gli equivalenti del target).

### Step 4 — Aggiorna il manifest dell'adapter

Aggiungi la feature portata a `supported_features` + note di eventuale degradazione
(es. «la Fase 4 fan-out di premortem è sequenziale in Cursor per assenza di
`Agent` tool; il cap 8 non si applica»).

### Step 5 — Aggiorna `meta-prompts/v2-XX` se il seed scaffolda la feature

Se il seed bootstrap della versione inclusa una Fase 1.quater opt-in (come v2.16
per la skill premortem), aggiungi le istruzioni di copia-file per l'adapter target
nella stessa Fase.

### Step 6 — Log e wikilink

Append a `wiki/log.md` con marker `porting <adapter> feature:<nome> — files: N`.
Aggiungi wikilink in `wiki/index.md` se è stato creato un nuovo runbook.

## Degradation policy (linea guida)

> Un porting con degradazione dichiarata è meglio di nessun porting.

Se il runtime target non supporta una funzionalità (es. fan-out parallelo), porta
la versione seriale documentando esplicitamente la limitazione nel manifest. Non
bloccare il porting per raggiungere la parità perfetta.

## Caso concreto — portare `premortem-protocol` su `.cursor/`

File da creare/adattare:
- `.cursor/rules/premortem-protocol.mdc` — la skill (5 fasi, adattata: Fase 4 diventa seriale, cap 8 → 1 round da 8 sequenziali)
- `.cursor/rules/premortem.mdc` — il comando dispatcher con trigger `/premortem`
- `management/risk-registry.md` — copiabile verbatim (format-agnostic)
- `adapters/cursor/manifest.yaml` — aggiornare `supported_features` + nota degradazione Fase 4

Stima: 2-4 ore per un adapter full (cursor/aider); 30 min per manifest-only (gemini/chatgpt).
