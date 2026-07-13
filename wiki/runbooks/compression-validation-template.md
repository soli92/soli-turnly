---
id: compression-validation-template
type: runbook
title: "Compression Layer Validation (Fase 1.5) — template fill-in-the-blanks"
status: draft
created: 2026-05-28
updated: 2026-06-25
sources:
  - "wiki/concepts/factory-compression-layer.md (design doc, §Fase 1.5)"
  - "PATTERN.md §20 (Output Compression Layer)"
  - ".claude/skills/caveman-protocol.md"
  - ".claude/commands/compression.md"
related:
  - factory-compression-layer
  - caveman
  - migration-v214
  - parallel-scheduler
tags: [runbook, validation, fase-1-5, compression, caveman, gate-empirico, template]
pattern_section: "§20"
---

# Compression Layer Validation (Fase 1.5) — Template

> ⚠️ **Status v2.15 (2026-05-29)** — Gate riformulato come **opt-in deferred**, non
> bloccante per il consolidamento del PATTERN. La Fase 2 (Context Compression Layer
> via Graphify) è stata implementata in v2.14 con bypass esplicito di questo gate
> (vedi [[factory-compression-layer]] §«v2.15 consolidation»). Questo runbook resta
> **riferimento operativo** per chiunque (derivatore della factory, utente con
> factory candidata reale) voglia eseguirne la validation empirica e proporne
> l'esito come input per v2.16+. In assenza di esecuzione il default rimane
> `compression.output.enabled: false`.

> Runbook **template** per la Fase 1.5 di validation empirica del Compression Layer
> (PATTERN §20 v2.14+). Da copiare in
> `wiki/runbooks/compression-validation-YYYY-MM-DD-<factory-name>.md` ed eseguire su una
> factory derivata reale aggiornata a v2.14 o successiva. Questo file resta come
> template di riferimento.

## Scopo del runbook

Eseguire (a discrezione) il **gate empirico** Fase 1.5 (vedi
[[factory-compression-layer]] §Roadmap + §«v2.15 consolidation»): misurare
risparmio, drift, qualità artefatti sulla factory derivata candidate. L'esito è
input per decisioni evolutive (es. proposta di default più aggressivi, taratura
delle policy) **non per** il consolidamento del PATTERN, che in v2.15 è già
chiuso indipendentemente da questo gate.

## Prerequisiti — Checklist

Verifica **ognuno** prima di procedere. Se anche uno solo è mancante → STOP, setup
incompleto.

### Factory derivata candidate

- [ ] Factory derivata con `PATTERN.md` ≥ v2.14 (verifica: `grep "pattern_version" factory.config.yaml`)
- [ ] `factory.config.yaml.compression.output` block presente (verifica: `yq '.compression.output' factory.config.yaml`)
- [ ] Topologia `full-stack-agents` o `hybrid-*-agents` (per generare wave parallele significative)
- [ ] `code_paths:` configurato con almeno una entry attiva
- [ ] Kanban con sprint reale: ≥ 4 TSK in `status: todo`, `consumer: agent`
- [ ] `scheduler.enabled: true` + `max_parallel ≥ 4`
- [ ] Routing matrix coerente: layer dei TSK candidate hanno `routing.<layer>: agent`
- [ ] `.claude/agents/` ha i dev-agent richiesti dai TSK (es. `be-dev.md` se ci sono TSK `layer: be`)

### Ambiente Caveman

- [ ] Caveman installato: `caveman --version` ritorna OK
- [ ] Versione testata: ___ (compila qui)
- [ ] Test minimal: `echo "Could you please help me read the file" | caveman --level=full` produce output ellittico
- [ ] Modello compatibile: ___ (compila qui — Claude Opus/Sonnet/Haiku, GPT-4, …)

### Telemetria

- [ ] Strumentazione per misurare `tokens_in / tokens_out` per wave disponibile. Opzioni:
  - **A**: `memory/episodic/*-wave-*.md` include token counts (default v2.14 wave_report)
  - **B**: Logging custom in `.claude/skills/parallel-scheduling.md` con counter
  - **C**: Telemetria del provider (Anthropic Console / OpenAI usage dashboard)
- [ ] Metodo scelto: ___ (A | B | C)

### Ambiente VCS

- [ ] Working tree pulito su factory candidate (verifica: `git status` → clean)
- [ ] Branch dedicato per validation (es. `validation/compression-1.5-YYYY-MM-DD`)
- [ ] Backup recente del kanban (per ripristinare stato `todo` dopo ogni round)

## Procedura — 7 step

### Step 1 — Selezione factory candidate

Compila qui i metadata:

| Campo | Valore |
|---|---|
| Factory name | ___ |
| Path | ___ |
| Pattern version | ___ |
| Topology | ___ |
| Sprint name | ___ |
| TSK candidate count | ___ |
| Layer distribution | be=___ fe=___ db=___ qa=___ |
| Wave depth attesa (level count) | ___ |
| Wave width attesa (max parallel TSK) | ___ |

### Step 2 — Baseline run (NO compression)

**Pre-condizioni**:
- `compression.output.enabled: false`
- Tutti i TSK candidate in `status: todo`
- `git stash` di eventuali modifiche locali non commit

**Esecuzione**:

```bash
cd <factory-path>
/compression set enabled false        # forza off, anche se è già il default
/compression show                      # verifica enabled=false
git log -1 --oneline                   # registra commit base
/run                                   # avvia wave dispatch parallelo
```

**Misurazioni da raccogliere** (per ogni wave dispatched):

| Wave | Level | Width | Duration (s) | tokens_in | tokens_out | TSK ok | TSK failed |
|---|---|---|---|---|---|---|---|
| 1 | 0 | ___ | ___ | ___ | ___ | ___ | ___ |
| 1 | 1 | ___ | ___ | ___ | ___ | ___ | ___ |
| 2 | 0 | ___ | ___ | ___ | ___ | ___ | ___ |

**Total baseline**: `tokens_in_total = ___`, `tokens_out_total = ___`, `wall_clock = ___`

**Snapshot artefatti baseline**:
```bash
git diff HEAD~<N>..HEAD --stat > /tmp/baseline-diff.txt   # diff di tutto lo sprint
cp -r management/kanban /tmp/baseline-kanban-snapshot/
cp -r <code_path>/ /tmp/baseline-code-snapshot/
```

### Step 3 — Reset stato

Ripristina lo stato pre-sprint per ripetere il run sotto compression:

```bash
git reset --hard <commit-base>
# Verifica TSK tornati a status: todo
grep -l "status: done" management/kanban/**/TSK-*.md | xargs grep "review_status"
```

ATTENZIONE: questa è un'operazione **destruttiva**. Eseguila SOLO su branch dedicato
(`validation/compression-1.5-*`). Mai sul branch main della factory candidate.

### Step 4 — Compressed run (con compression)

**Pre-condizioni**:
- `compression.output.enabled: true`
- `policy_profile: conservative` (default; per topologia `knowledge-only` parti con `aggressive`)
- Stesso commit base dello Step 2

**Esecuzione**:

```bash
/compression set enabled true
/compression policy conservative      # o aggressive per knowledge-only
/compression show                      # verifica config
/run                                   # avvia wave dispatch parallelo con intercept
```

**Misurazioni da raccogliere**:

| Wave | Level | Width | Duration (s) | tokens_in_compressed | tokens_out_compressed | TSK ok | TSK failed | Drift events |
|---|---|---|---|---|---|---|---|---|
| 1 | 0 | ___ | ___ | ___ | ___ | ___ | ___ | ___ |
| 1 | 1 | ___ | ___ | ___ | ___ | ___ | ___ | ___ |
| 2 | 0 | ___ | ___ | ___ | ___ | ___ | ___ | ___ |

**Total compressed**: `tokens_in_compressed_total = ___`, `tokens_out_compressed_total = ___`, `wall_clock = ___`

**Drift events totali**: ___ (deve essere 0 critici per superare il gate)

**Snapshot artefatti compressed**:
```bash
git diff HEAD~<N>..HEAD --stat > /tmp/compressed-diff.txt
cp -r management/kanban /tmp/compressed-kanban-snapshot/
cp -r <code_path>/ /tmp/compressed-code-snapshot/
```

### Step 5 — Confronto sulle 3 metriche

#### Metrica A — Risparmio effettivo (target ≥ 50%)

```
ratio_in  = tokens_in_compressed_total  / tokens_in_total
ratio_out = tokens_out_compressed_total / tokens_out_total
saving_in  = 1 - ratio_in
saving_out = 1 - ratio_out
saving_combined = 1 - (tokens_in_compressed + tokens_out_compressed) /
                      (tokens_in_total + tokens_out_total)
```

Compila:
- `saving_in  = ___ %`
- `saving_out = ___ %`
- `saving_combined = ___ %`

**Target**: `saving_combined ≥ 50%`.

#### Metrica B — Drift detection (target = 0 critici)

Conta dal `wiki/log.md` (marker `compression-drift`):
```bash
grep "compression-drift" wiki/log.md | wc -l
```

- Drift totale: ___
- Drift critici (chain di sub-agent fallita > 1 step): ___
- Drift recuperati via fallback normal mode: ___

**Target**: 0 drift critici. Drift recuperati via fallback sono accettabili.

#### Metrica C — Qualità artefatti (target: invariata)

**Diff baseline vs compressed**:
```bash
diff -r /tmp/baseline-kanban-snapshot/ /tmp/compressed-kanban-snapshot/ > /tmp/kanban-diff.txt
diff -r /tmp/baseline-code-snapshot/   /tmp/compressed-code-snapshot/   > /tmp/code-diff.txt
```

Manual review:
- [ ] TSK content identico/equivalente (modulo whitespace e ordine non semantico)
- [ ] Code prodotto identico/equivalente (test BE/FE/DB/QA passano allo stesso set)
- [ ] Wiki pages aggiornate (se ce ne sono) preservano citation `[^src: ...]` e wikilink `[[name]]`
- [ ] `wiki/log.md` entry semanticamente equivalenti (modulo `compression` markers extra)
- [ ] Nessuna regressione visibile

Verdict qualità: **identica** | **equivalente con differenze cosmetiche** | **degradata**

### Step 6 — Decision gate

Compila la matrice di decisione:

| Metrica | Valore | Target | OK? |
|---|---|---|---|
| Risparmio combinato | ___ % | ≥ 50% | ☐ |
| Drift critici | ___ | = 0 | ☐ |
| Qualità artefatti | ___ | invariata | ☐ |

**Decisione**:

- **Tutti OK** → ✅ Procedi a Fase 2 (Context Compression, Graphify code_path). Aggiorna
  design doc [[factory-compression-layer]] §Fase 1.5 con risultati + raccomandazione
  GO.
- **Risparmio < 30%** → Analizza con `/compression show` quale canale ha ratio bassa.
  Valuta passaggio a `policy_profile: aggressive` e ripeti Step 2-5. Se dopo
  aggressive ancora < 30%, raccomandazione = REWORK (rivedere `caveman-protocol` o
  abbandonare).
- **Drift critici > 0** → Identifica il canale problematico nel marker
  `compression-drift`. Valuta `policy_profile: custom` con quel canale a `off`. Se
  drift persiste anche in custom, raccomandazione = NO-GO (mantieni
  `enabled: false` di default).
- **Qualità degradata** → STOP immediato. Raccomandazione = NO-GO + post-mortem in
  `wiki/incidents/YYYY-MM-DD-compression-quality-regression.md`.

Compila qui:

```
DECISIONE FINALE: ___ (GO | REWORK | NO-GO)
RATIONALE:
___
PATH FORWARD:
___
```

### Step 7 — Reporting

1. **Compila questo runbook** (rinominato `compression-validation-YYYY-MM-DD-<factory-name>.md`) con tutti i valori misurati. Lascia in `status: review` per peer review.

2. **Aggiorna design doc** [[factory-compression-layer]] §Fase 1.5 con sezione
   `## Aggiornamenti (vYYYY-MM-DD)` non-distruttiva (PATTERN §7 r.7) contenente:
   - Riferimento al runbook
   - Risultati delle 3 metriche
   - Decisione finale
   - Raccomandazione su `policy_profile` per le altre factory derivate

3. **Aggiorna wiki/log.md** della factory candidate:
   ```
   [YYYY-MM-DD HH:MM] validation — compression Fase 1.5 conclusa, decisione: <GO|REWORK|NO-GO>, saving=<X%>, drift=<N>, qualità=<status> — files touched: 1
   ```

4. **Aggiorna wiki/log.md** del meta-framework (`soli-multi-agents-factory`) per
   tracciare l'avanzamento globale della roadmap.

5. Se decisione = **GO**: apri TSK di Fase 2 nel meta-framework (Graphify code_path).
   Se decisione = **REWORK**: apri issue/TSK per il rework richiesto.
   Se decisione = **NO-GO**: deprecare la Fase 2 nel design doc; OCL resta opt-in
   come "feature sperimentale, default off".

## Anti-pattern da evitare

- **Misurare 1 sola wave**: rumore alto, conclusioni non affidabili. Minimo 2 wave per round, idealmente uno sprint completo.
- **Variare il profilo durante un round**: rende non comparabili le metriche. Fissa il profilo all'inizio dello Step 4.
- **Skippare lo snapshot artefatti**: senza confronto baseline vs compressed non puoi giudicare la metrica C.
- **Reset destruttivo sul branch sbagliato**: lo Step 3 è dangerous. SEMPRE su branch dedicato.
- **Misurare solo `tokens_out`**: il guadagno reale è la **somma** in/out. Tenerli separati nel report ma valutare il combinato.
- **Validare sotto carico anomalo** (un solo TSK, o TSK tutti dello stesso layer): la wave non è rappresentativa. Sprint diversificato.

## Trade-off documentati

| Aspetto | Pro Compression | Pro Baseline |
|---|---|---|
| Costo API per sprint | -50–70% | costo pieno |
| Wall-clock per wave | leggermente più veloce (token∝latenza) | nessuna variazione |
| Debuggabilità messaging | output ellittico richiede unfold mentale | output verbose self-explanatory |
| Audit trail | richiede compression-drift marker per traccia | trace naturale |
| Setup overhead | install Caveman + config | nessuno |

## Riferimenti

- Design doc: [[factory-compression-layer]] §Fase 1.5
- Pattern: PATTERN.md §20.7 (integrazione scheduler), §20.4 (R.C1–R.C6)
- Skill: `.claude/skills/caveman-protocol.md`
- Comando: `.claude/commands/compression.md`
- Runbook migration: [[migration-v214]]
- Concept correlati: [[caveman]], [[token-compression]], [[parallel-scheduler]]

## Riferimento normativo §20 (aggiunto 2026-06-25 — semantic drift fix)

> Score pre-fix: 0.68. Questa sezione allinea il runbook alle invarianti canoniche di §20 PATTERN v2.21.

### R.C1–R.C7: mappatura sugli step del runbook

Le invarianti R.C1–R.C7 sono il contratto invariante del Compression Layer. Per ogni invariante è indicato quale step del runbook la rispetta o la deve verificare attivamente.

**R.C1 — Canali `to_user`, `to_artifact`, `propagate_resolution` sempre OFF**
Rilevanza: **Step 4 (Compressed run) + Step 5 Metrica C (Qualità artefatti)**.
La checklist di Metrica C verifica già che gli artefatti prodotti (TSK content, wiki pages, code) siano identici/equivalenti tra baseline e compressed run. Questo è esattamente R.C1 in azione: la compressione non deve mai toccare gli artefatti persistenti. Se Metrica C mostra artefatti degradati → violazione sospetta di R.C1. Verificare che `caveman-protocol` non sia stato invocato su write verso `wiki/**` o `management/kanban/**`.
Nota: il blocco config `invariants: {to_user: off, to_artifact: off, propagate_resolution: off}` è presente per esplicitazione documentale, non come toggle — questi canali non sono attivabili via `custom` (§20.4).

**R.C2 — Allow-list channel-aware (payload senza canale → fallback normal mode + warning)**
Rilevanza: **Step 4 (Compressed run)** e **Step 5 Metrica B (Drift detection)**.
Durante il compressed run, payload emessi senza canale identificabile producono un warning in `wiki/log.md` (marker `[compression-R.C2-fallback]`). Questi non sono "drift critici" ma sono segnali di configurazione incompleta. Se compaiono, ispezionare il frontmatter dell'agent emittente e verificare se manca il campo `caveman_policy:`. L'assenza del campo non è errore (campo opzionale, §20.6): l'agent riceve il default conservative per il canale principale.

**R.C3 — Chain-depth severity ceiling (solo `conservative`)**
Rilevanza: **Step 4 pre-condizioni** + **Step 6 Decision gate**.
Nel profilo `conservative`, quando la chain supera profondità 3, il livello di compressione è auto-degradato (`ultra → full → lite`). Questo spiega perché il risparmio misurato in Metrica A può essere inferiore al teorico 70–85%: su chain lunghe (`full-stack-agents` con orch → PM → TPM → dev), il ceiling abbassa automaticamente l'intensità. Non è un malfunzionamento: è la mitigation del drift cumulativo. Se vuoi il massimo risparmio su chain lunghe, usa `aggressive` solo dopo aver validato ≥ 2 settimane di baseline con `conservative` (gate di maturità).

**R.C4 — Cross-factory boundary OFF**
Rilevanza: **Step 1 (Selezione factory candidate)**.
Il runbook si applica a una singola factory derivata. Se la factory candidate è parte di una topologia federata (multi-factory), la compressione è già `off` sugli handoff cross-factory per definizione. Non configurabile. Non misurabile in questa validation (gli handoff cross-factory non appaiono nelle metriche intra-factory). Annotare nella compilazione di Step 1 se la factory è federata.

**R.C5 — Drift fallback automatico (marker `AMBIGUOUS_HANDOFF` / `REQUEST_CLARIFY`)**
Rilevanza: **Step 5 Metrica B (Drift detection)** — il marker `compression-drift` in `wiki/log.md` è prodotto da R.C5.
Quando un sub-agent risponde con `AMBIGUOUS_HANDOFF` o `REQUEST_CLARIFY`, l'orchestrator rinvia in `normal mode` e appende il marker. Il conteggio di Step 5 Metrica B misura esattamente questo: drift eventi totali (inclusi quelli recuperati via fallback) e drift critici (chain di sub-agent fallita > 1 step). R.C5 garantisce che i drift *recuperati* non terminino il workflow, ma un drift critico indica che il fallback non è bastato. Target: 0 drift critici. Drift recuperati accettabili (il meccanismo ha funzionato).
I due marker da cercare in `wiki/log.md`:
```bash
grep "compression-drift" wiki/log.md      # marker R.C5 fallback automatico
grep "AMBIGUOUS_HANDOFF" wiki/log.md      # marker ambiguità raw (pre-fallback)
grep "REQUEST_CLARIFY" wiki/log.md        # marker richiesta disambiguazione
```

**R.C6 — Opt-in totale, backward compatibility**
Rilevanza: **Prerequisiti (Factory candidate)** + **Step 2 (Baseline run)**.
Il baseline run con `compression.output.enabled: false` (Step 2) è letteralmente R.C6 in esecuzione: la factory si comporta come v2.13, nessun intercept Caveman, nessun overhead. Il confronto baseline/compressed del runbook misura il delta introdotto dall'attivazione. R.C6 garantisce che il delta baseline sia sempre disponibile come punto di riferimento.

**R.C7 — Decision-preserving + ban `aggressive` su chain profonde** (v2.19, EP-015)
Rilevanza: **Step 4 (profilo `aggressive`)** + **Step 5 Metrica C (check `decision_anchor`)**.
Due sotto-regole:
1. Il blocco `decision_anchor` (marcato `## DECISION ANCHOR (DO NOT COMPRESS)`) nei TSK/ADR deve essere passato byte-equal da Caveman. Se Metrica C mostra che il contenuto di un blocco `decision_anchor` è stato modificato nella versione compressed → violazione R.C7 grave. STOP immediato, NO-GO.
2. Se si testa `policy_profile: aggressive` su una topologia `full-stack-agents` con chain depth reale > 3 e capability attive > 5, R.C7 produce un downgrade runtime automatico a `conservative` + marker `[R.C7-migration:soft]` in `wiki/log.md`. Verificare il log durante Step 4 per rilevare se R.C7 ha "overridden" il profilo richiesto. Se compare il marker, le misurazioni di Step 5 riflettono il profilo `conservative`, non `aggressive` come impostato.

### Blocco config `compression.output` — reference per chi usa il template

```yaml
compression:
  output:
    provider: caveman           # caveman | none
    enabled: false              # default OFF; Step 2 = false, Step 4 = true
    policy_profile: conservative   # Step 4: conservative | aggressive | custom
    invariants:                 # R.C1 — mai overridabili
      to_user: off
      to_artifact: off
      propagate_resolution: off
    channels:                   # compilare SOLO se policy_profile == custom
      orchestrator_to_subagent: full
      subagent_to_tool: ultra
      tool_to_subagent: lite
      subagent_to_orchestrator: full
      sibling_to_sibling: full
      feedback_router_to_devagent: full
    chain_depth_downgrade: true       # R.C3 — off se aggressive
    chain_depth_threshold: 3
    cross_factory: off                # R.C4 — non modificare
    drift_fallback:
      enabled: true                   # R.C5 — non disabilitare durante validation
      markers: [AMBIGUOUS_HANDOFF, REQUEST_CLARIFY]
```

Durante la validation **non disabilitare** `drift_fallback.enabled`: il meccanismo R.C5 deve essere attivo per misurare i drift in modo realistico. Disabilitarlo oscurerebbe i drift critici e renderebbe le misurazioni di Metrica B non rappresentative.

### Cross-reference: channel matrix e drift_fallback marker

La **channel matrix** (§20.2) determina il livello di compressione per ogni canale nei profili `conservative` e `aggressive`. In Metrica A del runbook, il risparmio per canale è correlato a questa matrice:
- Risparmio basso su `tool_to_subagent` in `conservative` → atteso (solo `lite`)
- Risparmio alto su `subagent_to_tool` → atteso (`ultra` in entrambi i profili)
- Risparmio zero su `to_user` e `to_artifact` → atteso e corretto (R.C1)

I **drift_fallback marker** (`AMBIGUOUS_HANDOFF`, `REQUEST_CLARIFY`) prodotti da R.C5 compaiono in `wiki/log.md` con il formato:
```
compression-drift TSK-ZZZ canale=<C> profilo=<P>
```
dove `<C>` è il canale e `<P>` il profilo attivo al momento del drift. Questo formato consente di identificare il canale problematico e agire con un override `custom` che abbassa il livello su quel canale specifico (Step 6 Decision gate, caso "Drift critici > 0").
