---
id: migration-v214
type: runbook
title: "Migrazione v2.13 → v2.14 (Output Compression Layer, Fase 1 OCL)"
status: draft
created: 2026-05-28
updated: 2026-05-28
sources:
  - "PATTERN.md §0, §7 r.18, §20 (Output Compression Layer, R.C1–R.C6), §21 (Versioning)"
  - "factory.config.yaml (blocco compression:)"
  - ".claude/skills/caveman-protocol.md (5 fasi)"
  - ".claude/skills/parallel-scheduling.md (hook §20.7)"
  - ".claude/commands/compression.md"
  - ".claude/agents/orchestrator.md (caveman_policy:)"
  - ".claude/agents/wiki-keeper.md (caveman_policy:)"
  - "CLAUDE.md"
  - "wiki/concepts/factory-compression-layer.md (design doc approved)"
related:
  - factory-compression-layer
  - caveman
  - token-compression
  - parallel-scheduler
  - migration-v213
  - migration-v212
tags: [runbook, migrazione, v2-14, compression, caveman, output-compression, opt-in]
---

# Migrazione v2.13 → v2.14 (Output Compression Layer)

> Runbook della migrazione che introduce l'**Output Compression Layer** (OCL) come
> layer trasversale opt-in via [[caveman]] skill. Fase 1 della roadmap del design doc
> [[factory-compression-layer]] (approved 2026-05-28). Asse context (Graphify) → Fase 2
> v2.14 + Fase 3 v2.15 (subordinata a PoC karpathy-invariant).

## Contesto: perché v2.14

Il design doc [[factory-compression-layer]] è stato chiuso a `status: approved` il
2026-05-28 dopo iterazione di review che ha risolto 7 open questions (vedi
§Decisioni risolte del concept). La Fase 1 di implementazione targetizza l'asse
**output**: ridurre i token *generati* sui canali messaging agent-to-agent /
agent-to-tool senza toccare gli artefatti karpathy-style.

Tre motivazioni concrete (PATTERN §20):
1. **Amplificazione per wave**: con [[parallel-scheduler]] attivo (v2.11), risparmio
   per agent si propaga linearmente sull'intera wave (4 agent → 4× saving).
2. **Pipeline lunghe**: topologie `full-stack-agents` con chain orch → PM → TPM → dev
   moltiplicano i payload di handoff verbosi.
3. **Topologie federate**: factory padre/figlia con multiple wave di sub-agent.

Asse **context** (Graphify) rimandato a v2.15 per dare priorità al gate empirico
Fase 1.5 (validation su factory derivata).

## Modifiche introdotte

### PATTERN.md

- **§0**: `pattern_version: 2.14`. Aggiunta menzione di OCL nell'origine.
- **§7**: nuova regola **r.18** «Compression layer mai sugli artefatti» (numero regole
  da 17 a 18).
- **§20** (nuovo): «Output Compression Layer (v2.14)» con 9 sotto-sezioni:
  - §20.1 — Modello a un asse (v2.14: solo output; context placeholder v2.15)
  - §20.2 — Allow-list per canale e policy profile (3 profili + matrice canale × profilo)
  - §20.3 — Topology-aware default (`knowledge-only` → aggressive, full-stack/hybrid → conservative)
  - §20.4 — **Invarianti R.C1–R.C6** (estensione §7)
  - §20.5 — `factory.config.yaml.compression` schema completo
  - §20.6 — Frontmatter agent `caveman_policy:` (opzionale)
  - §20.7 — Integrazione con scheduler §18
  - §20.8 — Anti-pattern
  - §20.9 — Pipeline completa con OCL attivo (riepilogo)
- **§21**: Versioning (rinumerata da §20). Nuova entry v2.14 in cima al changelog.

### Sei invarianti R.C1–R.C6 (PATTERN §20.4)

| Invariante | Sintesi | Bypassabile? |
|---|---|---|
| **R.C1** | `to_user`, `to_artifact`, `propagate_resolution` sempre `off` | NO (anche in `custom` profile) |
| **R.C2** | Allow-list channel-aware obbligatoria; canale non identificabile → fallback normal mode + warning | NO |
| **R.C3** | Chain-depth severity ceiling (auto-downgrade `ultra → full → lite` se depth > 3) | Solo in `aggressive` (disabilitato) o `custom` con flag |
| **R.C4** | Cross-factory boundary `off` in topologie federate | NO |
| **R.C5** | Drift fallback automatico su marker `AMBIGUOUS_HANDOFF` / `REQUEST_CLARIFY` + retry single-shot normal mode | NO |
| **R.C6** | Opt-in totale (default `enabled: false`); backward compat verso v2.13 garantita | NO |

### Configurazione (`factory.config.yaml.compression`)

Nuovo blocco aggiunto. Schema v2.14:

```yaml
compression:
  output:
    provider: caveman
    enabled: false                 # DEFAULT OFF (R.C6 opt-in)
    install_command: "..."
    policy_profile: conservative   # conservative | aggressive | custom
    invariants:
      to_user: off
      to_artifact: off
      propagate_resolution: off
    channels: { ... }              # usato SOLO se policy_profile == custom
    chain_depth_downgrade: true
    chain_depth_threshold: 3
    cross_factory: off
    drift_fallback:
      enabled: true
      markers: [AMBIGUOUS_HANDOFF, REQUEST_CLARIFY]
    audit_trail_for:
      - propagate-resolution
      - feedback-router
  context:
    provider: none                 # graphify-cloud | graphify-ollama | none
    enabled: false                 # attivazione Fase 2 v2.14 (oggetto §20.5 placeholder)
```

### Skill `caveman-protocol` (5 fasi)

Nuova `.claude/skills/caveman-protocol.md`. Invocata inline dal `parallel-scheduling`:

| Fase | Scope |
|---|---|
| 1. Bootstrap | Read config, verifica `caveman --version`, carica matrice canale→livello |
| 2. Identify Channel | Determina canale da `(sender, receiver, kind)`, applica audit_trail_for e cross-factory R.C4 |
| 3. Apply Compression | Calcola livello effettivo (R.C3 chain-depth + R.C1 invariants), invoca caveman CLI |
| 4. Drift Check (R.C5) | Scansiona response per marker ambiguità, fallback automatico + log |
| 5. Log | Append a `wiki/log.md` con ratio + drift count |

### Comando `/compression`

Nuovo `.claude/commands/compression.md`. Sub-comandi:
- `show`: stato config + stats ultima sessione
- `set <key> <value>`: modifica campi (gate su invariants R.C1)
- `policy <profile>`: shortcut conservative/aggressive/custom
- `dry-run --payload="<text>"`: test offline senza side-effects

### Frontmatter agent: `caveman_policy:` (opzionale)

Aggiunto a:
- `.claude/agents/orchestrator.md`: dispatcher centrale, dichiara `to_subagent: full`
- `.claude/agents/wiki-keeper.md`: dichiara `to_sibling` e `to_artifact: off` esplicito per chiarezza karpathy preservation

I 4 dev-agent (`be/fe/db/qa-dev`) **non** hanno `caveman_policy:`: ereditano dal
profilo globale (R.C6 — campo opzionale, default da config). Aggiungere il campo
solo se si vuole override locale per debugging.

### Hook in `parallel-scheduling`

`.claude/skills/parallel-scheduling.md §Fase 5` ora include:
- Step 1: compression intercept inline (invoca `caveman-protocol §Fase 2-3` pre-dispatch)
- Step 5: drift check post-response (invoca `caveman-protocol §Fase 4`)
- Step 6 (rinumerato): VCS hand-off serializzato (R.S8 invariata)

Il `wave_report.md` include sezione `## Compression stats` con matrice `canale ×
(tokens_raw, tokens_compressed, ratio, drift_count)`.

## Procedura di adozione

### Per factory esistenti v2.13- (backward compat — R.C6)

**Zero azioni richieste**. La factory continua a funzionare identica:
- `factory.config.yaml` senza blocco `compression:` → `enabled: false` default
- Nessuna migrazione del frontmatter agent
- `caveman-protocol` no-op (Fase 1 ABORT silenzioso)

### Per attivare OCL in una factory derivata (Fase 1.5 validation)

Step 1 — Installa Caveman localmente:
```bash
curl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash
caveman --version   # deve ritornare OK
```

Step 2 — Attiva il layer:
```bash
/compression set enabled true
/compression policy conservative   # default sicuro
```

Step 3 — Verifica config:
```bash
/compression show   # mostra config + matrice canali + ultima stats (vuota)
```

Step 4 — Esegui baseline session (1-2 wave parallele) **senza** compression:
- Disattiva temporaneamente: `/compression set enabled false`
- Lancia sprint normale via `/run`
- Misura `tokens_in/out` da `memory/episodic/*-wave-*.md`

Step 5 — Riattiva e ripeti session equivalente con compression:
- `/compression set enabled true`
- Lancia sprint identico via `/run`
- Misura `tokens_in/out_compressed`

Step 6 — Confronto su 3 metriche (vedi [[factory-compression-layer]] §Fase 1.5):
- **Risparmio**: target ≥ 50%
- **Drift incidenti**: target = 0 critici
- **Qualità artefatti**: invariata (manual review wiki/TSK)

Step 7 — Decision gate:
- Metriche OK → procedi Fase 2 (Graphify code_path)
- Risparmio < 30% → passa a `aggressive` o `custom`
- Drift > 0 critico → analizza canale, valuta `custom` con canale problematico a `off`

Step 8 — Produrre `wiki/runbooks/compression-validation-YYYY-MM-DD.md` con risultati.

### Per nuove factory (post-v2.14 bootstrap)

Il `factory-bootstrap` meta-prompt (v2.14+) chiede `compression_mode` come opzione
nella Fase di input:
- `none` (default — opt-in deferred)
- `conservative` (attivo subito con profilo conservative)
- `aggressive` (per topologie `knowledge-only`)

Indipendentemente dalla scelta, il blocco `compression:` viene scaffoldato in
`factory.config.yaml` con `enabled: <true|false>` in base alla risposta utente.

## Verifica post-migrazione

Lint check di coerenza (Check 4k, da implementare in v2.15):
- `compression.output.enabled: true` ⇒ Caveman installato + topology compatibile
- `policy_profile: custom` ⇒ `channels` block completo
- Nessun agent dichiara `caveman_policy.to_user: <any-value-non-off>` (R.C1 enforced)
- Nessun agent dichiara `caveman_policy.to_artifact: <any-value-non-off>` (R.C1 enforced)

Stress test manuale:
1. Wave di 4 dev-agent paralleli con `policy_profile: conservative`
2. Verifica `wave_report.md` mostra `Compression stats` con ratio < 0.7 (almeno 30% saved)
3. Drift count = 0
4. Wiki pages / TSK prodotti invariati per qualità

## Trade-off documentati

| Pro | Contro |
|---|---|
| Risparmio 50–70% token su canali messaging | Drift cumulativo possibile su chain > 3 (mitigato R.C3) |
| Opt-in totale, zero impatto su factory v2.13- | Caveman è single-maintainer, rischio abbandono (mitigato design provider-agnostic) |
| Allow-list rigorosa preserva pattern karpathy | Aggiunge un layer di complessità da debuggare |
| Componibile moltiplicativamente con scheduler | `aggressive` può richiedere fine-tuning per topologia |
| Backward compat tot. (R.C6) | Asse context (Graphify) ancora non integrato — full saving solo v2.15+ |

## Rollback

Per disattivare totalmente OCL su una factory che l'ha attivato:

```bash
/compression set enabled false
```

L'azione è **immediata** e **reversibile** (riattivabile con `enabled true`). Lo stato
delle sessioni precedenti resta tracciato in `wiki/log.md` (marker `compression`).

Per **rimuovere completamente** il blocco compression dal `factory.config.yaml`:
edit manuale del file. Nessun impatto sugli artefatti scritti (R.C1 ha già garantito
che gli artefatti non siano mai stati toccati dalla compressione).

## Roadmap post-v2.14

Vedi [[factory-compression-layer]] §Roadmap:
- **v2.14 (corrente, Fase 1)**: Output Compression Layer (Caveman) ✓
- **v2.14 Fase 1.5**: validation empirica su factory derivata (gate pre-Fase 2)
- **v2.14 Fase 2**: Context Compression Layer base (Graphify, target: `code_path`)
- **v2.15 Fase 3a**: Karpathy preservation PoC (gate obbligatorio per Fase 3b)
- **v2.15 Fase 3b**: Wiki-as-graph (subordinata a PoC pass)

## Riferimenti

- Design doc: [[factory-compression-layer]] (concept, status: approved)
- Concept: [[caveman]], [[token-compression]], [[knowledge-graph-codebase]]
- Synthesis: [[token-reduction-tools]] (comparativa Caveman vs Graphify)
- Pattern: PATTERN.md §20 + §7 r.18 + §21
- Skill: `.claude/skills/caveman-protocol.md`
- Comando: `.claude/commands/compression.md`
