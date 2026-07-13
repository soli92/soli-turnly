---
status: current
capability: EP-015
pattern_ref: PATTERN §20.4 R.C7
adr: [ADR-047, ADR-048, ADR-049, ADR-050]
related_us: [US-058, US-059, US-060]
opt_in: compression.output.{decision_anchor,consistency_check}.enabled
---

# Runbook: Decision-Preserving Compression

> Playbook operativo end-to-end di EP-015: come abilitare e gestire la compressione
> *decision-preserving* (decision_anchor non comprimibile + consistency-checker indipendente
> + ban `aggressive` su chain profonde + migration soft per factory esistenti). Chiude il
> rischio premortem **T3** "Context Pollution / context rot in handoff compressi".
> [^src: design_&_architecture/decisions/ADR-051.md §B]

## 1. Prerequisiti

- `compression.output.enabled: true` già configurato (asse output, PATTERN §20).
- Almeno una delle feature attivate:
  - `compression.output.decision_anchor.enabled: true` (US-058, ADR-047), oppure
  - `compression.output.consistency_check.enabled: true` (US-059, ADR-048).
- R.C7 ban (PATTERN §20.4): attivo automaticamente quando `compression.output.enabled: true`
  (nessun prerequisito extra; a flag `compression.output.enabled: false` R.C7 è no-op).
  [^src: PATTERN.md §20.4 R.C7] [^src: design_&_architecture/decisions/ADR-049.md §B]

> Pattern opt-in (R.P3 / R.C6): a tutti i flag EP-015 `false` (default factory derivate) il
> comportamento è identico a v2.18 — zero modifiche al workflow. [^src: design_&_architecture/decisions/ADR-051.md §Backward compat]

## 2. Setup decision_anchor (US-058)

1. Impostare `compression.output.decision_anchor.enabled: true` in `factory.config.yaml`.
2. Assicurare che l'orchestrator (o `lead-architect` durante Plan Fase 1) popoli il campo
   `decision_anchor` nel task package al momento della creazione — **write-once**, single
   writer; i sub-agent sono read-only. [^src: design_&_architecture/decisions/ADR-047.md §E]
3. Verificare che `dev-handoff.md` e `vcs-handoff.md` aggiornati (TSK-116) siano presenti:
   includono il check pre-handoff `[anchor-stripped]` / `[anchor-checksum-mismatch]`.
   [^src: design_&_architecture/decisions/ADR-047.md §F]
4. Test: chain 5-hop → `decision_anchor.checksum` invariato a ogni hop (byte-equal del
   metadata; il blocco è isolato dalla pipeline caveman e propagato through invariato).
   [^src: design_&_architecture/decisions/ADR-047.md §G]

Schema completo, sezione testuale marker `## DECISION ANCHOR (DO NOT COMPRESS)`, derivazione
checksum, esempi canonici cross-adapter: vedi [[decision-anchor-runbook]] (TSK-115).

## 3. Setup consistency-checker (US-059)

1. Impostare `compression.output.consistency_check.enabled: true`.
2. Scegliere `trigger`: `per_review_iter` (default) | `per_handoff` | `per_wave_close`.
   Trade-off overhead/copertura: `per_handoff` = alto/massima, `per_wave_close` = basso/ridotta.
   [^src: design_&_architecture/decisions/ADR-048.md §C]
3. Abilitare il dominio scheduler: `scheduler.domains.consistency-check: on` (default `off`).
   Il checker è l'agente terzo dedicato `consistency-checker` (read-only, context separato,
   `actor_id != sub-agent` enforced — no self-evaluation). [^src: design_&_architecture/decisions/ADR-048.md §A §I §J]
4. Test: output di un sub-agent con contraddizione critica + `confidence > 0.7` rispetto a
   una decisione dell'anchor → verdict `fail` + escalate gate umano (no auto-rollback in v2.19).
   [^src: design_&_architecture/decisions/ADR-048.md §F §G]

> **Degraded mode**: con `consistency_check.enabled: true` ma `decision_anchor.enabled: false`,
> il checker non ha anchor da leggere → WARNING soft "consistency check requires decision_anchor
> enabled". Abilitare entrambi i flag. [^src: design_&_architecture/decisions/ADR-048.md §Backward compat]

## 4. Migration v2.18 → v2.19 (R.C7)

**Scenario**: factory v2.18 con `compression.output.policy_profile: aggressive` esistente.

Comportamento automatico al primo handoff multi-hop dopo l'upgrade a v2.19, se R.C7 triggera —
`(chain_depth > 3 AND active_capabilities > 5) OR chain_depth > 5` (soglie strict `>`):
[^src: design_&_architecture/decisions/ADR-049.md §A §C] [^src: design_&_architecture/decisions/ADR-050.md §A]

- Default (`migration.strict: false`):
  - Downgrade runtime automatico `aggressive → conservative` (**NON** persisted in config — R.A1,
    il framework non auto-modifica `factory.config.yaml`). [^src: design_&_architecture/decisions/ADR-050.md §E]
  - WARNING fail-loud in `wiki/log.md`: marker `[R.C7-migration:soft]` (con `chain_depth`,
    `active_capabilities`, `from/to`, recommendation). [^src: design_&_architecture/decisions/ADR-050.md §B]
  - Telemetria EP-013 `state: compression_downgrade` (`migration_mode: soft`).
    [^src: design_&_architecture/decisions/ADR-050.md §D]
  - Il workflow prosegue con `conservative`.
- Azione consigliata: aggiornare esplicitamente `factory.config.yaml` →
  `compression.output.policy_profile: conservative` (il WARNING viene ri-emesso ad ogni run
  finché la config non è corretta — no "warning fatigue mitigation", deliberato).
  [^src: design_&_architecture/decisions/ADR-050.md §E]
- Per hard fail invece di soft: `compression.output.migration.strict: true` → abort workflow +
  instruction strutturata per il maintainer (marker `[R.C7-migration:strict]`).
  [^src: design_&_architecture/decisions/ADR-050.md §C]

> Pre-warning opzionale post-upgrade: con `compression.output.migration.audit_after_upgrade: true`,
> il Lint Check `4t-migration` (INFO) stima `chain_depth`/`capabilities` al primo run.
> [^src: design_&_architecture/decisions/ADR-050.md §I]

## 5. Debugging consistency findings

- `verdict: warn` persistente: contraddizione possibile ma non confermata (severity `major/minor`,
  o `critical` con `confidence ≤ 0.7`). Rivedere i findings nel log; considerare di abbassare il
  `warn_threshold_chain_depth` oppure aumentare il `token_budget_max` se il checker entra in
  degraded mode per cap exceeded. [^src: design_&_architecture/decisions/ADR-048.md §F §H]
- `checker_budget_exceeded: true` (verdict forzato `warn`): il checker ha superato
  `consistency_check.token_budget_max` (default 5000 token/invocazione) → manual review required.
  Cross-EP: se l'overhead aggregato per wave > 5% del wave budget, il governor EP-014 emette
  `escalate` separatamente. [^src: design_&_architecture/decisions/ADR-048.md §H]
- `[anchor-stripped]` in `wiki/log.md`: il `decision_anchor` era presente in input ma assente in
  output del handoff → `dev-handoff.md` o `vcs-handoff.md` non aggiornati (TSK-116 mancante).
  Abort del handoff (fail-closed). [^src: design_&_architecture/decisions/ADR-047.md §F]
- `[anchor-checksum-mismatch]` / `[anchor-tampered]`: il checksum derivato dalla sezione testuale
  non matcha il `checksum` del metadata (doppia ridondanza violata) → modificazione mid-chain
  tentata. Rollback del task package (l'anchor è write-once; cambio = nuovo task package).
  [^src: design_&_architecture/decisions/ADR-047.md §A §D §E]
- `[chain-depth-regression]`: il counter `chain_depth` è decrescito mid-chain (deve essere
  monotòno crescente da `task_started_at`) → ERROR + abort. [^src: design_&_architecture/decisions/ADR-049.md §E]
- R.C7 WARNING in lint (`[R.C7-migration:soft]`): aggiornare `policy_profile` a `conservative`
  in `factory.config.yaml` per silenziare (vedi §4). [^src: PATTERN.md §20.4 R.C7]

## 6. Cross-adapter marcatori `<<...>>`

I template nella sezione testuale del `decision_anchor` (e gli esempi del runbook anchor) usano
marcatori `<<...>>` come template slot. Ogni adapter sostituisce con i valori reali al render:
[^src: design_&_architecture/decisions/ADR-047.md §C]

- `.claude/`: variabili inline del prompt (sostituzione al render del system/task prompt).
- `.cursor/`: variable interpolation nel sistema di rules.
- `.aider/`: template file con placeholder.

**Nessun adapter stampa `<<...>>` letteralmente all'utente.** Il heading
`## DECISION ANCHOR (DO NOT COMPRESS)` è esatto e case-sensitive (pattern parallelo ai
`<!-- begin: do not edit -->` block dei generatori).

## 7. Cross-link

- Runbook anchor: [[decision-anchor-runbook]] (TSK-115) — schema metadata + sezione testuale +
  checksum + write-once + propagazione + esempi.
- PATTERN §20.4 R.C7 (decision anchor non comprimibile + ban `aggressive` su chain profonde) +
  ADR-047 (anchor) / ADR-048 (consistency-checker) / ADR-049 (R.C7) / ADR-050 (migration) /
  ADR-051 (schema consolidato). [^src: PATTERN.md §20.4 R.C7]
- Config: `factory.config.yaml.compression.output.{decision_anchor,consistency_check,migration}`.
  [^src: design_&_architecture/decisions/ADR-051.md §A]
- Dominio scheduler `consistency-check` (PATTERN §18.7) + agente `consistency-checker` + skill
  `consistency-check-protocol`. [^src: design_&_architecture/decisions/ADR-051.md §C]
- EP-014 governor interazione: [[ep-014-temporal-budget-governor-synthesis]] +
  `wiki/runbooks/temporal-budget-governor-runbook.md` — il `downgrade` del governor consulta R.C7
  prima dello switch di profilo. [^src: design_&_architecture/decisions/ADR-049.md §G]
- Synthesis EP-015: [[ep-015-decision-preserving-compression-synthesis]] (TSK-120).
