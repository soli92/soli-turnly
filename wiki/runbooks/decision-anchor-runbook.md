---
status: current
capability: EP-015
pattern_ref: PATTERN §20.4 R.C7
adr: [ADR-047, ADR-048, ADR-049, ADR-050]
related_us: [US-058]
opt_in: compression.output.decision_anchor.enabled
---

# Runbook: Decision Anchor

> Playbook operativo del `decision_anchor`: schema metadata YAML + sezione testuale marker (doppia ridondanza), checksum sha256, write-once, propagazione obbligatoria inter-hop, esclusione dalla compressione caveman, telemetria EP-013, esempi canonici cross-adapter.

## 1. Scopo

Il `decision_anchor` è un meccanismo di **doppia ridondanza** per preservare le decisioni
architetturali (ADR del lead-architect, vincoli del tech-scout) intatte attraverso chain di
handoff multi-hop, anche con `compression.output.policy_profile: aggressive` attivo.

Archetype di rischio mitigato: "Context Pollution" (Pan et al., premortem T3 §storia). Il
principio architetturale è **belt-and-suspenders** (cintura + bretelle): due meccanismi
indipendenti — campo metadata strutturato (semantica) + sezione testuale marker (visibilità
LLM nel prompt rendered) — proteggono la stessa proprietà (decision integrity inter-hop),
in modo parallelo a TCP checksum + IP checksum. [^src: design_&_architecture/decisions/ADR-047.md §Contesto §Rationale]

## 2. Schema decision_anchor (YAML metadata)

```yaml
decision_anchor:
  version: 1
  created_at: <ISO-8601>              # allineato a task_started_at EP-011 US-045
  decisions:
    - id: <slug-univoco>              # es. "stack-choice", "no-ssr", "pattern-version"
      decided_by: <actor_id>          # es. "lead-architect", "tech-scout"
      decided_at: <ISO-8601>
      adr_ref: <ADR-NNN|null>         # link ADR canonico (raccomandato)
      decision: <string>              # es. "Stack: Next.js 14 + Prisma"
      rationale: <string max 200ch>   # block list PII coerente con EP-013 US-054
  checksum: <sha256>                  # HMAC-SHA256 del campo `decisions[]` serializzato
```

- `decisions[]` max 20 elementi (cap soft — WARNING oltre il limite, no ERROR).
- `decision.id` slug univoco nell'anchor.
- `rationale` max 200 caratteri (boundary PII; oltre il limite → ERROR, coerente con P0 ADR-040 §B cat 7 + EP-013 US-054).
- `adr_ref` opzionale ma raccomandato per tracciabilità.
- `checksum` calcolato sulla serializzazione canonica di `decisions[]` (JSON/YAML sorted keys, no trailing whitespace). [^src: design_&_architecture/decisions/ADR-047.md §B §J]

## 3. Sezione testuale marker (rendered nel prompt sub-agent)

Posizione canonica: **dopo il Temporal Context EP-011 US-045, prima delle istruzioni operative**.
Il heading `## DECISION ANCHOR (DO NOT COMPRESS)` è esatto e case-sensitive (pattern parallelo
ai `<!-- begin: do not edit -->` block dei generatori). [^src: design_&_architecture/decisions/ADR-047.md §C]

```
## DECISION ANCHOR (DO NOT COMPRESS)
Version: <<anchor.version>> · Created: <<anchor.created_at>> · Checksum: <<anchor.checksum[:8]>>

<<for each decision in anchor.decisions>>
<<idx>>. [<<decision.id>>] (deciso da <<decision.decided_by>>, <<decision.decided_at>>, ref <<decision.adr_ref|"nessuno">>):
   <<decision.decision>>
   Razionale: <<decision.rationale>>

<<endfor>>
```

Note cross-adapter: i marcatori `<<...>>` sono template slot — ogni adapter (Claude Code, Cursor,
Aider) sostituisce con i valori reali; nessun adapter stampa `<<...>>` letteralmente.

## 4. Doppia ridondanza e checksum

L'anchor implementa **doppia ridondanza**: campo metadata strutturato (semantica) + sezione
testuale marker (leggibilità per LLM).

Regola:
- `checksum` nel YAML metadata = `sha256(canonical_json(decisions[]))`.
- `checksum[:8]` mostrato nella sezione testuale (8 caratteri hex, sufficiente per audit visivo; il `checksum` completo vive nei metadata).
- Il checksum derivato dalla sezione testuale (re-parsing dei campi numerati `[slug]` + actor + ts + ref + decisione + rationale → canonical YAML → sha256) DEVE matchare il `checksum` nei metadata.
- Se i due non matchano → **ERROR fail-loud** + marker `[anchor-checksum-mismatch]` in `wiki/log.md`.
  Pipeline si ferma; nessuna operazione eseguita (fail-closed). [^src: design_&_architecture/decisions/ADR-047.md §A §D]

Dettaglio del marker di log in caso di mismatch:

```
[anchor-checksum-mismatch] hop_id=<id> ts=<ts>
  metadata_checksum: sha256:abcd1234...
  textual_checksum:  sha256:9876fedc...
  diff: <decisions[i] field mismatch>
```

## 5. Write-once

L'anchor è creato dall'orchestrator (o da `lead-architect` durante Plan Fase 1) al momento del
task package creation. È **immutabile** durante la chain: [^src: design_&_architecture/decisions/ADR-047.md §E]

- Tentativo di modifica mid-chain → **escalate gate umano** fail-loud (non auto-update).
- Cambio anchor = cambio di fondamenta = nuovo task package (rollback completo, scope creep).
- L'orchestrator è l'**unico writer** dell'anchor (pattern parallelo a R.S2 single-writer per file); i sub-agent sono read-only (pattern parallelo a `code-reviewer` CQRL R.Q1).

## 6. Propagazione obbligatoria inter-hop

Ogni handoff inter-agent (`dev-handoff`, `vcs-handoff`, handoff EP-011 US-046) **deve** includere
il campo `decision_anchor` invariato (stessa struttura YAML + stessa sezione testuale). [^src: design_&_architecture/decisions/ADR-047.md §F]

Verifica pre-handoff (enforced in skill, fail-closed):
1. Controlla che `decision_anchor` sia presente nell'handoff output.
2. Controlla che il checksum sia invariato rispetto all'anchor di input.
3. Se anchor assente (presente in input, assente in output) → **ERROR** + marker `[anchor-stripped]` in `wiki/log.md` + abort del handoff.
4. Se checksum diverge → ERROR fail-loud + `[anchor-tampered]` (marker `[anchor-checksum-mismatch]` per il caso di inconsistenza interna metadata↔testuale).

Pseudocode del check:

```
function pre_handoff_check(input, output):
  if input.has(decision_anchor) and not output.has(decision_anchor):
    log_error("[anchor-stripped] hop_id=<id> from=<actor>")
    abort_handoff()
  if output.has(decision_anchor):
    if not verify_checksum_consistency(output.decision_anchor):
      log_error("[anchor-checksum-mismatch] ...")
      abort_handoff()
```

## 7. Esclusione dalla compressione caveman

Regola R.C7 (PATTERN §20.4, aggiornata in TSK-119): il blocco `decision_anchor` è **non comprimibile**.
La pipeline caveman lo isola e lo passa through byte-equal, indipendentemente da: [^src: design_&_architecture/decisions/ADR-047.md §G] [^src: design_&_architecture/decisions/ADR-049.md]

- profilo (`conservative`, `aggressive`, `custom`)
- chain depth
- `active_capabilities` count

Implementazione in `caveman-protocol.md` (Develop US-058+US-060): estrae il blocco anchor
(entrambe le forme) prima di comprimere, comprime il resto del payload, riattacca l'anchor
invariato (pattern parallelo a "preserve metadata, compress content" — HTTP gzip preserva headers).

```
function caveman_compress(payload, profile):
  anchor_block = extract_decision_anchor(payload)  # metadata + textual marker
  compressed_payload = compress(payload_without_anchor, profile)
  return reattach_anchor(compressed_payload, anchor_block)
```

## 8. Telemetria EP-013

Ogni creazione/lettura dell'anchor emette evento nel stream EP-013 (nuovo enum `anchor_propagated`
allo `state`, coperto da ADR-042 P0 schema-permissive extension): [^src: design_&_architecture/decisions/ADR-047.md §I]

```json
{
  "state": "anchor_propagated",
  "task_id": "<task_id>",
  "ts": "<ISO-8601>",
  "anchor": {
    "checksum": "<sha256>",
    "decisions_count": <int>,
    "hop_id": "<uuid>"
  }
}
```

Lint Check 4w (P0 ADR-042 §H) eventualmente esteso per validare la presenza di `anchor_propagated`
quando `compression.output.decision_anchor.enabled: true`.

## 9. Esempi canonici

### Esempio 1 — Task package con 2 decisioni

```yaml
decision_anchor:
  version: 1
  created_at: "2026-06-08T10:00:00Z"
  decisions:
    - id: "stack-choice"
      decided_by: "lead-architect"
      decided_at: "2026-06-01T09:00:00Z"
      adr_ref: "ADR-023"
      decision: "Stack: Next.js 14 + Prisma + PostgreSQL 16"
      rationale: "Ecosistema maturo, team experience, SSR nativo"
    - id: "no-microservices"
      decided_by: "lead-architect"
      decided_at: "2026-06-01T09:00:00Z"
      adr_ref: null
      decision: "Architettura monolitica modulare, NO microservizi"
      rationale: "Team size 2 dev, overhead infra non giustificato"
  checksum: "a3f7c2e1d..."
```

### Esempio 2 — Sezione marker resa nel prompt

```
## DECISION ANCHOR (DO NOT COMPRESS)
Version: 1 · Created: 2026-06-08T10:00:00Z · Checksum: a3f7c2e1

1. [stack-choice] (deciso da lead-architect, 2026-06-01, ref ADR-023):
   Stack: Next.js 14 + Prisma + PostgreSQL 16
   Razionale: Ecosistema maturo, team experience, SSR nativo

2. [no-microservices] (deciso da lead-architect, 2026-06-01, ref nessuno):
   Architettura monolitica modulare, NO microservizi
   Razionale: Team size 2 dev, overhead infra non giustificato
```

## 10. Backward compat

`compression.output.decision_anchor.enabled: false` (default factory derivate): [^src: design_&_architecture/decisions/ADR-047.md §K] [^src: design_&_architecture/decisions/ADR-050.md]

- Anchor non generato, non verificato, non propagato.
- Comportamento identico v2.18 (R.P3 invariata).
- Se `compression.output.enabled: true` con `aggressive` su chain multi-hop SENZA anchor:
  → SOFT WARNING: "aggressive compression on multi-hop chain without anchor — risk T3" (no hard fail, pattern soft migration ADR-050).

## 11. Cross-link

- PATTERN §20.4 R.C7 (non comprimibile + ban aggressive su chain profonde)
- ADR-047 (schema) + ADR-048 (consistency-checker) + ADR-049 (R.C7) + ADR-050 (migration)
- EP-011 US-046: `decision_anchor` è campo separato del handoff (parallelo a `context_summary`)
- EP-013 US-054: block list PII applicata a `rationale`
- Runbook: [[decision-preserving-compression-runbook]] (TSK-120)
- Skill: `dev-handoff.md` + `vcs-handoff.md` (aggiornate in TSK-116)

## 12. Attivazione operativa

> Sezione aggiunta da TSK-163 (US-083). Copre prerequisiti, procedura step-by-step,
> verifica post-attivazione, rollback e self-application nel meta-framework.

### 12.1 Prerequisiti

Prima di attivare `decision_anchor`, verificare:

1. **`compression.output.enabled: true`** in `factory.config.yaml` — requisito necessario.
   Il `decision_anchor` è un'estensione del layer di compressione output (EP-015); senza
   il layer base attivo il flag `decision_anchor.enabled` è no-op.

2. **WARNING atteso su `policy_profile: aggressive`** (R.C7): se il profilo aggressivo è
   attivo contemporaneamente a chain depth > 3 o `active_capabilities` > 5, il sistema
   emette un WARNING di sicurezza — questo è il **comportamento atteso** (ADR-049 §B),
   non un errore. Il WARNING segnala che il rischio T3 (Context Pollution) è mitigato
   dall'anchor ma il profilo aggressive su chain profonde rimane ad alto rischio di drift
   cumulativo. Non richiede azione correttiva immediata, ma è raccomandato monitorare
   `wiki/log.md` per marker `[anchor-checksum-mismatch]`.

3. **Python 3.8+** disponibile nel contesto di esecuzione per il calcolo del checksum
   sha256 (usato dalla skill `caveman-protocol` per `extract_decision_anchor`).

4. **Telemetria EP-013 attiva** (opzionale ma raccomandato): `analytics.measurement.enabled: true`
   + `analytics.dogfooding.enabled: true` — consente il tracking degli eventi
   `anchor_propagated` per audit post-attivazione (§12.3).

### 12.2 Procedura step-by-step

**Step 1 — Aprire `factory.config.yaml`** e individuare il blocco
`compression.output.decision_anchor:`.

**Step 2 — Abilitare il flag**:

```yaml
compression:
  output:
    enabled: true                 # prerequisito — deve essere true
    # ...
    decision_anchor:
      enabled: true               # cambia da false → true
```

**Step 3 — Salvare il file**. Non sono necessari restart o reload: il flag viene
letto alla prossima invocazione di un'operazione Develop o Handoff.

**Step 4 — Verificare la coerenza** (opzionale, raccomandato):

```bash
# Esegui lint per check di configurazione
/lint
```

Il Lint Check 4s (`required_on_chain`) è di default `false` (gate empirico opt-in);
se desiderato, abilitarlo separatamente (`consistency_check.required_on_chain: true`).

**Note sull'ordine di attivazione raccomandato** (US-083):

> Attivare prima `decision_anchor`, verificare in produzione su almeno una wave
> multi-hop (§12.3), poi attivare `consistency_check`. I due meccanismi sono
> ortogonali ma il consistency-checker (ADR-048) presuppone che l'anchor sia
> stabilmente propagato: verificarlo prima riduce i falsi positivi nelle prime
> iterazioni. [^src: US-083 Acceptance Criteria]

### 12.3 Verifica post-attivazione

Dopo la prima invocazione multi-hop con `decision_anchor.enabled: true`:

**Check 1 — Assenza di marker di errore in `wiki/log.md`**:

```bash
grep -n "\[anchor-stripped\]\|\[anchor-checksum-mismatch\]" wiki/log.md
```

Output atteso: nessun risultato (0 righe). Se compaiono marker:
- `[anchor-stripped]`: l'anchor è stato perso in un handoff — vedere §6 (Propagazione
  obbligatoria) per debug.
- `[anchor-checksum-mismatch]`: inconsistenza tra metadata YAML e sezione testuale —
  verificare che nessun agente abbia modificato parzialmente l'anchor (violazione
  write-once, §5).

**Check 2 — Presenza del campo `decision_anchor:` nell'handoff inter-agent**:

Nell'output di un'operazione Develop completata, il handoff deve contenere il campo
strutturato `decision_anchor:` con lo schema completo (§2):

```yaml
# Handoff inter-agent atteso (v2.19, EP-015)
decision_anchor:
  version: 1
  created_at: "<ISO-8601>"
  decisions:
    - id: "<slug>"
      decided_by: "<actor_id>"
      decided_at: "<ISO-8601>"
      adr_ref: "<ADR-NNN|null>"
      decision: "<string>"
      rationale: "<string max 200ch>"
  checksum: "<sha256-completo>"
```

Il campo deve essere presente e **invariato** rispetto al task package originale
(stessa struttura, stesso checksum). Un handoff senza questo campo (quando
`enabled: true`) costituisce errore `[anchor-stripped]` (§6).

**Check 3 — Verifica del checksum sha256** (procedura manuale):

Il `checksum` nel campo `decision_anchor` è il sha256 della serializzazione canonica
di `decisions[]` (JSON sorted keys, no trailing whitespace). Per verificarlo
manualmente:

```python
import json, hashlib

decisions = [
    {
        "adr_ref": "ADR-023",
        "decided_at": "2026-06-01T09:00:00Z",
        "decided_by": "lead-architect",
        "decision": "Stack: Next.js 14 + Prisma + PostgreSQL 16",
        "id": "stack-choice",
        "rationale": "Ecosistema maturo, team experience, SSR nativo"
    }
    # ... tutti gli elementi di decisions[]
]

canonical = json.dumps(decisions, sort_keys=True, separators=(',', ':'))
checksum = hashlib.sha256(canonical.encode()).hexdigest()
print(checksum)  # deve corrispondere a decision_anchor.checksum nel YAML
```

La verifica manuale è utile per debug post-incident (marker
`[anchor-checksum-mismatch]`). In condizioni normali il checksum è calcolato e
verificato automaticamente dalla skill `caveman-protocol`.

**Check 4 — Evento telemetria EP-013** (se `analytics.measurement.enabled: true`):

Verificare la presenza di almeno un evento `anchor_propagated` nel file JSONL più
recente sotto `analytics/events/`:

```bash
grep '"anchor_propagated"' analytics/events/*.jsonl | head -5
```

Output atteso: una o più righe con il JSON dell'evento (schema §8).

### 12.4 Rollback

Per disabilitare `decision_anchor` dopo l'attivazione:

```yaml
compression:
  output:
    decision_anchor:
      enabled: false              # rollback: torna a false
```

Il rollback è **non distruttivo** (R.P3): [^src: design_&_architecture/decisions/ADR-050.md]

- Nessun dato viene rimosso (gli anchor già propagati restano nei log e negli handoff
  archiviati).
- Le operazioni Develop successive tornano al comportamento pre-attivazione: anchor non
  generato, non verificato, non propagato.
- Non è necessaria nessuna migrazione dati; la capability si spegne alla prossima
  invocazione.
- Se erano presenti handoff con anchor e `compression.output.enabled: true` con
  `aggressive`: il SOFT WARNING "aggressive compression on multi-hop chain without
  anchor — risk T3" (§10 Backward compat) tornerà ad essere emesso.

### 12.5 Self-application nel meta-framework

Il meta-framework stesso (questo repo `soli-multi-agents-factory`) può attivare
`decision_anchor` come test di **dogfooding** (EP-013 §Dogfooding + EP-015 insieme):

1. **Abilitare** `compression.output.enabled: true` e
   `compression.output.decision_anchor.enabled: true` in `factory.config.yaml` del
   meta-framework.
2. **Eseguire** una wave di sviluppo reale (es. `/run` con TSK docs multi-hop).
3. **Verificare** i Check 1-4 di §12.3 sul repo stesso.
4. **Raccogliere** gli eventi `anchor_propagated` come campione di riferimento per le
   factory derivate (baseline EP-013 `analytics/reports/baseline/`).

Questa self-application serve due scopi:
- **Validazione tecnica**: conferma che i meccanismi di propagazione (skill
  `dev-handoff.md`, `caveman-protocol`) funzionano end-to-end nel contesto reale.
- **RUN-REPORT** per `release_governance` (ADR-033 §D): le wave di test dogfooding
  con anchor attivo contribuiscono ai RUN-REPORT richiesti per il gate di release
  (`release_governance.min_run_reports: 3`).

> Prerequisito: `analytics.dogfooding.enabled: true` (già attivo nel meta-framework
> — `factory.config.yaml` blocco `analytics.dogfooding`). [^src: factory.config.yaml §analytics.dogfooding]
