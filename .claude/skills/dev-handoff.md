---
name: dev-handoff
description: Entry per wiki/log.md a chiusura di un TSK consumato da dev-agent (operazione Develop, PATTERN §3).
---
# Procedura — handoff dev-agent → wiki/log.md

Append-only su `wiki/log.md` quando un dev-agent completa un TSK
(status `in-progress` → `done`).

## Formato entry

```markdown
## YYYY-MM-DD HH:MM — develop TSK-ZZZ
**Agente:** <be-dev|fe-dev|db-dev|qa-dev>
**TSK:** [[../management/kanban/EP-XXX-<slug>/US-YYY-<slug>/TSK-ZZZ]]
**Layer:** <be|fe|db|qa|infra>
**Code path:** <code_path da factory.config.yaml — relativo o assoluto>
**Files touched:** <count> (lista compatta solo se ≤ 5; altrimenti "vedi commit")
**Commit:** <hash short se code_path è git tracciato; oppure "n/a">
**DoD:** <pass | partial — descrivi> 
**Note:** <free-form, max 2-3 righe; segnala blocker non-bloccanti rilevati>
```

## Esempi

### Caso normale (DoD pass, code_path interno al repo)

```markdown
## 2026-05-20 14:32 — develop TSK-042
**Agente:** be-dev
**TSK:** [[../management/kanban/EP-003-auth/US-012-login/TSK-042]]
**Layer:** be
**Code path:** ./src/
**Files touched:** 3 (src/auth/login.py, src/auth/router.py, src/tests/test_login.py)
**Commit:** a1b2c3d
**DoD:** pass
**Note:** Implementato OIDC verbatim per coerenza con raw/tech_stack.md.
```

### Caso code_path esterno

```markdown
## 2026-05-20 16:10 — develop TSK-043
**Agente:** fe-dev
**TSK:** [[../management/kanban/EP-003-auth/US-012-login/TSK-043]]
**Layer:** fe
**Code path:** /Users/me/Repos/customer-portal/
**Files touched:** vedi commit
**Commit:** e4f5g6h (su repo esterno customer-portal)
**DoD:** pass
**Note:** —
```

### Caso DoD parziale (blocker)

```markdown
## 2026-05-20 18:00 — develop TSK-044 (PARTIAL)
**Agente:** db-dev
**TSK:** [[../management/kanban/EP-003-auth/US-012-login/TSK-044]]
**Layer:** db
**Code path:** ./src/
**Files touched:** 1 (migrations/004_add_session_table.sql)
**Commit:** —
**DoD:** partial — test integration non disponibile (db test fixture mancante)
**Note:** Status TSK resta `in-progress`. Apro gap "missing-db-test-fixture" in wiki/gaps.md.
```

## Regole

- **Append-only**: mai editare entry passate (PATTERN §7 r.5).
- **Una entry per TSK chiuso**. Se serve correggere, append nuova entry con marker
  `## YYYY-MM-DD HH:MM — develop TSK-ZZZ (correction)`.
- **Mai citare il codice prodotto direttamente in wiki/log.md** (rumore). Cita
  TSK; chi vuole il codice apre il commit / il file.
- **Coerenza con `dev-protocol`**: l'entry si scrive SOLO se `status: done` o
  `status: in-progress (partial)`. Mai per TSK in fase di gate.

## Cross-reference

- Cita: `wiki-log-entry` (formato generale log entries)
- Invocata da: `dev-protocol` (Fase 5)

---

## Decision Anchor Propagation (opt-in v2.19, EP-015)

> **Gated**: `factory.config.yaml.compression.output.decision_anchor.enabled: true`.
> A flag spento questa sezione è no-op, comportamento identico v2.18 (R.P3).

### Step pre-handoff (DA ESEGUIRE PRIMA DI EMETTERE L'HANDOFF)

1. **Controlla presenza**: l'input del dev-agent include `decision_anchor` nel task package?
   - Se NO e `enabled: true` → ERROR `[anchor-stripped]` in `wiki/log.md` + blocco handoff.
   - Se NO e `enabled: false` → no-op.
2. **Controlla checksum**: il campo `decision_anchor.checksum` nel task package ricevuto corrisponde
   all'hash di `canonical_json(decision_anchor.decisions[])`?
   - Se NO → ERROR `[anchor-tampered]` in `wiki/log.md` + blocco handoff.
3. **Copia invariata**: includi il campo `decision_anchor` nell'output del handoff senza modifiche.
   Il dev-agent è **read-only** sull'anchor.

### Struttura handoff arricchita (gated)

```yaml
# dev-handoff output — sezione aggiunta v2.19
decision_anchor: <<anchor copiato invariato dall'input>>
# Nota: <<...>> = marcatore template cross-adapter (non stampare letteralmente)
```

### Errori

| Codice | Condizione | Severity | Azione |
|--------|-----------|----------|--------|
| `anchor-stripped` | Anchor atteso ma assente | ERROR | Blocco handoff, log `[anchor-stripped]` |
| `anchor-tampered` | Checksum mismatch | ERROR | Blocco handoff, log `[anchor-tampered]` |

### Cross-link

- Schema anchor: `wiki/runbooks/decision-anchor-runbook.md` (TSK-115)
- PATTERN §20.4 R.C7 (TSK-119)
- Skill parallela: `vcs-handoff.md` (stessa logica)

---

## Temporal Handoff Block (opt-in v2.18+, gated da `temporal.handoff_protocol.enabled`)

Quando `factory.config.yaml.temporal.handoff_protocol.enabled: true`, ogni handoff
dev-to-dev, dev-to-orchestrator, develop→review (CQRL), develop→visual-oracle, ed
escalation dev-agent→orchestrator include un blocco YAML strutturato `temporal_handoff:`
con **5 campi obbligatori** (verbatim da [[temporal-awareness-multiagent-patterns]] §Pattern 4):

### Schema canonico

```yaml
temporal_handoff:
  handoff_id: "HO-<timestamp-utc>-<random-4char>"   # es. "HO-2026-06-04T14:32:00Z-a1b2"
  elapsed_ms: <integer ≥ 0>                          # wall-clock: epoch_ms(now()) - epoch_ms(task_started_at)
  estimated_remaining_ms: <integer | null>           # best-effort agente uscente; null se non stimabile
  completed_steps:                                   # append-only; può essere vuoto al primo handoff
    - step_id: "<id>"
      name: "<descrizione breve>"
      started_at: "<UTC ISO-8601 Z>"
      completed_at: "<UTC ISO-8601 Z>"
      agent: "<slug>"
  pending_steps:                                     # dichiarati nel piano TSK, NON stimati a runtime
    - step_id: "<id>"
      name: "<descrizione breve>"
      agent: "<slug previsto>"
  context_summary: |
    <testo multi-riga — mai vuoto; aggiunge informazioni di CONTENUTO
    non replicate da completed_steps (vincoli, decisioni, riferimenti file)>
```

### Punti di iniezione

- **Inter-wave handoff** (parallel-scheduler §18): tra una wave e la successiva.
- **Develop → Review** (CQRL v2.12): tra dev-agent e code-reviewer.
- **Develop → Visual Oracle** (FE v2.17): tra fe-dev e visual-oracle.
- **Escalation → Orchestrator**: quando un sub-agent fallisce o si blocca.

### Calcolo dei campi (ADR-030)

- `elapsed_ms`: `epoch_ms(now()) - epoch_ms(task_started_at)`. Wall-clock (include attese tool/API/gating). Granularità millisecondi. Fail-loud se negativo.
- Tutti i timestamp UTC ISO-8601 con `Z` (helper `tools/temporal/utc-now.sh`). Vedi ADR-030 §A.
- `estimated_remaining_ms`: best-effort agente uscente. `null` accettato + nota in `context_summary`.
  Se `temporal.handoff_protocol.use_reference_class: true` AND EP-009 attiva: il campo additivo
  `estimated_remaining_ms_from_history` viene popolato da `analyze_timeline` (ADR-030 §C).

### Esempio dual-format (narrative v2.7 + Temporal Handoff Block esteso)

```markdown
## 2026-06-04 14:32 — develop TSK-084

**Agente:** docs-dev
**TSK:** [[../management/kanban/EP-011-temporal-awareness-layer/US-046-temporal-handoff-protocol/TSK-084]]
**Layer:** docs
**Code path:** .claude/skills/dev-handoff.md
**Files touched:** 1
**Commit:** a1b2c3d
**DoD:** pass
**Note:** Aggiunta sezione Temporal Handoff Block (ADR-031 §A), additiva.
```

```yaml
temporal_handoff:
  handoff_id: "HO-2026-06-04T14:32:00Z-a1b2"
  elapsed_ms: 5400000
  estimated_remaining_ms: null
  completed_steps:
    - step_id: "append-temporal-handoff-section"
      name: "Append Temporal Handoff Block to dev-handoff.md"
      started_at: "2026-06-04T13:00:00Z"
      completed_at: "2026-06-04T14:32:00Z"
      agent: "docs-dev"
  pending_steps: []
  context_summary: |
    Sezione append-only aggiunta in coda. Sezioni v2.7 invariate.
    Backward compat: flag spento → no-op identico a v2.7 (R.P3).
```

### Proiezione da State Machine (se US-047 attiva)

Se `temporal.state_machine.enabled: true` AND TSK con State Machine attiva (ADR-029),
`completed_steps[]` e `pending_steps[]` **non sono compilati a mano** ma proiettati
dal `state_file` (ADR-031 §C.3). Il processo dipende dalla `source` configurata.

#### Pseudocodice (ADR-031 §C.3)

```python
# ADR-031 §C.3 — proiezione completed/pending da state file
state = load_json(f"management/state/{tsk_id}.json")

completed_steps = [
    {
        "step_id":      h["step_id"],
        "name":         h["name"],
        "started_at":   h["started_at"],
        "completed_at": h["completed_at"],
        "agent":        h["agent"]
    }
    for h in state["history"]
    if h["status"] == "completed"
]

pending_steps = [
    {
        "step_id": h["step_id"],
        "name":    h["name"],
        "agent":   h.get("agent_expected")
    }
    for h in state["history"]
    if h["status"] == "pending"
]
```

#### Modalità per `source`

**`standalone`** (`temporal.state_machine.source: standalone`, ADR-028 §B.1):
- L'agente che produce l'handoff legge il `state_file` READ-ONLY prima della proiezione.
- Diventa il nuovo **single-writer** del `state_file` dopo la proiezione (ownership transfer
  esplicita): scrive le transizioni successive direttamente, senza passare da `record-event.sh`.
- Nessuna ricostruzione da eventi: il file è il ground truth.

**`events`** (`temporal.state_machine.source: events`, ADR-028 §B.2):
- Single-writer del `state_file` = tool `record-event.sh` tramite `rebuild-state-from-events.sh`.
- L'agente che produce l'handoff legge il `state_file` aggiornato **sempre e solo READ-ONLY**.
- **Mai scrivere direttamente** il `state_file` in questa modalità: bypass del tool viola
  l'append-only enforcement (ADR-028 §B.2).

**Non attiva** (State Machine non attiva per questo TSK, ADR-029 §C):
- `completed_steps[]` e `pending_steps[]` compilati **manualmente** dall'agente dal contesto.
- Fonte: piano TSK (TPM), step eseguiti nella sessione, annotazioni `wiki/log.md`.
- **Non inventare step**: lista vuota → `[]` (mai `null`).
- Single source: la sessione corrente, non un file di stato persistente.

### Vincoli enforced

- **5 campi obbligatori quando flag attivo**: assenza di uno → STOP «missing required field in Temporal Handoff Block: <field>».
- **`context_summary` mai vuoto**: `null` o `""` → STOP «context_summary cannot be empty».
- **Append-only su `completed_steps[]`**: ogni handoff aggiunge, mai modifica retroattivamente.
- **No future prediction su `pending_steps[]`**: dichiarati nel piano TSK (TPM/Arch al kickoff), non stimati a runtime.
- **UTC ISO-8601 con Z** su tutti i timestamp (ADR-030 §A).

### Backward compat

- `temporal.enabled: false` (default) O `temporal.handoff_protocol.enabled: false`: skill si
  comporta identica a v2.7. Nessun nuovo ERROR/WARNING. R.P3.
- `temporal.handoff_protocol.enabled: true` AND `temporal.enabled: false`: fail-loud al boot
  «`temporal.handoff_protocol.enabled` richiede `temporal.enabled: true`. Vedi ADR-031 §B».
- `temporal.handoff_protocol.enabled: true` AND `temporal.context_injection.enabled: false`:
  WARNING-only (dipendenza soft su `task_started_at` per calcolo `elapsed_ms`).

Cross-link: [[temporal-awareness-multiagent-patterns]] §Pattern 4 | [[snapshot-on-context-switch]] |
ADR-031 (backward compat) | ADR-030 (time semantics) | ADR-028 (state file integration) |
ADR-029 (state machine activation policy). Gap chiuso: `temporal-handoff-protocol-fields-missing`
in `wiki/gaps.md` (2026-06-04 18:30 — closed by US-046 EP-011).

---

## Suggerimento post-esecuzione (EP-033, v2.24)

> **Trigger**: il dev-agent esegue questa sezione al termine di ogni TSK, immediatamente
> prima di terminare l'handoff. Se il layer del TSK non ha regole definite nella tabella
> sotto → no-op silenzioso; la sezione non compare nell'output.

### Dati letti

1. **Frontmatter TSK** (gia' in contesto): campo `layer` e path/id della US di appartenenza.
2. **`factory.config.yaml`**: flag opt-in capability:
   - `a11y.enabled`
   - `ux_ui.enabled`
   - `fe_correctness.visual_oracle.enabled`
   - `code_quality.enabled`
3. **`wiki/log.md`**: entry recenti sulla stessa US — per deduplication (non suggerire
   una capability gia' registrata nella sessione corrente per la stessa US).

### Regole per layer

| Layer | Suggerimenti (se comando installato + non gia' eseguito per questa US) |
|---|---|
| fe | `/a11y` (se `a11y.enabled: true`), `/ux-ui-review` (se `ux_ui.enabled: true`), `/visual-oracle` (se `fe_correctness.visual_oracle.enabled: true`), `/prototype <US-id>` (se `prototyping.enabled: true` e la US ha design-spec.md ma nessun prototipo recente registrato in `wiki/log.md` per questa US nella sessione corrente) |
| be | `/review` (focus robustezza) |
| db | `/review` (focus robustezza); nota sulla backup strategy se il TSK include migration DDL |
| qa | suggerimento `flakiness-detection-protocol` se il TSK include test asincroni rilevati nel contesto |
| docs | `/lint` per verifica integrazione wiki |

### Gate installazione

Prima di emettere ogni suggerimento, il dev-agent verifica che il file
`.claude/commands/<comando>.md` esista nel repo corrente. Se il file non esiste
→ suggerimento soppresso silenziosamente (nessun WARNING, nessun output aggiuntivo).

Esempio: se `a11y.enabled: true` ma `.claude/commands/a11y.md` non esiste,
il suggerimento `/a11y` e' soppresso.

### Deduplication

Il dev-agent legge le entry recenti di `wiki/log.md` relative alla US corrente
(ricerca per id US nel testo delle entry). Se una capability e' gia' registrata come
eseguita per quella US nella sessione corrente → suggerimento soppresso.

Questo evita di suggerire due volte la stessa cosa sulla stessa US in piu' TSK
consecutivi.

### Formato output (condizionale)

La sezione `## Suggerimento post-esecuzione` appare nell'output dell'handoff
**solo se** almeno un suggerimento supera tutti i gate (installazione + deduplication).

Se 0 suggerimenti rilevanti → la sezione non compare. Comportamento invariato vs v2.23.

Formato (max 3 suggerimenti; se >3 capability rilevanti, priorita' alle capability
gia' installate — always-on prima di opt-in):

```
## Suggerimento post-esecuzione

TSK <LAYER> completato. Potresti considerare:
- `/<comando>` — <motivazione breve, max 1 riga, specifica per il layer>.
- `/<comando>` — <motivazione breve>.
```

Esempio per layer `fe`:

```
## Suggerimento post-esecuzione

TSK FE completato. Potresti considerare:
- `/a11y` — verifica accessibilita' WCAG 2.2 AA sui componenti appena prodotti.
- `/ux-ui-review` — review UX/UI se sono state introdotte nuove interfacce utente.
```

### Tono

Sempre "Potresti considerare", "E' disponibile" — mai imperativo ("Devi", "E' richiesto").
L'handoff e' uno strumento di chiusura, non un gate bloccante.

### Backward compat

Factory senza le capability suggerite (flag spenti, comandi non installati) → tutti
i gate falliscono silenziosamente → nessuna sezione `## Suggerimento post-esecuzione`
nell'output. Comportamento identico a v2.23 (R.P3).

Cross-link: US-115 (EP-033) | [[runtime-suggestions-proposal-comparison]] §Proposta B |
[[capability-map]] | `CAPABILITIES.md` (US-110 EP-032).
