---
name: factory-upgrade-protocol
description: Skill di UPGRADE incrementale di una factory llm-wiki++ esistente verso una versione target del PATTERN (default = ultima). A differenza di factory-bootstrap (greenfield scaffolder), questa NON ri-scaffolda da zero: calcola la catena di delta fra la versione corrente e la target, produce un piano (report + STOP), e applica SOLO i delta mancanti in modo non distruttivo, preservando le personalizzazioni della factory. Default dry-run; --apply per eseguire. Fulfills roadmap item `/retrofit-factory`.
---
# Skill — Factory upgrade (incremental, non-destructive)

Riferimenti: i delta seed `meta-prompts/v2-XX/factory-bootstrap.md` (ogni §0 enumera
cosa la versione *Aggiunge / Modifica / Rimuove*), `meta-prompts/README.md` (sezioni
«Diff vX → vY»), PATTERN §0 (versione), §7 (regole inviolabili — in particolare r.7
update non distruttivo, r.14 VCS gate, r.18), §13-§20 (feature per versione).

> **Perché esiste.** I seed `factory-bootstrap` sono greenfield scaffolder: sanno *creare*
> una factory, non *aggiornarne* una esistente. Ri-eseguire un bootstrap su una factory
> reale sovrascriverebbe le personalizzazioni. Questa skill chiude il gap: applica solo i
> **delta** fra versione corrente e target, in modo additivo e non distruttivo.

## Modello mentale: l'upgrade è la catena `extends:` applicata

Ogni release del PATTERN da v2.13 in poi è un **delta additivo** (vedi i seed
`meta-prompts/`). Un upgrade `v_from → v_to` = applicare in sequenza i delta di ogni
versione intermedia, esclusa `v_from`, inclusa `v_to`. Esempio: `v2.14 → v2.18` applica i
delta di v2.15 + v2.16 + v2.17 + v2.18. **Invariante chiave**: tutte le feature da v2.13 in
poi sono **opt-in, no-op a flag spento** → un upgrade è *additivo* e non cambia il
comportamento runtime finché l'utente non accende i nuovi flag.

## Input atteso

- `factory_path` (assoluto) — root della factory da aggiornare. Default: cwd.
- `to` — versione target (`v2-18` default = ultima; accetta anche `v2-18-full` come
  source consolidato del piano, equivalente funzionalmente a `v2-18`).
- `from` — versione corrente (`auto` default → letta da `factory.config.yaml.pattern_version`
  / `PATTERN.md` §0; override solo se la detection fallisce o il file è stato manomesso).
- `mode` — `dry-run` (default: solo piano, report + STOP) | `apply` (esegue, gated).
- `meta_source` — local clone del meta-framework o raw GitHub (per leggere i template
  canonici di ogni versione). Risolto come in factory-bootstrap §«Risoluzione source».

## Fase 0 — Detection

1. Verifica `factory_path` è una factory valida: esiste `factory.config.yaml` + `PATTERN.md`.
   Se no → **STOP**: «<path> non è una factory llm-wiki++ (manca factory.config.yaml/PATTERN.md)».
2. Leggi `v_from`:
   - `factory.config.yaml.pattern_version` (autorità primaria).
   - cross-check con `PATTERN.md` §0 e con la presenza di marker-file (es. esiste
     `.claude/skills/caveman-protocol.md` ⇒ ≥ v2.14; `visual-oracle-protocol.md` ⇒ ≥ v2.17;
     `accessibility-testing-protocol.md` ⇒ ≥ v2.18). Se config e marker divergono, segnala
     l'incoerenza e usa il **minimo** (conservativo) — l'upgrade è idempotente, ri-applicare
     un delta già presente è no-op grazie ai check di Fase 3.
3. Risolvi `v_to` (default ultima). Se `v_from == v_to` → **STOP**: «Factory già a <v_to>,
   nulla da fare» + esegui comunque il self-test target (Fase 4) come health-check.
4. Se `v_from > v_to` (downgrade) → **STOP**: i downgrade non sono supportati (rimuovere
   feature può rompere artefatti già prodotti). Segnala e termina.
5. **Precondizione VCS** (R.14): se `factory_path` è un repo git, verifica
   `git -C <factory_path> status --porcelain` → se working tree sporco, **WARN** e chiedi
   conferma esplicita prima di procedere in `apply` (un backup pulito è la rete di sicurezza).

## Fase 1 — Resolve delta chain

Costruisci `chain = [versioni da (v_from esclusa) a (v_to inclusa)]`. Per ciascuna versione
della catena, leggi dal `meta_source`:
- `meta-prompts/<ver>/factory-bootstrap.md` §0 (enumera Aggiunto/Modificato/Rimosso).
- la sezione «Diff» corrispondente in `meta-prompts/README.md`.

Da queste fonti deriva, per ogni versione, tre liste:
- **ADD** — file nuovi introdotti (skill/command/agent/tool/runbook) + blocchi config nuovi.
- **MODIFY** — file esistenti che il delta tocca (es. v2.17 aggiunge Fase 4-bis a
  `dev-protocol`; v2.18 aggiunge Check 4o/4p a `lint-checks`).
- **PATTERN** — il `PATTERN.md` va sostituito verbatim con quello della `v_to` (contratto,
  mai personalizzato dalla factory).

> La catena è la stessa documentata nel seed consolidato
> `meta-prompts/v2-18/factory-bootstrap-full.md` (utile come riferimento unico del «cosa
> dovrebbe esserci alla fine»).

### Delta supplementare v2.27-post (EP-040 factory-optimization-2026-07-07)

Ottimizzazioni strutturali non associate a un bump di versione. Applicate **automaticamente**
quando `v_to == v2-27` (o superiore): se i file elencati mancano nella factory target,
trattarli come ADD; se presenti, skip (idempotente).

**ADD — nuovi file:**

| File | Tipo | Nota |
|---|---|---|
| `.claude/skills/dispatch-policy.md` | skill | Contratto dispatch condizionale (8 sezioni) |
| `.claude/skills/wiki-keeper-worker-protocol.md` | skill | Worker sub-agent protocol per ingest parallelo |

**MODIFY — file modificati:**

| File | Modifica attesa |
|---|---|
| `.claude/agents/orchestrator.md` | Ridotto a < 100 righe; body rimanda a `dispatch-policy` |
| `.claude/agents/*.md` (tutti) | Frontmatter `capabilities: [...]` presente |
| `.claude/skills/lint-checks.md` | Check 4ai + Check 4aj presenti |
| `.claude/skills/wiki-log-entry.md` | Template `wave` e `develop` con WAVE_ID presenti |
| `factory.config.yaml` | Blocco `models.routing` (Central Model Registry) presente |
| `PATTERN.md` | §29 (Factory Scalability Patterns) presente |

**Marker di rilevamento** (auto-detect se il delta è già stato applicato):
- `.claude/skills/dispatch-policy.md` esiste → delta già applicato.

## Fase 2 — Plan (report + STOP) — *sempre, anche in `apply`*

Per ogni file/blocco nelle liste ADD/MODIFY, classifica lo stato nella factory target e
assegna un'**azione**, confrontando con il template canonico della versione che lo introduce:

| Categoria | Stato nella factory | Azione |
|---|---|---|
| ADD file | assente | **COPY** (sicuro) |
| ADD file | presente, identico al canonico-precedente | **COPY** (overwrite sicuro) |
| ADD file | presente, **diverge** dal canonico | **CONFLICT** → non toccare, elenca per review manuale |
| ADD config block | assente | **MERGE** additivo, tutti i flag `false` (no behavior change) |
| ADD config block | presente | **SKIP** (già lì; non sovrascrivere valori utente) |
| MODIFY file | contiene già la sezione delta (marker) | **SKIP** (idempotente) |
| MODIFY file | assente la sezione + file == canonico-precedente | **PATCH** (inserisci sezione) |
| MODIFY file | assente la sezione + file **diverge** (personalizzato) | **CONFLICT** → suggerisci patch, gate manuale, non auto-merge |
| PATTERN.md | qualsiasi | **REPLACE** verbatim con `v_to` |

Produci il **piano** in chat e **STOP** (R.6 report preliminare prima di scritture batch):

```
========================================
FACTORY UPGRADE PLAN — <v_from> → <v_to>
========================================
Factory: <factory_path>
Catena delta: <v_from> → [<ver1>, <ver2>, ...] → <v_to>

[COPY]      <N> file nuovi additivi (sicuri)
[MERGE]     <M> blocchi config nuovi (flag tutti false → nessun cambio comportamento)
[PATCH]     <P> sezioni in file esistenti (file == canonico, inserimento sicuro)
[REPLACE]   PATTERN.md → <v_to> verbatim
[SKIP]      <S> già presenti (idempotenza)
[CONFLICT]  <C> file personalizzati toccati dai delta → REVIEW MANUALE (vedi sotto)

[DETTAGLIO CONFLICT]   (richiedono la tua decisione)
- <path>: la factory ha personalizzato questo file; il delta <ver> vorrebbe <cosa>.
  Suggerimento patch: <diff/sezione da inserire>. Azione: applica a mano o approva.

[POST-UPGRADE — opt-in, NON attivati automaticamente]
Le nuove capability restano spente. Per attivarle dopo l'upgrade:
- <ver> <capability>: <flag da accendere> + prerequisito <es. Playwright>.

In dry-run mi fermo qui. Per applicare COPY+MERGE+PATCH+REPLACE (i CONFLICT restano a te):
  /factory-upgrade <factory_path> --to=<v_to> --apply
```

Se `mode == dry-run` → **termina qui** con `status: planned`.

## Fase 3 — Apply (solo se `mode == apply`, gated)

1. **Backup** (rete di sicurezza, mai distruttivo): crea
   `<factory_path>/.factory-upgrade-backup/<v_from>-to-<v_to>-<YYYYMMDD-HHMM>/` con copia
   dei file in MODIFY/REPLACE che verranno toccati. Registra la dir in `.gitignore` se non
   già coperta. (Se la factory è git pulito, il backup è ridondante ma innocuo.)
2. Applica nell'ordine: **COPY** → **MERGE** (config) → **PATCH** → **REPLACE** (PATTERN.md).
   - I **CONFLICT** NON vengono applicati: restano elencati nel report finale per intervento
     manuale (R.7 update non distruttivo su contenuto personalizzato).
   - **MERGE config**: inserisci i blocchi nuovi con tutti i flag al default `false`. Mai
     toccare valori esistenti. Mantieni commenti/ordine il più possibile.
   - **PATCH**: inserisci la sezione delta nel punto documentato dal delta seed (es.
     «Fase 4-bis» in `dev-protocol`), solo se il file è ancora == canonico-precedente.
3. **Bump** `factory.config.yaml.pattern_version` → `<v_to numerico>` (es. `"2.18"`).
4. **VCS gate (R.14)**: **mai** auto-commit / auto-push. Stampa il comando suggerito:
   ```
   git -C <factory_path> add -A && git -C <factory_path> commit -m "chore: upgrade factory <v_from> → <v_to>"
   ```
5. Idempotenza: ri-eseguire l'upgrade alla stessa target dopo un apply ⇒ tutto SKIP.

## Fase 4 — Validate (self-test target)

Esegui la checklist di accettazione della `v_to` (dal seed target / consolidato `-full`
§Self-test). In upgrade, i check «file esiste» valgono come in bootstrap; i check di
attivazione si applicano solo se l'utente ha già acceso i flag (di norma no, subito dopo
l'upgrade). Segnala PASS/FAIL. **Mai dichiarare upgrade completato con check strutturali
falliti** (i CONFLICT non risolti sono `partial`, non `failed`).

## Fase 5 — Report finale

```
========================================
FACTORY UPGRADE <stato> — <v_from> → <v_to>
========================================
Factory: <factory_path>
Backup:  <path backup o "git working tree (clean)">

[APPLICATO]  COPY <N> · MERGE <M> · PATCH <P> · REPLACE PATTERN.md
[SKIP]       <S> (idempotenza)
[CONFLICT]   <C> da risolvere a mano (elenco con suggerimenti patch)

[SELF-TEST <v_to>]  <K>/<K> strutturali PASS

[ATTIVAZIONE OPT-IN — prossimi step facoltativi]
<per ogni capability nuova: flag + prerequisito>

[VCS]  comando commit suggerito (mai eseguito automaticamente, R.14)
```

## Return value

```yaml
status: planned | success | partial | failed
v_from: <ver>
v_to: <ver>
applied: { copy: N, merge: M, patch: P, replace: 1 }
skipped: S
conflicts: [<path>, ...]
self_test: <K>/<K>
backup_path: <path | null>
```

## Vincoli inviolabili

- **Non distruttivo (R.7)**: mai sovrascrivere file personalizzati; i CONFLICT si elencano,
  non si auto-mergiano. Backup obbligatorio prima di ogni write in `apply`.
- **VCS gate (R.14)**: mai `git commit/push/--force/--amend` automatici; solo stampa.
- **Additivo / no behavior change**: i blocchi config nuovi entrano con flag `false`;
  l'upgrade non accende capability né cambia il comportamento runtime senza azione utente.
- **Report + STOP (R.6)**: dry-run è il default; il piano va mostrato prima di scrivere.
- **Idempotente**: ri-applicare alla stessa target è no-op (tutto SKIP).
- **No downgrade**: `v_from > v_to` → STOP.
- **PATTERN.md è il contratto**: sostituito verbatim, mai patchato/personalizzato.
- **Agent-agnostic**: il piano cita PATTERN.md e i delta seed, non costrutti runtime-specifici.
