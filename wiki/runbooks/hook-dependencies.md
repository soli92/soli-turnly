---
id: hook-dependencies
type: runbook
title: Hook dependencies — setup, fail-closed, troubleshooting
status: draft
created: 2026-05-15
updated: 2026-05-15
sources: []
tags: [runbook, hooks, setup, dependencies, operations]
---

# Hook dependencies — setup, fail-closed, troubleshooting

Runbook operativo per la gestione delle dipendenze runtime degli hook
deterministici del framework. Sostituisce le note di setup contenute in
[[bootstrap-record-2026-05-14]] dopo l'hardening P0 documentato in
[[2026-05-15-p0-silent-guardrail-degradation]].

## Cosa serve

Le dipendenze sono pinned a root in [^code: requirements.txt:1]
(agent-agnostic, non sotto `.claude/` o `.cursor/`). Il pinning è
intenzionalmente conservativo — major version range — per garantire
riproducibilità anche tra macchine diverse degli sviluppatori.

| Dipendenza | Versione | Usata da |
|---|---|---|
| `python3` | ≥ 3.8 | tutti gli hook (parsing + glob match + JSON Schema validation) |
| `pyyaml` | `>=6.0,<7.0` | `validate_frontmatter`, `enforce_promotion_pipeline`, `enforce_write_scope` |
| `jsonschema` | `>=4.21,<5.0` | `validate_frontmatter` |
| `jq` | qualunque | `emit_run_log` e parsing payload in tutti gli hook |
| `bash` | qualunque | tutti gli hook (no `globstar`, no associative array, no `bash 4+`) |

## Installazione

Sequenza standard al primo setup della macchina di sviluppo:

```bash
# Python deps (user-level install per evitare sudo)
pip3 install --user -r requirements.txt

# jq, se non presente
# macOS
brew install jq
# Debian / Ubuntu
sudo apt-get install -y jq

# Verifica
.claude/hooks/validate_hooks.sh
```

L'ultimo comando esegue manualmente lo health-check che il framework lancia
in automatico al SessionStart di Claude Code. Exit 0 = OK, exit 2 = qualcosa
manca e il messaggio diagnostico spiega cosa.

## Policy fail-closed (vincolo costituzionale)

Tutti gli hook che dipendono da una libreria esterna **rifiutano la write**
con `exit 2` e un messaggio di errore contenente il comando di installazione
quando la dipendenza manca. Mai `exit 0` silente. Questo invariante è
dichiarato a livello costituzionale in [^code: constitution.md:65] e nasce
direttamente dal post-mortem [[2026-05-15-p0-silent-guardrail-degradation]].

Razionale: un guard-rail che si auto-disabilita su input non previsti crea
la falsa percezione di essere attivo. Il sistema continua a comportarsi come
se la difesa fosse operativa mentre in realtà ogni write passa indisturbato.
Il pattern è classificato come anti-pattern in
[[2026-05-15-p0-silent-guardrail-degradation]].

## Health-check automatico (SessionStart)

Il SessionStart hook è collegato in [^code: .claude/settings.json:4] e punta
a [^code: .claude/hooks/validate_hooks.sh:1]. La sua implementazione è
minimal e non ha dipendenze proprie oltre a `command -v` e `python3 -c
"import X"` per ciascun modulo richiesto.

Il check è in due fasi: (a) dipendenze runtime (jq, python3, pyyaml,
jsonschema); (b) **static syntax check** con `bash -n` su tutti gli script
in `.claude/hooks/`. La fase (b) è stata aggiunta dopo il Bug 4 documentato
in [[2026-05-15-p0-silent-guardrail-degradation]]: cattura preventivamente
pattern fragili (es. escape-apostrofo dentro heredoc-in-cmdsub) prima che
un hook con syntax error fallisca a runtime in modalità fail-open.

Output tipico quando tutto è OK: `exit 0`, nessun messaggio. Output tipico
quando manca qualcosa: lista dei moduli mancanti oppure dei hook con
errore di sintassi, comando di install / istruzioni di fix, puntatore al
constitution per il razionale del fail-closed.

## Troubleshooting

### "pyyaml is required but is not installed"

Il messaggio appare su stderr quando uno dei tre hook prova a parsare YAML
senza la libreria disponibile. Soluzione: `pip3 install --user pyyaml` (oppure
ri-eseguire `pip3 install -r requirements.txt`). Verificare con
`python3 -c "import yaml; print(yaml.__version__)"`. Se il modulo è installato
ma il messaggio persiste, potrebbe esserci un interprete `python3` diverso nel
`PATH` rispetto a quello usato da `pip3`.

### "jsonschema is required but is not installed"

Stesso pattern del caso `pyyaml`. La libreria serve solo a
[^code: .claude/hooks/validate_frontmatter.sh:60]. Se non si vuole
installarla, l'unica alternativa è disabilitare il hook in
[^code: .claude/settings.json:8] — opzione **fortemente sconsigliata**
perché elimina la verifica di schema su tutte le pagine wiki tipizzate.

### "agent <slug> tried to write <path>, outside declared write_scope"

L'hook write-scope ha rifiutato un'operazione di un sub-agent. Cause comuni:

1. Il `write_scope:` nella frontmatter dell'agent file non include il path
   target. Soluzione: aggiungere il glob al `write_scope:`, oppure
   ri-progettare l'invocazione perché un altro agent più appropriato faccia
   la scrittura. Riferimento agent files in [^code: .claude/agents/orchestrator.md:6].
2. Path target sbagliato. Soluzione: rileggere lo schema in
   [^code: AGENTS.md:36] e verificare che l'agent sia quello giusto per quel
   namespace.

### "raw/ is immutable; only sync-docs may write .txt sidecars and images/"

Un attore senza slug (main agent o human in IDE) ha tentato di scrivere
sotto `raw/`. Solo il sub-agent `sync-docs` può farlo, e solo per i path
`.txt` e `images/`. Il vincolo è dichiarato in [^code: AGENTS.md:76] come
invariante hard. Soluzione: invocare `/sync-docs` o l'agent equivalente
anziché scrivere a mano.

### "logs/runs/ is emitted by emit_run_log.sh only"

Stesso pattern: il path `logs/runs/**` è dominio esclusivo dell'hook
PostToolUse [^code: .claude/hooks/emit_run_log.sh:1]. Editing manuale
falsificherebbe il run-log JSONL — è quindi vietato.

### "WARN — write without agent slug (treated as main/human)"

Non è un errore ma un avviso a stderr: la write è passata perché il framework
considera l'attore senza slug come "human in control". Comparire questo WARN
significa che la harness non sta propagando `CLAUDE_AGENT_SLUG`, oppure che la
write proviene direttamente dall'utente. Se vedi questo WARN su una write che
ti aspettavi venisse da un sub-agent specifico, indagare la harness.

## Aggiungere una nuova dipendenza

Procedura quando un futuro hook richiede una nuova libreria Python o un
nuovo binario di sistema:

1. Aggiungere la libreria a [^code: requirements.txt:1] con pinning major
   range conservativo (`X>=N.0,<M.0`).
2. Aggiungere il check a [^code: .claude/hooks/validate_hooks.sh:1] con
   diagnostico e comando di install nel messaggio di errore.
3. Aggiungere il `try / except ImportError: sys.exit(2)` nel nuovo hook,
   mai `sys.exit(0)`.
4. Aggiornare la tabella "Cosa serve" in cima a questo runbook.
5. Aggiornare la sezione Tech stack del constitution se la nuova dipendenza
   implica un cambio sostanziale dello stack supportato.

## Cosa NON fare

- ❌ Non installare le librerie Python a livello di sistema con `sudo pip`.
  Usare sempre `--user` o un virtualenv dedicato. La scelta è coerente con
  il vincolo "framework deve restare installabile con strumenti standard
  Unix; nessun gestore di pacchetti proprietario" del [^code: constitution.md:58].
- ❌ Non disattivare gli hook in `.claude/settings.json` per aggirare un
  errore. L'errore segnala una violazione di invariante; rimuoverlo nasconde
  il problema ma non lo risolve. È esplicitamente vietato dal
  [^code: constitution.md:153].
- ❌ Non usare `--no-verify` su git commit per saltare gli hook git
  installati (se mai verranno aggiunti). Stesso razionale del punto sopra.

## Stato del status

Status iniziale `draft`. Promotion a `reviewed` quando il primo agent run
post-P0 avrà esercitato tutti i path del runbook (almeno: un fail-closed
trigger, un write rejection per scope, un health-check pulito). Promotion
a `certified` dopo due sprint di uso senza che emergano nuovi pattern di
troubleshooting non documentati qui.
