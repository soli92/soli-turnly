---
status: current
capability: EP-016
pattern_ref: PATTERN §23
skill: complexity-budget-check
command: /complexity-budget
adr: [ADR-052, ADR-053, ADR-056]
updated: 2026-06-15
---

# Runbook: Complexity Budget

Procedura operativa per la governance documentale sottrattiva di `PATTERN.md` (regola N:1,
PATTERN §23.1, ADR-052). Copertura: verifica pre-release minor/major del ratio N:1,
calcolo `delta_added`/`delta_removed`, formula ratio, interpretazione verdict, esenzioni.

> **Nota v2.19 — non retroattivita'**: la regola N:1 e il relativo Lint Check 4t sono stati
> introdotti in v2.19 (EP-016). Il flag `complexity_budget.required_on_release` e' stato
> promosso a `true` nel meta-framework da TSK-166 (2026-06-15). L'applicazione e' **prospettica**:
> le release v2.19 e v2.20 non vengono rivalutate retroattivamente. Il check si applica a partire
> dalla release **v2.21** in poi (applicazione prospettica, ADR-052 §A, TSK-166).

---

## 1. Scopo

Garantire che ogni release **minor** (`x.Y.0`) o **major** (`X.0.0`) del meta-framework
mantenga un rapporto equilibrato tra sezioni `##` top-level aggiunte e rimosse in `PATTERN.md`.

La regola N:1 (ADR-052 §A) recita:

> **Per ogni `N` (default 3) sezioni `##` top-level aggiunte alla versione `vX.Y` di
> `PATTERN.md`, almeno 1 sezione deve essere deprecata (o rimossa se gia' deprecata
> nella versione precedente).**

Questo runbook guida il maintainer attraverso l'intera procedura di verifica prima di
apporre il tag di release. Il check automatico e' disponibile via `/complexity-budget` o
skill `complexity-budget-check`.

Cross-link autoritativi:
- ADR-052 — decisione N=3, whitelist esclusioni, algoritmo conteggio, calcolo delta, scope
- PATTERN §23 — sezione dedicata «Complexity Budget & Deprecations» (§23.1..§23.7)

---

## 2. Calcolo `delta_added`

`delta_added` = numero di heading `##` top-level **aggiunti** in `PATTERN.md` tra la versione
precedente e quella corrente.

### Algoritmo

```python
delta_added = count_sections(PATTERN.md @ current_version) \
            - count_sections(PATTERN.md @ previous_version)
```

Dove `count_sections` conta ogni riga che corrisponde al pattern `^## ` (two-hash + spazio),
**escludendo le whitelist** (vedi sotto).

### Whitelist esclusioni (ADR-052 §C)

I seguenti heading `##` **non vengono conteggiati** in `delta_added`:

| Pattern heading | Motivazione esclusione |
|---|---|
| `^Table of Contents`, `^TOC`, `^Indice`, `^Sommario` | Heading di navigazione, non complessita' operativa |
| `^Examples`, `^Esempi` | Heading di esempi illustrativi |
| `^Storia$`, `^History$`, `^Roadmap$` | Heading storiografici cumulativi, non sostanziali |

Tutti gli altri heading `##` top-level (inclusi `§0 Identita'`, `§1..§N sezioni operative`,
ecc.) **vengono conteggiati**.

Sub-sezioni `###`, `####` non vengono mai conteggiate: `§22.1..§22.8` contano come 0 sezioni
aggiuntive se `§22` era gia' presente.

### Esempio concreto (v2.19)

v2.18 aveva N sezioni `##` operative. v2.19 aggiunge `## §22 — Release Governance` e
`## §23 — Complexity Budget & Deprecations` (entrambe nuove sezioni top-level):

```
count(v2.19) - count(v2.18) = +2 → delta_added = 2
```

---

## 3. Calcolo `delta_removed`

`delta_removed` = numero di heading `##` top-level **rimossi o deprecati** in `PATTERN.md`
tra la versione precedente e quella corrente, misurati tramite il conteggio delle sezioni
archiviate in `PATTERN-historical.md` (ADR-055).

### Algoritmo

```python
delta_removed = count_archived_sections(PATTERN-historical.md @ current_version) \
              - count_archived_sections(PATTERN-historical.md @ previous_version)
```

Una sezione conta come "rimossa" quando viene spostata in `PATTERN-historical.md` (rimozione
netta) o marcata in `PATTERN.md §23.2 ## Sezione Deprecate` (deprecazione). Per il calcolo
del ratio, si usa il conteggio effettivo delle sezioni archiviate nel ciclo corrente.

### Nota su deprecazione vs rimozione

- **Deprecata**: la sezione esiste ancora in `PATTERN.md §23.2` con schema `deprecata da: vX.Y`,
  `rimozione attesa: vX.Y`. Conta come rimossa ai fini del ratio (impegno contrattuale di rimozione).
- **Rimossa**: la sezione e' stata spostata in `PATTERN-historical.md`. Conta come rimossa.
- **Archiviata in release precedente**: se la sezione era gia' in `PATTERN-historical.md`
  dalla release precedente, non incrementa `delta_removed` per questa release (gia' conteggiata).

### Esempio concreto (v2.19)

Il primo round di consolidamento US-063 (ADR-055) depreca/rimuove 3-5 sezioni storiche/transitorie:

```
archived(v2.19) - archived(v2.18) = 3 (a 5) → delta_removed = 3..5
```

---

## 4. Formula ratio e verdict

### Formula

```
ratio = delta_added / max(1, delta_removed)
```

L'uso di `max(1, delta_removed)` previene la divisione per zero: se non e' stata rimossa
alcuna sezione, il denominatore e' 1 (caso piu' conservativo).

### Tabella verdict

| Condizione | Verdict | Significato |
|---|---|---|
| `ratio <= N` (default N=3) | **pass** | Regola rispettata. Tag ok. |
| `N < ratio <= N+1` | **warn** | Margine tolleranza (1 sezione in piu' della regola). Attenzione. |
| `ratio > N+1` | **fail** | Regola violata (>1 sezione in eccesso). Blocca il tag se `required_on_release: true`. |

### Edge case (ADR-052 §D)

| Condizione | Verdict |
|---|---|
| `delta_added == 0` AND `delta_removed > 0` | **pass** (consolidamento puro, nessuna aggiunta) |
| `delta_added > 0` AND `delta_removed == 0` AND `delta_added <= N` | **warn** (carry-over deficit alla prossima release) |
| `delta_added > 0` AND `delta_removed == 0` AND `delta_added > N` | **fail** (crescita senza compensazione) |

### Esempio calcolo completo

```
# Caso v2.19 (self-validation ADR-052 §F):
delta_added   = 2   (§22 Release Governance + §23 Complexity Budget)
delta_removed = 3   (3 sezioni storiche archiviate — round consolidamento US-063)

ratio = 2 / max(1, 3) = 2/3 ≈ 0.67

0.67 <= N=3 → verdict: PASS (surplus sano)
```

```
# Caso ipotetico fail:
delta_added   = 10
delta_removed = 1

ratio = 10 / max(1, 1) = 10.0

10.0 > N+1=4 → verdict: FAIL
```

```
# Caso warn (margine):
delta_added   = 4
delta_removed = 1

ratio = 4 / max(1, 1) = 4.0

N=3 < 4.0 <= N+1=4 → verdict: WARN
```

---

## 5. Come interpretare il verdict

### `pass`

Il ratio rispetta la regola N:1. Il tag di release puo' procedere senza interventi.

```
Azione: nessuna. Procedi con il tag.
```

### `warn`

Il ratio e' nel margine di tolleranza (1 sezione in piu' della regola). Non blocca il tag,
ma segnala che la prossima release dovra' compensare il deficit accumulato.

```
Azione: documenta il carry-over nel CHANGELOG. Pianifica almeno 1 deprecazione aggiuntiva
        nella prossima release minor/major per rientrare nel budget.
```

### `fail`

Il ratio supera N+1. Con `complexity_budget.required_on_release: true` (come nel
meta-framework da TSK-166), il Lint Check 4t cambia da WARNING a **ERROR**: il tag
non puo' procedere senza un intervento esplicito.

Due opzioni per risolvere il `fail`:

**Opzione A — Rimuovere o deprecare sezioni** (preferita):

1. Identifica sezioni `##` candidate in `PATTERN.md` (sezioni storiche, transitorie,
   superseded).
2. Per ogni candidata: esegui `/complexity-budget deprecate §X --reason="<motivo>"`.
3. Ricalcola: `/complexity-budget check` → atteso verdict `pass` o `warn`.

**Opzione B — Aggiungere marker di esenzione** (se la rimozione non e' praticabile
nella release corrente):

```markdown
<!-- Nel CHANGELOG entry della release corrente: -->
[skip-complexity-budget --reason="<motivo esplicito>"]
```

Il marker sospende il check per questa release. Il motivo deve essere documentato
(ADR-052 §A). Vedi §6 per le esenzioni legittime.

---

## 6. Esenzioni legittime

Il check e' **saltato automaticamente** (no-op, nessun verdict) nelle seguenti condizioni:

| Condizione | Motivazione | Riferimento |
|---|---|---|
| **Bug-fix release** `x.y.Z` (patch) | Le patch non aggiungono complessita' strutturale (SemVer: patch = no breaking) | ADR-052 §A |
| **Prima release che introduce la regola** (`required_on_release` appena promosso a `true`) | Non e' ragionevole applicare retroattivamente la regola alla release che la introduce per prima | ADR-052 §A + non-retroattivita' v2.19 |
| **Marker esenzione esplicita** nel CHANGELOG | Motivo documentato, esenzione per la singola release | ADR-052 §A |

### Marker di esenzione

```markdown
[skip-complexity-budget --reason="<motivo>"]
```

Il marker va inserito nell'entry del CHANGELOG per la release specifica (non in
`PATTERN.md` o `factory.config.yaml`). Esempi di motivi validi:

- `"prima release con la regola (v2.21) — applicazione prospettica da questa release"`
- `"esenzione temporanea EP-NNN: 5 nuove sezioni necessarie per funzionalita' critica,
   consolidamento pianificato in v2.22"`
- `"ratio 3.5 warn (non fail): carry-over accettato, deprecazione §X pianificata v2.22"`

Esenzioni **non legittime** (non verranno accettate):
- Esenzione senza `--reason` valorizzato (stringa vuota o placeholder).
- Esenzione ricorrente su release consecutive senza piano di consolidamento.

---

## 7. Comando verifica

### Comando `/complexity-budget`

Il comando e' disponibile in `.claude/commands/complexity-budget.md`. Invocazione:

```bash
/complexity-budget check
# Esegue il check completo: delta_added, delta_removed, ratio, verdict.
# Output: report strutturato con delta, ratio, verdict (pass/warn/fail) e suggerimenti.

/complexity-budget check --version=v2.21
# Check esplicito per una versione specifica (confronto vs tag git precedente).

/complexity-budget deprecate §X --reason="<motivo>" --target="v2.22"
# Marca la sezione §X come candidata deprecazione per la release target.
# Aggiunge entry in PATTERN.md §23.2.

/complexity-budget history
# Mostra lo storico dei ratio per versione (side-channel ADR-056 §I).
```

### Skill `complexity-budget-check`

La skill e' disponibile in `.claude/skills/complexity-budget-check.md`. Puo' essere
invocata direttamente da un agente come sotto-procedura:

```
Invoca skill `complexity-budget-check` passando:
  - version_current: <tag corrente>
  - version_previous: <tag precedente>
  - pattern_path: PATTERN.md
  - historical_path: PATTERN-historical.md
  - config: factory.config.yaml.complexity_budget
Output: {delta_added, delta_removed, ratio, verdict, suggestions}
```

### Lint Check 4t (enforcement automatico)

Con `complexity_budget.required_on_release: true` (meta-framework da TSK-166), il Lint
Check 4t cambia comportamento:

- `required_on_release: false` (default factory derivate) → Check 4t WARNING-only, non blocca.
- `required_on_release: true` (meta-framework) → Check 4t **ERROR** su release minor/major
  con ratio N:1 violato (fail). Blocca il tag (enforcement).

Il check 4t e' definito in `.claude/skills/lint-checks.md`.

---

## 8. Workflow deprecazione sezione

1. Verifica che la sezione non abbia reference critiche:
   ```bash
   grep -rn "§X" .claude/
   ```
2. Aggiungi entry in `PATTERN.md §23.2 ## Sezione Deprecate` con schema:
   ```markdown
   ### §<numero> <titolo>
   - Deprecata da: vX.Y.Z (CHANGELOG link)
   - Rimozione attesa: vX.Y.Z (target)
   - Motivazione: <slug + 1 riga max>
   - Sostituita da: §<numero> <titolo> | nessuna sostituzione (rimozione netta)
   - Migration: <link a runbook | inline 1 paragrafo>
   ```
3. In `CHANGELOG.md`: aggiungi `[DEPRECATE §X <titolo>]` nell'entry della release.
4. Notifica i derivatori (via `CONTRIBUTING.md` o release note).

---

## 9. Workflow rimozione sezione (da deprecata ad archiviata)

1. Copia la sezione in `PATTERN-historical.md` con header note.
2. Rimuovi la sezione da `PATTERN.md`.
3. Aggiorna tutti i cross-link `§X` → `PATTERN-historical#§X` in `.claude/`.
4. `/lint` → 0 ERROR.
5. `/complexity-budget check` → verdict `pass`.
6. `CHANGELOG.md`: `[REMOVE §X <titolo>]`.

---

## 10. Audit storico

- Tutte le sezioni rimosse vivono in `PATTERN-historical.md`.
- Consultabili via `/pattern-view historical` (ADR-053) o `/complexity-budget history`.
- I report per versione vivono in `complexity/budget-report-<version>.md` (side-channel, ADR-056 §I).
- La telemetria `state: complexity_budget_check` (ADR-056 §J) e' auditabile nel log EP-013.

---

## Cross-link

- Skill `complexity-budget-check` (`.claude/skills/complexity-budget-check.md`) + comando
  `/complexity-budget` (`.claude/commands/complexity-budget.md`).
- **ADR-052** — N=3, whitelist esclusioni, algoritmo conteggio, calcolo delta, scope.
- **PATTERN §23** — sezione dedicata: §23.1 (regola N:1), §23.2 (Sezione Deprecate),
  §23.3 (Governance), §23.4 (Storia), §23.5 (3 Profili), §23.6 (Self-validation v2.19),
  §23.7 (Cross-link).
- Lint **Check 4t** (`.claude/skills/lint-checks.md`) — WARNING-only se `required_on_release: false`;
  ERROR se `required_on_release: true`.
- ADR-053 (`/pattern-view`), ADR-055 (`PATTERN-historical.md`), ADR-056 (governance combinata).
- Wiki concept: `wiki/concepts/complexity-budget.md`.
