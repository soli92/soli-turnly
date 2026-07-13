---
description: Aggiorna una factory llm-wiki++ esistente a una versione target del PATTERN, applicando SOLO i delta incrementali in modo non distruttivo (preserva le personalizzazioni). Meta-comando, controparte di /factory-bootstrap (che invece crea da zero). Default dry-run (piano + STOP); --apply per eseguire. Invoca la skill factory-upgrade-protocol. Fulfills roadmap /retrofit-factory.
argument-hint: [factory-path] [--to=v2-18] [--from=auto] [--dry-run|--apply]
allowed-tools: Read, Write, Edit, Bash, Glob, TodoWrite, WebSearch, WebFetch
---

# Factory Upgrade — dispatcher

> **Sede e installazione.** Come `/factory-bootstrap`, questo è un **meta-comando**:
> opera su una factory dall'esterno e **non** viene scaffoldato nelle factory derivate
> (non è nella lista curata di Fase 4.c del seed). Source-of-truth versionata qui in
> `.claude/commands/`; per usarlo come slash command installalo user-level:
> ```bash
> cp <your-clone>/.claude/commands/factory-upgrade.md ~/.claude/commands/
> cp <your-clone>/.claude/skills/factory-upgrade-protocol.md ~/.claude/skills/
> ```

Argomenti utente: `$ARGUMENTS`

## Cosa fa (e cosa NON fa)

- **Fa**: rileva la versione corrente della factory, calcola la catena di delta verso la
  target, e applica i delta mancanti in modo **additivo e non distruttivo** (file nuovi +
  blocchi config con flag `false` + sezioni in file non personalizzati + sostituzione di
  `PATTERN.md`).
- **NON fa**: ri-scaffolda da zero (quello è `/factory-bootstrap`); non sovrascrive file
  personalizzati (li elenca come CONFLICT con suggerimento patch); non accende capability
  opt-in; non committa (stampa il comando — R.14).

## Risoluzione argomenti

Parse `$ARGUMENTS`:
- 1° argomento posizionale → `factory_path` (assoluto). Default: cwd.
- `--to=<ver>` → versione target. Default: **ultima** (`v2-18`). Accetta `v2-18-full` come
  source consolidato (equivalente funzionale a `v2-18`, un solo file da leggere).
- `--from=<ver>` → versione corrente. Default `auto` (da `factory.config.yaml.pattern_version`).
  Override solo se la detection fallisce.
- `--dry-run` (DEFAULT) → solo piano, report + STOP. `--apply` → esegue (gated, con backup).

**Versione target inesistente** → STOP con errore esplicito, niente silent fallback:
```
ERROR: versione target '<X>' non supportata. Target validi: v2-18 (default), v2-18-full, v2-17, v2-16, v2-15, v2-14, v2-13.
```
(L'upgrade incrementale è supportato per target ≥ v2-13, dove inizia il modello delta
additivo dei seed. Per factory pre-v2.13 valuta prima un retrofit manuale a v2-13.)

## Risoluzione source del meta-framework

Identica a `/factory-bootstrap` §«Risoluzione source del seed»: serve un local clone o i
raw GitHub URL per leggere i template canonici di ogni versione della catena
(`meta-prompts/<ver>/` + `.claude/*` + `PATTERN.md`).

## Esecuzione

**Invoca la skill `factory-upgrade-protocol`** passando `{factory_path, to, from, mode,
meta_source}`. La skill esegue: Fase 0 Detection → Fase 1 Resolve delta chain → Fase 2 Plan
(report + STOP) → [Fase 3 Apply se `--apply`] → Fase 4 Validate (self-test target) → Fase 5
Report. Vincoli inviolabili: non distruttivo (R.7), VCS gate (R.14), additivo/no behavior
change, idempotente, no downgrade.

## Esempi

```
/factory-upgrade /path/to/my-factory                      # dry-run, target = ultima
/factory-upgrade /path/to/my-factory --to=v2-17           # dry-run verso v2.17
/factory-upgrade /path/to/my-factory --apply              # applica i delta (gated, backup)
/factory-upgrade . --from=v2-14 --to=v2-18 --apply        # override detection + apply
```

## Relazione con altri comandi

| Comando | Scopo |
|---|---|
| `/factory-bootstrap` | **Crea** una factory nuova (greenfield scaffolder). |
| `/factory-upgrade` | **Aggiorna** una factory esistente (delta incrementale non distruttivo). |

Fulfills l'item roadmap `meta-prompts/README.md` → «Retrofit skill `/retrofit-factory`».
