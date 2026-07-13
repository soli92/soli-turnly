---
status: current
capability: EP-014
pattern_ref: PATTERN §18.8
skill: .claude/skills/temporal-budget-governor.md
adr: [ADR-043, ADR-044, ADR-045, ADR-046]
---

# Runbook: Temporal Budget Governor

> Runbook operativo per il **Temporal Budget Governor** (EP-014): 2° asse di
> terminazione del loop evaluator-optimizer, bound economico complementare a
> `code_quality.max_iterations`. Il governor **comunica** un verdict, il **chiamante
> esegue** (separation of concerns, ADR-043 §C).
> [^src: .claude/skills/temporal-budget-governor.md §Skill]
> [^src: design_&_architecture/decisions/ADR-043.md]

## 1. Prerequisiti

- `factory.config.yaml` con il blocco `temporal.budget.*` presente (master switch
  `temporal.budget.enabled`, soglie `thresholds.*`, `bootstrap.*`). [^src: factory.config.yaml §temporal.budget]
- Hard dependency upstream: `temporal.enabled: true` (EP-011 Temporal Awareness
  Layer) per alimentare `elapsed`. [^src: factory.config.yaml §temporal]
- Wave plan §18.6 prodotto da `parallel-scheduling`, con i campi `token_budget`,
  `elapsed`, `estimated_remaining`, `bootstrap_mode`. [^src: .claude/skills/parallel-scheduling.md §Temporal Budget Hook]
- Almeno una fonte di budget attiva lungo la cascata 4-livelli (vedi §4):
  EP-010 (P85 per-layer) | EP-013 (baseline) | `token_budget_source: fixed`.
- Se **nessuna** fonte attiva → degraded mode (ADR-045 §D, verdict `disabled`,
  fail-loud sull'osservatore + fail-open sull'osservato). [^src: .claude/skills/temporal-budget-governor.md §Step 1]

## 2. Setup iniziale

1. Impostare `temporal.budget.enabled: true` in `factory.config.yaml` (master switch,
   ADR-046 §A; a `false` l'intera capability è documentale, no enforcement).
2. Scegliere `token_budget_source`: `p85` (default, richiede EP-010 o baseline
   EP-013) | `p50` | `p95` | `fixed`. [^src: factory.config.yaml §temporal.budget.token_budget_source]
3. Se `fixed`: impostare `temporal.budget.wave.token_budget_fixed` (default `100000`).
4. Selezionare i livelli di granularità annidata (ADR-044 §A): `wave.enabled`
   (default `true`), `tsk.enabled` (default `false`), `sprint.enabled` (default
   `false`). [^src: factory.config.yaml §temporal.budget.wave §tsk §sprint]
5. Prima factory run: bootstrap attivo finché N eventi storici < `bootstrap.min_n`
   (default `10`). Vedi §4.
6. Abilitare il dominio scheduler: `scheduler.domains.budget: on` (default `off`).
   Senza questo, il governor non è invocato in-loop. [^src: PATTERN.md §18.8]

## 3. Tuning soglie

`ratio = elapsed / token_budget`. 5 zone, 4 soglie numeriche configurabili
(zona verde e zona nera sono derivate). [^src: .claude/skills/temporal-budget-governor.md §Step 2]
[^src: factory.config.yaml §temporal.budget.thresholds]

| Soglia | Default | Effetto | Quando modificarla |
|--------|---------|---------|--------------------|
| `green` | `0.5` | `ratio < green` → `proseguire` (verde, derivata) | alzare se il governor triggera troppo presto |
| `yellow` | `0.75` | `green <= ratio < yellow` → `downgrade` | consultare R.C7 EP-015 prima del downgrade (ADR-049) |
| `orange` | `1.0` | `yellow <= ratio < orange` → `escalate` | abbassare per gate umano più conservativo |
| `red` | `2.0` | `orange <= ratio < red` → `replan`; `ratio >= red` → `hard-stop` (nera, derivata) | alzare se hard-stop scatta troppo spesso su volumi alti |

Le soglie sono **per factory, non globali** (ADR-043 §B, opt-in per factory).
[^src: design_&_architecture/decisions/ADR-043.md §B]

## 4. Bootstrap (cold-start N=0)

Cascata 4-livelli (ADR-045 §A): [^src: .claude/skills/temporal-budget-governor.md §Step 1]

```
1. PERT seed EP-010 (P85 per-layer, ex-ante)
   ↓ se EP-010 non attivo / P85 non disponibile
2. Baseline EP-013 (analytics/reports/baseline/, ex-post)
   ↓ se EP-013 non attivo / baseline assente
3. Fallback fisso bootstrap.wave_default_tokens (default 100000)
   ↓ se non configurato
4. Degraded mode → verdict `disabled`, WARNING fail-loud in wiki/log.md, no enforcement
```

- **Bootstrap mode**: attivo quando N eventi `state: finished` con `tokens` non nullo
  < `bootstrap.min_n` (default `10`). Valutato **per livello** (wave/tsk/sprint);
  ogni livello esce indipendentemente. Sprint-level usa cap rigido N < 3. [^src: .claude/skills/temporal-budget-governor.md §Step 1]
- **Auto-uscita** (ADR-045 §F): a N >= `min_n` il governor smette di marcare
  `bootstrap_mode: true`, re-computa le distribuzioni P85 e usa la fonte primaria.
  Emette evento `state: governor_bootstrap_exit` con `metadata.exit_n: <N>`.
- **`very_cautious_mode: true`** (ADR-045 §H, default `false`): durante bootstrap il
  governor restituisce sempre `disabled` (shadow-mode observe-only, no enforcement).
  [^src: factory.config.yaml §temporal.budget.bootstrap.very_cautious_mode]

## 5. Verdetti operativi

Il governor produce il payload `governor_decision` (ADR-043 §C); il chiamante esegue
(Orchestrator / `code-review-protocol` / `premortem-protocol` / `parallel-scheduling`).
[^src: .claude/skills/temporal-budget-governor.md §Step 3]

| Verdict | Zona | Azione del chiamante | Responsabile |
|---------|------|----------------------|--------------|
| `proseguire` | verde | nessuna; loop continua | chiamante |
| `downgrade` | gialla | switch profilo compression → `conservative` **dopo** check R.C7 EP-015 (ADR-049) | chiamante |
| `escalate` | arancione | gate umano fail-loud informato (opzioni c/a/r) | chiamante |
| `replan` | rossa | rollback ultima decisione + re-dispatch con `alternative_strategy`; fallback a `escalate` se nessuna | chiamante |
| `hard-stop` | nera | terminazione immediata + marker `[hard-stop]` in `wiki/log.md`, NO auto-restart | chiamante |
| `disabled` | — | degraded mode / very_cautious bootstrap; nessun enforcement, WARNING in log | chiamante |

**Verdict aggregato multi-livello** (ADR-044 §E): se più livelli triggerano insieme,
vince il più severo: `hard-stop > replan > escalate > downgrade > proseguire`. [^src: design_&_architecture/decisions/ADR-044.md §E]

## 6. Self-observation

Ogni evento `governor_decision` conta `governor_tokens_used` (overhead). Se l'overhead
aggregato per wave > **5%** di `wave.token_budget` → verdict forzato `escalate` con
`escalate_message: "governor self-overhead exceeded"` ("il governor che si auto-osserva
è suspect"). Monitorare il campo `governor_tokens_used` in
`analytics/events/<YYYY-MM>.jsonl`. [^src: .claude/skills/temporal-budget-governor.md §Step 4]

## 7. Troubleshooting

- **Check 4u WARNING in `/lint`**: wave chiusa (`state: wave_completed`) senza evento
  `state: governor_decision` mentre `temporal.budget.required_on_wave_close: true`.
  Cause: budget abilitato ma dominio scheduler `budget` non attivo
  (`scheduler.domains.budget: off`), oppure `required_on_wave_close: true` configurato
  accidentalmente. Fix: attivare il dominio, invocare il governor, oppure aggiungere
  `temporal_budget_skip_reason: "<motivo>"` al TSK / metadata wave plan, oppure
  disabilitare il check con `required_on_wave_close: false`. [^src: .claude/skills/lint-checks.md §4u]
- **Governor in degraded mode (`disabled`)**: nessuna fonte di budget disponibile e
  `bootstrap.wave_default_tokens` non configurato. Fix: configurare un valore esplicito
  o abilitare EP-010 / EP-013. [^src: .claude/skills/temporal-budget-governor.md §Step 1]
- **Hard-stop inatteso**: `thresholds.red` troppo basso per il volume di task. Alzare la
  soglia o disabilitare il livello (es. `sprint.enabled: false`).

## 8. Cross-link

- PATTERN §18.8 (Temporal Budget Hook) + §3 «Temporal Budget Governance». [^src: PATTERN.md §18.8]
- ADR-043 (semantica 5 soglie) / ADR-044 (granularità 3 livelli) / ADR-045 (bootstrap +
  degraded mode) / ADR-046 (schema config + §18.8 + Check 4u + frontmatter).
- Skill: `.claude/skills/temporal-budget-governor.md`.
- Hook scheduler: `.claude/skills/parallel-scheduling.md` §Temporal Budget Hook.
- Lint: `.claude/skills/lint-checks.md` Check 4u.
- Config: `factory.config.yaml.temporal.budget.*`.
- EP-015 R.C7 interazione (consultata prima di `downgrade`):
  `wiki/runbooks/decision-preserving-compression-runbook.md` (stub — runbook EP-015
  non ancora creato; ADR-049). [^src: design_&_architecture/decisions/ADR-046.md §C]
- Synthesis EP-014: `wiki/syntheses/ep-014-temporal-budget-governor-synthesis.md`.
