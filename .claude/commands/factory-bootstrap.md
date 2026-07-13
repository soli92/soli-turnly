---
description: Scaffolda una nuova Agentic Factory llm-wiki++. Dispatcher thin → v2.32 (corrente, Capability Formativa EP-045 + Voice Hardening EP-046: agente tutor MVP con Student Model + retrieval practice + curriculum YAML; 7 contratti FSM voice hardening C1..C7; backward compat totale v2.31) | v2.31 (previous, Voice Handsfree EP-044: VAD debounce configurabile, wake word filter threshold, file pipe adapter con polling, PID path configurabile; include anche EP-041 Voice Channel, EP-042 Hybrid Wiki Search, EP-043 Temporal Estimate Protocol) | v2-31-full (variante consolidata self-contained v2.31: intera catena v2.15→v2.31 in un unico file, NO extends) | v2.27 (previous, Tavola Rotonda Mode EP-039: modalità multi-agente collaborativa opt-in, 5 fasi Setup→Posizioni→Confronto→Convergenza→Sintesi, blackboard single-writer, Critico obbligatorio, budget guardrail, registro decisioni wiki/decisions/) | v2-27-full (variante consolidata self-contained v2.27: intera catena v2.15→v2.27 in un unico file, NO extends) | v2.26 (previous, Prototype Generation Layer EP-035: cascata adattiva figma→penpot→react→html, fallback html garantito INV-1, backend-resolver + /prototype + /prototype-status, opt-in) | v2-26-full (variante consolidata self-contained v2.26: intera catena v2.15→v2.26 in un unico file, NO extends) | v2.25 (previous, VCS Branch Awareness Layer EP-034: branch-resolver + /vcs-status + gate dev-protocol Fase 0 + drift check vcs-handoff, opt-in per multi-repo/submodule) | v2.24 (Runtime Contextual Suggestions EP-033: Fase 6 orchestrator + dev-handoff post-exec + suggest-next.py hook) | v2.23 (Semantic Drift Detection EP-031 research sprint) | v2-23-full (variante consolidata self-contained v2.23: intera catena v2.15→v2.23 in un unico file, NO extends) | v2.21 (Design Intelligence Layer EP-019 + Token Ledger EP-022 opt-in) | v2-21-full (variante consolidata self-contained v2.21) | v2.20 (FE Functional Oracle EP-018 opt-in) | v2.19 (Hardening & Sustainability EP-012..017) | v2.18 (A11y + UX/UI Integration opt-in) | v2-18-full (variante consolidata self-contained v2.18) | v2.17 (FE Visual Oracle Integration opt-in) | v2.16 (Premortem Integration opt-in) | v2.15 (consolidation release del Compression Layer) | v2.14 (compression layer first introduction) | v2.13 (multi-adapter) | v2.12 (legacy, single-adapter) | v2.11 (snapshot storico).
argument-hint: [nome-progetto] [path-destinazione] [--version=v2-32|v2-31|v2-31-full|v2-27|v2-27-full|v2-26|v2-26-full|v2-25|v2-25-full|v2-24|v2-23|v2-23-full|v2-21|v2-21-full|v2-20|v2-19|v2-18|v2-18-full|v2-17|v2-16|v2-15|v2-14|v2-13|v2-12|v2-11]
allowed-tools: Read, Write, Edit, Bash, Glob, TodoWrite, WebSearch, WebFetch
---

# Factory Bootstrap — dispatcher

> **Sede e installazione.** Questo file è la **source-of-truth versionata** del dispatcher,
> co-locato con tutti gli altri comandi dell'adapter Claude Code in `.claude/commands/`.
> Per usarlo come slash command Claude Code va **installato user-level** copiandolo in
> `~/.claude/commands/factory-bootstrap.md`:
> ```bash
> cp <your-clone>/.claude/commands/factory-bootstrap.md ~/.claude/commands/factory-bootstrap.md
> ```
> A differenza degli altri comandi dell'adapter, il dispatcher **non** viene scaffoldato
> nelle factory derivate (non è nella lista curata di Fase 4.c del seed): è un meta-comando
> che *crea* factory, non uno che vive *dentro* una factory.

Argomenti utente: `$ARGUMENTS`

## Risoluzione versione

Parse `$ARGUMENTS` cercando `--version=<X>`:

- **`--version=v2-32` (DEFAULT)** → carica il seed v2.32 (Capability Formativa EP-045 +
  Voice Hardening EP-046; **delta seed** che estende v2-31; DUE capability distinte:
  EP-046 porta il modulo `voice/` a uso non supervisionato via 7 contratti architetturali FSM
  (C1 lifecycle owner single-writer, C2 no-cattura-durante-parlato `playing_watchdog_s`,
  C3 liveness check file-pipe, C4 timer cattura config-driven `speech_onset_deadline_s`+
  `max_capture_duration_s`, C5+C6 gate STT `no_speech_prob`+`compression_ratio`, C7 seam
  `VoiceSessionManager` stub; ADR-EP046-001 GO, Tavola Rotonda 3f8a1c2d); EP-045 introduce
  sistema tutoring adattivo MVP (agente `tutor.md` enabled:false default + 4 skill EP-045 +
  `tools/tutor/` 11 moduli Python: Student Model SM-2/provenance, retrieval practice loop,
  curriculum YAML loader + 6 nodi pilota; `capability_formativa.enabled: false` default);
  include l'intera catena v2.31 (EP-044 Voice Handsfree) → v2.30 (EP-043 Temporal) → v2.29
  (EP-042 Wiki Search) → v2.28 (EP-041 Voice Channel); backward compat totale v2.31; gate
  v2.32.0 PASS 2026-07-10) →
  leggi `meta-prompts/v2-32/factory-bootstrap.md`
  ⚠️ Essendo un **delta seed** con `extends: v2-31`, l'agente DEVE risolvere la catena
  `v2-32 → v2-31 → v2-30 → v2-29 → v2-28 → v2-27 → v2-26 → v2-25 → v2-24 → v2-23 → v2-21 → v2-20 → v2-19 → v2-18 → v2-17 → v2-16 → v2-15 → (Fase 2/5 da v2-12)` fetchando ogni seed padre.
- **`--version=v2-31`** → carica il seed v2.31 (Voice Handsfree Improvements EP-044;
  **delta seed** che estende v2-30; hardening e configurabilità del Voice Channel Layer (EP-041,
  PATTERN §30): VAD debounce ms configurabile (US-155) + wake word filter threshold configurabile
  (US-156) + file pipe adapter con fallback polling (US-158: `pipe_poll_ms` + `pipe_timeout`,
  comunicazione CLI senza FIFO bloccante) + PID file path configurabile (US-159) + blocklist
  anti-allucinazione STT (gate RMS pre-Whisper + `no_speech_prob` + pattern ripetitivi);
  include anche EP-041 Voice Channel (STT/TTS/VAD/AEC, state machine 5 stati), EP-042 Hybrid
  Wiki Search (vector+FTS+RRF, LanceDB, skill `wiki-search-protocol`, `/wiki-search`), EP-043
  Temporal Estimate Protocol (skill `temporal-estimate-protocol`, `/sprint-progress`);
  config `voice_channel:` + `wiki_search:` + `temporal:` + `analytics.sprint_progress:`
  (tutti default off, backward compat totale v2.30); gate v2.31.0 PASS 2026-07-09) →
  leggi `meta-prompts/v2-31/factory-bootstrap.md`
  ⚠️ Essendo un **delta seed** con `extends: v2-30`, l'agente DEVE risolvere la catena
  `v2-31 → v2-30 → v2-29 → v2-28 → v2-27 → v2-26 → v2-25 → v2-24 → v2-23 → v2-21 → v2-20 → v2-19 → v2-18 → v2-17 → v2-16 → v2-15 → (Fase 2/5 da v2-12)` fetchando ogni seed padre.
- **`--version=v2-31-full`** → carica il seed **self-contained** v2.31 (`meta-prompts/v2-31/factory-bootstrap-full.md`):
  intera catena v2.15→v2.31 inlinata, **nessun `extends:` da risolvere**. Funzionalmente
  identico al delta v2-31 ma leggibile da un solo file. **Consigliato per uso offline / URL
  singola / collega / LLM non-Claude** che non risolve la catena `extends:`.
- **`--version=v2-27`** → carica il seed v2.27 (Tavola Rotonda Mode EP-039;
  **delta seed** che estende v2-26; modalità multi-agente collaborativa opt-in per deliberazioni
  complesse: agente `tavola-rotonda-moderatore` (macchina a stati 5 fasi
  Setup→Posizioni→Confronto→Convergenza→Sintesi) + skill `tavola-rotonda-protocol` (8 invarianti
  R.TR1-R.TR8: blackboard single-writer, Critico obbligatorio, budget guardrail, registro decisioni)
  + comando `/tavola-rotonda` (gate R.P3-TR, flag parsing, dispatch moderatore);
  ADR-EP039-001 (blackboard markdown strutturato O(punti-aperti) vs O(n×m) token); PATTERN §28;
  runbook `wiki/runbooks/tavola-rotonda.md` (decision tree: quando usare vs self-consistency);
  config `tavola_rotonda.enabled: false` default (R.P3/R.TR); backward compat totale v2.26;
  gate v2.27.0 PASS) →
  leggi `meta-prompts/v2-27/factory-bootstrap.md`
  ⚠️ Essendo un **delta seed** con `extends: v2-26`, l'agente DEVE risolvere la catena
  `v2-27 → v2-26 → v2-25 → v2-24 → v2-23 → v2-21 → v2-20 → v2-19 → v2-18 → v2-17 → v2-16 → v2-15 → (Fase 2/5 da v2-12)` fetchando ogni seed padre.
- **`--version=v2-27-full`** → carica il seed **self-contained** v2.27 (`meta-prompts/v2-27/factory-bootstrap-full.md`):
  intera catena v2.15→v2.27 inlinata, **nessun `extends:` da risolvere**. Funzionalmente
  identico al delta v2-27 ma leggibile da un solo file. **Consigliato per uso offline / URL
  singola / collega / LLM non-Claude** che non risolve la catena `extends:`.
- **`--version=v2-26`** → carica il seed v2.26 (Prototype Generation Layer EP-035;
  **delta seed** che estende v2-25; layer opt-in con cascata adattiva figma→penpot→react→html e
  fallback terminale html garantito (INV-1): skill `backend-resolver` + `prototype-generation-protocol`
  + `html-prototype-mapping` + `react-mapping` (T1) + agente `prototype-generator` + comandi
  `/prototype` + `/prototype-status`; config `prototyping:` default off (R.P3); INV-1..INV-6 locali
  §27; ADR-EP035-001..006 GO; backward compat totale v2.25; gate v2.26.0 PASS 2026-07-02) →
  leggi `meta-prompts/v2-26/factory-bootstrap.md`
  ⚠️ Essendo un **delta seed** con `extends: v2-25`, l'agente DEVE risolvere la catena
  `v2-26 → v2-25 → v2-24 → v2-23 → v2-21 → v2-20 → v2-19 → v2-18 → v2-17 → v2-16 → v2-15 → (Fase 2/5 da v2-12)` fetchando ogni seed padre.
- **`--version=v2-26-full`** → carica il seed **self-contained** v2.26 (`meta-prompts/v2-26/factory-bootstrap-full.md`):
  intera catena v2.15→v2.26 inlinata, **nessun `extends:` da risolvere**. Funzionalmente
  identico al delta v2-26 ma leggibile da un solo file. **Consigliato per uso offline / URL
  singola / collega / LLM non-Claude** che non risolve la catena `extends:`.
- **`--version=v2-25`** → carica il seed v2.25 (VCS Branch Awareness Layer EP-034;
  **delta seed** che estende v2-24; layer opt-in declare→inspect→align per rendere preciso e
  visibile «su quale branch sto / su quale devo stare» nei progetti multi-repo/submodule: skill
  `branch-resolver` (expected branch, single source of truth R.B9) + `vcs-preflight-protocol`
  (snapshot read-only R.B7) + comando `/vcs-status` + tabella dashboard `/run` + gate pre-dispatch
  `dev-protocol` Fase 0 Step 2-ter (`dispatch_gate: off|warn|block`, `auto_align: propose`, mai
  checkout silente R.B8) + drift check opt-in in `vcs-handoff`; config `vcs.branch_awareness`
  default off; invarianti locali §15 R.B7-R.B10; nessuna nuova invariante §7 (resta 18);
  ADR-EP034-001 GO; backward compat totale v2.24; gate v2.25.0 PASS 2026-07-02) →
  leggi `meta-prompts/v2-25/factory-bootstrap.md`
  ⚠️ Essendo un **delta seed** con `extends: v2-24`, l'agente DEVE risolvere la catena
  `v2-25 → v2-24 → v2-23 → v2-21 → v2-20 → v2-19 → v2-18 → v2-17 → v2-16 → v2-15 → (Fase 2/5 da v2-12)` fetchando ogni seed padre.
- **`--version=v2-25-full`** → carica il seed **self-contained** v2.25 (`meta-prompts/v2-25/factory-bootstrap-full.md`):
  intera catena v2.15→v2.25 inlinata, **nessun `extends:` da risolvere**. Funzionalmente
  identico al delta v2-25 ma leggibile da un solo file. **Consigliato per uso offline / URL
  singola / collega / LLM non-Claude** che non risolve la catena `extends:`.
- **`--version=v2-24`** → carica il seed v2.24 (Runtime Contextual Suggestions EP-033;
  **delta seed** che estende v2-23; tre proposte push-based: A = Fase 6 orchestrator.md 6 regole
  condizionali al termine di `/run`, B = sezione Suggerimento post-esecuzione in dev-handoff.md
  per-layer (fe/be/db/qa/docs), C = suggest-next.py + hook Stop opt-in (~220 righe Python stdlib,
  exit 0 always, 5 regole statiche deterministiche, `--dry-run` debug); gate installazione per
  ogni suggerimento (`.claude/commands/<cmd>.md` presente); deduplication via `wiki/log.md`;
  tono non imperativo; nessuna nuova invariante §7 (restano 18); backward compat totale v2.23;
  gate v2.24.0 PENDING) →
  leggi `meta-prompts/v2-24/factory-bootstrap.md`
  ⚠️ Essendo un **delta seed** con `extends: v2-23`, l'agente DEVE risolvere la catena
  `v2-24 → v2-23 → v2-21 → v2-20 → v2-19 → v2-18 → v2-17 → v2-16 → v2-15 → (Fase 2/5 da v2-12)` fetchando ogni seed padre.
- **`--version=v2-23`** → carica il seed v2.23 (Semantic Drift Detection — research sprint EP-031;
  **delta seed** che estende v2-21; UNA capability opt-in di research derivabile — EP-031 Semantic Drift
  Detection (piramide ADR-EP031-001 GO-MODIFIED: L1 staleness Check 4ag always-on + L2 LLM-judge corpus
  ≤50 pagine + L3 embedding coseno opt-in; config `wiki_lint.semantic_check:` 6 chiavi, default
  `enabled: false`; skill `semantic-drift-scan-protocol`; comando `/semantic-drift-scan`; convenzione
  frontmatter `pattern_section:`); Check 4ag (staleness) always-on indipendentemente dal flag; nessuna
  nuova invariante §7 (restano 18); gate v2.23.0 PASS 3/3 RUN-REPORT 2026-06-25).
  ⚠️ Essendo un **delta seed** con `extends: v2-21`, l'agente DEVE risolvere la catena
  `v2-23 → v2-21 → v2-20 → v2-19 → v2-18 → v2-17 → v2-16 → v2-15 → (Fase 2/5 da v2-12)` fetchando ogni seed padre.
  **Alternativa consigliata per uso offline/collega**: usa `--version=v2-23-full` (nessun extends, unico file).
- **`--version=v2-23-full`** → carica `meta-prompts/v2-23/factory-bootstrap-full.md`, la
  **variante consolidata self-contained v2.23**: identica funzionalmente a v2.23 ma con l'intera
  catena `extends` (v2-23 + v2-21 + v2-20 + v2-19 + v2-18 + v2-17 + v2-16 + v2-15) **inlinata in un
  unico file** (nessun `extends:` da risolvere, nessun seed padre da fetchare). Consigliata
  quando l'agente non risolve in automatico la catena `extends:` (es. accesso a URL singola, fetch
  senza repo completo, clone parziale, LLM non-Claude). Resta necessario il fetch dei template di
  contenuto (PATTERN.md, file `.claude/*`, manifest adapter) in Fase 3.
- **`--version=v2-21`** → carica il seed v2.21 (Design Intelligence Layer EP-019 + Token Ledger EP-022;
  **delta seed** che estende v2-20; DUE capability opt-in derivabili — EP-019 Design Intelligence Layer
  (art-director DSL + LLM-Generator Separation + Critic/Judge + Intention Economy; skills
  `art-director-protocol`, `design-spec-dsl`, `critic-judge-protocol`, `design-intelligence-protocol`,
  `llm-generator-separation-protocol`; PATTERN §24; ADR-068..071) e EP-022 Token Ledger (visibilità
  token reali inline, script `show-session-tokens.py` + hook Stop); default
  `design_intelligence.enabled: false` / `analytics.token_ledger.enabled: false` → factory identica
  a v2.20; nessuna nuova invariante §7 (restano 18)).
  ⚠️ Essendo un **delta seed** con `extends: v2-20`, l'agente DEVE risolvere la catena
  `v2-21 → v2-20 → v2-19 → v2-18 → v2-17 → v2-16 → v2-15 → (Fase 2/5 da v2-12)` fetchando ogni seed padre.
  **Alternativa consigliata per uso offline/collega**: usa `--version=v2-21-full` (nessun extends, unico file).
- **`--version=v2-21-full`** → carica `meta-prompts/v2-21/factory-bootstrap-full.md`, la
  **variante consolidata self-contained v2.21**: identica funzionalmente a v2.21 ma con l'intera
  catena `extends` (v2-21 + v2-20 + v2-19 + v2-18 + v2-17 + v2-16 + v2-15) **inlinata in un
  unico file** (1423 righe, nessun `extends:` da risolvere, nessun seed padre da fetchare). Consigliata
  quando l'agente non risolve in automatico la catena `extends:` (es. accesso a URL singola, fetch
  senza repo completo, clone parziale, LLM non-Claude). Resta necessario il fetch dei template di
  contenuto (PATTERN.md, file `.claude/*`, manifest adapter) in Fase 3.
- **`--version=v2-20`** → carica il seed v2.20 (FE Functional Oracle EP-018;
  **delta seed** che estende v2-19; unica capability di prodotto derivabile = EP-018 FE
  Functional Oracle opt-in — skill `functional-oracle-protocol` + `interaction-drive-protocol`
  + comando `/functional-oracle` + schema `acceptance-spec` + dominio scheduler
  `functional-oracle`; default `fe_correctness.functional_oracle.enabled: false` → factory
  identica a v2.19; nessuna nuova invariante §7).
  ⚠️ Essendo un **delta seed** con `extends: v2-19`, l'agente DEVE risolvere la catena
  `v2-20 → v2-19 → v2-18 → v2-17 → v2-16 → v2-15 → (Fase 2/5 da v2-12)` fetchando ogni seed padre.
- **`--version=v2-19`** → carica il seed v2.19 (Hardening & Sustainability;
  **delta seed** che estende v2-18; unico delta derivabile = EP-013 Analytics Dogfooding
  opt-in + fix ux_ui anti-fabbricazione ADR-063; §22/§23 governance META non scaffoldata in
  factory derivate; nessuna nuova invariante §7).
  ⚠️ Essendo un **delta seed** con `extends: v2-18`, l'agente DEVE risolvere la catena
  `v2-19 → v2-18 → v2-17 → v2-16 → v2-15 → (Fase 2/5 da v2-12)` fetchando ogni seed padre.
- **`--version=v2-18`** → carica il seed v2.18 (A11y + UX/UI Integration
  opt-in; **delta seed** che estende v2-17 con la Fase 1.sexies opt-in — capability `a11y`
  (accessibility testing WCAG 2.2 AA via tool `run_a11y_scan` + skill
  `accessibility-testing-protocol` + agente `a11y-specialist`) e `ux_ui` (UX/UI Review &
  Design via skill `ux-ui-review-protocol` + `ux-ui-design-protocol` + agenti
  `ux-ui-reviewer` + `ui-designer`); tutte le integrazioni no-op a flag spento).
  ⚠️ Essendo un **delta seed** con `extends: v2-17`, l'agente DEVE risolvere la catena
  `v2-18 → v2-17 → v2-16 → v2-15 → (Fase 2/5 da v2-12)` fetchando ogni seed padre, oppure
  usare la variante consolidata `--version=v2-18-full`.
- **`--version=v2-18-full`** → carica `meta-prompts/v2-18/factory-bootstrap-full.md`, la
  **variante consolidata self-contained**: identica funzionalmente a v2.18 ma con l'intera
  catena `extends` (v2-18 + v2-17 + v2-16 + v2-15 + Fase 2/5 di v2-12) **inlinata in un
  unico file** (nessun `extends:` da risolvere, nessun seed padre da fetchare). Consigliata
  quando l'agente non risolve in automatico la catena `extends:` (es. fetch del solo file
  v2-18 → procedura incompleta). Resta necessario il fetch dei template di contenuto
  (PATTERN.md, file `.claude/*`, manifest adapter) in Fase 3.
- `--version=v2-17` → v2.17 (FE Visual Oracle Integration opt-in; estende v2-16 con la
  Fase 1.quinquies opt-in per attivare il FE Visual Oracle — skill `visual-oracle-protocol`
  + `oracle-precheck` + comando `/visual-oracle` + blocco config `fe_correctness`).
- `--version=v2-16` → v2.16 (Premortem Integration opt-in; estende v2-15 con la Fase
  1.quater opt-in per scaffoldare la skill `premortem-protocol`).
- `--version=v2-15` → v2.15 (consolidation release del Compression Layer; gate Fase 1.5
  + 3a riformulati come opt-in deferred).
- `--version=v2-14` → v2.14 (introduzione Compression Layer a due assi opt-in, gate
  empirici come «pending run»).
- `--version=v2-13` → v2.13 (multi-adapter scaffolding, meta-prompt versionato nel repo).
- `--version=v2-12` → v2.12 (self-contained portable, single-adapter, CQRL + multi-repo).
- `--version=v2-11` → v2.11 (snapshot legacy, monolitico, parallel scheduler).

**Versione inesistente** (`--version=<X>` con `<X>` non in `{v2-32, v2-31, v2-31-full, v2-27, v2-27-full, v2-26, v2-26-full, v2-25, v2-25-full, v2-24, v2-23, v2-23-full, v2-21, v2-21-full, v2-20, v2-19, v2-18, v2-18-full, v2-17, v2-16, v2-15, v2-14, v2-13, v2-12, v2-11}`):
STOP con errore esplicito — **niente silent fallback**:

```
ERROR: versione '<X>' non supportata. Versioni disponibili: v2-32 (default), v2-31, v2-31-full (consolidata self-contained v2.31), v2-27, v2-27-full (consolidata self-contained v2.27), v2-26, v2-26-full (consolidata self-contained v2.26), v2-25, v2-25-full (consolidata self-contained v2.25), v2-24, v2-23, v2-23-full (consolidata self-contained v2.23), v2-21, v2-21-full (consolidata self-contained v2.21), v2-20, v2-19, v2-18, v2-18-full (consolidata self-contained v2.18), v2-17, v2-16, v2-15, v2-14, v2-13, v2-12, v2-11.
```

Il resto degli argomenti (`[nome-progetto] [path-destinazione]`) viene passato verbatim alla versione scelta.

## Risoluzione source del seed

Il seed v2.13+ vive **nel repo meta-framework** (`<repo>/meta-prompts/v2-XX/`).

**Method A — Local clone (preferito)**: se hai clonato il meta-framework localmente,
il seed è in:
```
<your-clone>/meta-prompts/v2-32/factory-bootstrap.md        # DEFAULT corrente (delta seed)
<your-clone>/meta-prompts/v2-31/factory-bootstrap.md        # previous (delta seed)
<your-clone>/meta-prompts/v2-31/factory-bootstrap-full.md   # previous consolidata self-contained ← consigliata per uso offline v2.31
<your-clone>/meta-prompts/v2-27/factory-bootstrap.md        # legacy (delta seed)
<your-clone>/meta-prompts/v2-27/factory-bootstrap-full.md   # previous consolidata self-contained ← consigliata per uso offline v2.27
<your-clone>/meta-prompts/v2-26/factory-bootstrap.md        # legacy (delta seed)
<your-clone>/meta-prompts/v2-26/factory-bootstrap-full.md   # legacy consolidata self-contained ← consigliata per uso offline v2.26
<your-clone>/meta-prompts/v2-25/factory-bootstrap.md        # legacy (delta seed)
<your-clone>/meta-prompts/v2-25/factory-bootstrap-full.md   # legacy consolidata self-contained
<your-clone>/meta-prompts/v2-24/factory-bootstrap.md        # legacy (delta seed)
<your-clone>/meta-prompts/v2-23/factory-bootstrap.md        # legacy (delta seed)
<your-clone>/meta-prompts/v2-23/factory-bootstrap-full.md   # legacy consolidata self-contained
<your-clone>/meta-prompts/v2-21/factory-bootstrap.md        # legacy (delta seed)
<your-clone>/meta-prompts/v2-21/factory-bootstrap-full.md   # legacy consolidata self-contained
<your-clone>/meta-prompts/v2-20/factory-bootstrap.md        # legacy
<your-clone>/meta-prompts/v2-19/factory-bootstrap.md        # legacy
<your-clone>/meta-prompts/v2-18/factory-bootstrap.md        # legacy
<your-clone>/meta-prompts/v2-18/factory-bootstrap-full.md   # variante consolidata self-contained v2.18 (legacy)
```

**Method B — GitHub raw URL** (sempre fresco):
```
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-32/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-31/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-31/factory-bootstrap-full.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-27/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-27/factory-bootstrap-full.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-26/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-26/factory-bootstrap-full.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-25/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-25/factory-bootstrap-full.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-24/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-23/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-23/factory-bootstrap-full.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-21/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-21/factory-bootstrap-full.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-20/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-19/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-18/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-18/factory-bootstrap-full.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-17/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-16/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/v2-15/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/archive/v2-14/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/archive/v2-13/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/archive/v2-12/factory-bootstrap.md
https://raw.githubusercontent.com/soli92/soli-multi-agents-factory/main/meta-prompts/archive/v2-11/factory-bootstrap.md
```

**Method C — Local cache legacy** (solo pre-v2.13, deprecato): `~/.claude/factory-bootstrap/v2-XX/`
conteneva i seed user-level **fino a v2-12**. Da v2.13 in poi i seed vivono **solo nel repo**
(`meta-prompts/`, Method A/B): questa cache NON contiene v2-13+ e va usata esclusivamente come
fallback offline per le versioni storiche v2-11/v2-12. Per le versioni correnti usa Method A o B.

## Versione corrente: v2.32 (Capability Formativa EP-045 + Voice Hardening EP-046)

**Cambiamenti chiave v2.32** (gate v2.32.0 PASS — 2026-07-10):
- **Voice Hardening** (EP-046, PATTERN §30 nota). Porta il modulo `voice/` a uso non
  supervisionato via 7 contratti architetturali FSM (ADR-EP046-001 GO, Tavola Rotonda 3f8a1c2d,
  consenso unanime Round 2): C1 `lifecycle.py` single-writer `voice-state.json` + PID
  validation; C2 flag `_tts_playing` + watchdog `playing_watchdog_s` (default 10s, no stuck in
  PARLATO); C3 liveness check heartbeat TTL + `schema_version` in `FilePipeAdapter`; C4 timer
  cattura config-driven `speech_onset_deadline_s` (default 5s) + `max_capture_duration_s`
  (default 30s); C5+C6 gate STT per-segmento `no_speech_prob_threshold` (0.6) +
  `compression_ratio_threshold` (2.4, calibrato su cr reale 0.50-0.53); C7 `VoiceSessionManager`
  stub + gap document. 24 TSK, 9 test nuovi. Backward compat totale v2.31.
- **Capability Formativa** (EP-045). Sistema di tutoring adattivo MVP (Opzione B: curriculum
  curato a mano). Agente `tutor.md` (enabled: false default) + 4 skill (`epistemic-tag-protocol`
  L1/L2/L3 INV-T1..T3, `scaffolding-protocol` 3 livelli mastery, `session-mode-protocol`
  Sblocco/Apprendimento 7-step loop, `retrieval-protocol` 4 fasi gap record) + modulo
  `tools/tutor/` (11 moduli Python: Student Model SM-2 spaced repetition + provenance MD5 +
  topological_order; retrieval tool wiki+codebase; question_generator INV-G1/G2; answer_evaluator
  L1 code_exec / L2 citation_check / L3 manual; retrieval_loop 5-step INV-L1..L3; CurriculumLoader
  load/reload/validate_refs AC4; curriculum pilota 6 nodi DAG). 35 test (tutti pass). NOTA:
  `tools/tutor/` e' un modulo opzionale da installare separatamente (non scaffoldato per default).

**Cambiamenti chiave v2.31** (gate v2.31.0 PASS — 2026-07-09):
- **Voice Handsfree Improvements** (EP-044, PATTERN §30). Hardening e configurabilità del Voice
  Channel Layer introdotto in v2.28 (EP-041). Quattro US completate: VAD debounce ms configurabile
  (US-155, `vad.debounce_ms`) + wake word filter threshold configurabile (US-156,
  `wake_word.filter_threshold`, distanza edit massima) + file pipe adapter con fallback polling
  (US-158, `runtime.pipe_poll_ms` + `runtime.pipe_timeout`, comunicazione CLI senza FIFO bloccante)
  + PID file path configurabile (US-159, `runtime.pid_file_path`, gestione processo macOS/Linux con
  `pkill -fi` case-insensitive). Inoltre: blocklist anti-allucinazione STT (gate RMS pre-Whisper +
  `no_speech_prob` check + blocco pattern ripetitivi). Config `voice_channel:` aggiornata; tutti i
  nuovi campi hanno default conservativi (backward compat totale v2.30).

**Cambiamenti chiave v2.30** (gate v2.30.0 PASS — 2026-07-09):
- **Temporal Generative Time Model** (EP-043, PATTERN §3+§18 estesi). Skill
  `temporal-estimate-protocol` (4 fasi: Estimate→Monitor→Escalate→Conclude; stima adattiva
  elapsed/progress per task in volo). Comando `/sprint-progress` (burndown sprint corrente; fallback
  a conteggio kanban garantito). Config `temporal.estimate_protocol:` (default off) +
  `analytics.sprint_progress:` (default off, `velocity_rolling_days: 7`). Nessuna nuova invariante
  §7. Backward compat totale v2.29.

**Cambiamenti chiave v2.29** (gate v2.29.0 PASS — 2026-07-08):
- **Hybrid Wiki Search Layer** (EP-042, PATTERN §31). Ricerca semantica ibrida vector+FTS+RRF
  su `wiki/`. LanceDB embedded + sentence-transformers `paraphrase-multilingual-MiniLM-L12-v2`.
  Chunk H2-section cap 2000 chars. Skill `wiki-search-protocol` (4 step: embed→search→RRF merge→
  format). Comandi `/wiki-search <query>` + `reindex [--full]` + `status`. R.WS1 fallback garantito
  + R.WS2 opt-in + R.WS3 read-only. Indice `.wiki-search/index.lance` (gitignored). Config
  `wiki_search:` (default off). Backward compat totale v2.28.

**Cambiamenti chiave v2.28** (gate v2.28.0 PASS — 2026-07-08):
- **Voice Channel Layer** (EP-041, PATTERN §30). Modulo Python `voice/` esterno al meta-framework.
  STT via Faster-Whisper + TTS via Piper + VAD via Silero + AEC (sottrazione spettrale). State
  machine 5 stati: IDLE→CATTURA→TRASCRIZIONE→ELABORAZIONE→PARLATO. Custom loop adapter Opzione B;
  EventRouter allowlist TTS-safe; barge-in Fase 3; AEC Fase 4. Config `voice_channel:` (default
  off, R.P3). Backward compat totale v2.27.

**Cambiamenti chiave v2.27** (gate v2.27.0 PASS):
- **Tavola Rotonda Mode** (EP-039, PATTERN §28). Modalità multi-agente collaborativa opt-in per
  deliberazioni complesse. Agente `tavola-rotonda-moderatore` (macchina a stati 5 fasi
  Setup→Posizioni→Confronto→Convergenza→Sintesi) + skill `tavola-rotonda-protocol` (8 invarianti
  R.TR1-R.TR8: blackboard single-writer, Critico obbligatorio, budget guardrail, registro decisioni)
  + comando `/tavola-rotonda` (gate R.P3-TR, flag parsing, dispatch moderatore).
  ADR-EP039-001: blackboard markdown strutturato come canale inter-agente (O(punti-aperti) vs
  O(n×m) token). Config `tavola_rotonda.enabled: false` default (R.P3/R.TR). Runbook
  `wiki/runbooks/tavola-rotonda.md` con decision tree (quando usare vs self-consistency).
  Backward compat totale: a flag spento factory **identica a v2.26**.

**Cambiamenti chiave v2.26** (gate v2.26.0 PASS — 2026-07-02):
- **Prototype Generation Layer** (EP-035, PATTERN §27). Cascata adattiva figma→penpot→react→html
  con fallback terminale html garantito (INV-1, mai blocca). Skill `backend-resolver` (risolve il
  backend disponibile in cascata) + `prototype-generation-protocol` (5 fasi) + `html-prototype-mapping`
  (T0 html) + `react-mapping` (T1, richiede code_path FE). Agente `prototype-generator`. Comandi
  `/prototype <US|TSK|intent>` + `/prototype-status`. Config `prototyping:` (default off, R.P3).
  INV-1..INV-6 locali §27 (non si aggiungono alle 18 globali §7). ADR-EP035-001..006 GO.
  Backward compat totale: a flag spento factory **identica a v2.25**.

**Cambiamenti chiave v2.24 → v2.25** (gate v2.25.0 PASS — 2026-07-02):
- **VCS Branch Awareness Layer** (EP-034). Opt-in declare→inspect→align per multi-repo/submodule.
  Skill `branch-resolver` + `vcs-preflight-protocol` + `/vcs-status` + gate dev-protocol Fase 0.
  Config `vcs.branch_awareness` default off. R.B7-R.B10. ADR-EP034-001 GO.

**Cambiamenti chiave v2.23 → v2.24** (gate v2.24.0 PASS — 2026-06-26):
- **Runtime Contextual Suggestions** (EP-033). Tre proposte push-based, always-on una volta scaffoldate:
  A = Fase 6 Capability Relevance Check in `orchestrator.md` (6 regole condizionali al termine di
  `/run`; gate installazione per-suggerimento; output condizionale non imperativo; backward compat totale);
  B = sezione `## Suggerimento post-esecuzione` in `dev-handoff.md` (tabella per-layer fe/be/db/qa/docs;
  deduplication via `wiki/log.md`; max 3 suggerimenti; gate installazione);
  C = script `suggest-next.py` (~220 righe Python stdlib, exit 0 always, `--dry-run`) + hook Stop in
  `.claude/settings.json` (matcher `/(dev|lint|run|review)`, timeout 5, non bloccante).
- Nessuna nuova invariante §7 (restano 18). Nessun flag `factory.config.yaml` obbligatorio.
  Backward compat totale: factory senza capability → 0 suggerimenti → nessun output.
- Migration v2.23 → v2.24 = **no-op di funzionamento** senza scaffolding esplicito.

**Cambiamenti chiave vs v2.21** (gate v2.23.0 PASS — 2026-06-25):
- **Semantic Drift Detection research sprint** (EP-031, ADR-EP031-001 GO-MODIFIED). Piramide a tre
  livelli: L1 staleness (Check 4ag, always-on in `/lint` — age >180gg INFO, >365gg WARNING,
  MISSING-DATE WARNING) + L2 LLM-judge (manuale via `/semantic-drift-scan`, corpus ≤50 pagine,
  graceful degradation se API embedding non disponibile) + L3 embedding coseno (opt-in,
  `wiki_lint.semantic_check.enabled: true`, corpus >50 pagine, API key Voyage/OpenAI).
- Config block `wiki_lint.semantic_check:` (6 chiavi, default `enabled: false`). Skill
  `semantic-drift-scan-protocol` + comando `/semantic-drift-scan` (trigger manuale, non gate).
- Convenzione frontmatter `pattern_section: "§N"` per pagine wiki.
- Baseline empirica 2026-06-25: 10 pagine, FP rate 0% post-fix, score medio 0.68 (LLM-judge).
- Nessuna nuova invariante §7 (restano 18). Nessun nuovo §PATTERN top-level.
- Migration v2.21 → v2.23 = **no-op di codice** senza attivazione.

**Cambiamenti chiave vs v2.20** (eredità v2.21 preservata — gate v2.21.0 PASS 2026-06-15):
- **Design Intelligence Layer opt-in** (PATTERN §24 nuovo, EP-019). DUE capability opt-in — art-director DSL
  (statement obbligatorio INTENT/PROBLEM/RATIONALE/CONSTRAINTS pre-ogni task design) + LLM-Generator
  Separation (separazione prompt-intenzione/generazione) + Critic/Judge multi-round (verdict
  pass/conditional/reject) + Intention Economy (contesto minimo → output massimo). Skills:
  `art-director-protocol`, `design-spec-dsl`, `critic-judge-protocol`, `design-intelligence-protocol`
  (meta-skill orchestratrice), `llm-generator-separation-protocol`. Config block
  `design_intelligence:` (default `enabled: false`, `art_director: false`, `critic_judge: false`,
  `intention_economy: false`). ADR-068..071. Nessuna nuova invariante §7 (restano 18).
- **Token Ledger opt-in** (EP-022). Visibilità token reali inline dopo ogni risposta con tool use:
  script `show-session-tokens.py` + hook Stop + invariante CLAUDE.md. Config block
  `analytics.token_ledger:` (default `enabled: false`). Complementare a EP-009/EP-013 (non
  sostituisce): EP-009 harvesta batch, EP-022 mostra inline per awareness real-time.
- Migration v2.20 → v2.21 = **no-op di codice** senza attivazione. Factory senza flag = identica a v2.20.

**Cambiamenti chiave vs v2.19 (eredità v2.20 preservata)**:
- **FE Functional Oracle opt-in** (PATTERN §3 operazione opzionale «Functional Oracle», EP-018). A
  differenza di v2.19 (hardening + governance META, delta derivabile sottile), v2.20 aggiunge **una
  capability di prodotto derivabile**: la review che *esercita* il flusso reale dell'app (serve →
  carica fixture → guida interazione Playwright → asserzioni **domain-agnostic** → verdict
  **deterministico** fail-closed; critic LLM **solo advisory** sul trace). Complementare a Visual
  Oracle (EP-005, osserva il render) + UX/UI Review (EP-008, giudica l'aspetto): chiude il failure
  mode «renderizza ma non funziona».
- Scaffolda opt-in: skill `functional-oracle-protocol` + `interaction-drive-protocol` + comando
  `/functional-oracle` + schema `acceptance-spec` + dominio scheduler `functional-oracle`.
- Migration v2.19 → v2.20 = **no-op di codice** senza attivazione.

**Cambiamenti chiave vs v2.18 (eredità v2.19 preservata)**:
- **Hardening & Sustainability** (EP-012..017). Delta derivabile minimo: EP-013 Analytics
  Dogfooding opt-in (hook `SessionEnd` + blocco `analytics.dogfooding:`, default `enabled:
  false`) + fix ux_ui anti-fabbricazione ADR-063 (`evidence-provenance`, fail-loud, 3 tool
  `.sh`). §22 Release Governance + §23 Complexity Budget = governance META, non scaffoldata
  in factory derivate. Nessuna nuova invariante §7 (restano 18). Migration v2.18 → v2.19 =
  **no-op di codice** senza attivazione.

**Cambiamenti chiave vs v2.17 (eredità v2.18 preservata)**:
- **A11y + UX/UI Integration opt-in** (PATTERN §3, 3 operazioni canoniche opzionali). Il
  seed v2-18 **estende v2-17** aggiungendo una sola sezione, la **Fase 1.sexies**, che
  attiva opt-in due capability standalone: `a11y` (Accessibility Testing WCAG 2.2 AA via
  tool `run_a11y_scan` + skill `accessibility-testing-protocol` + agente `a11y-specialist`
  + `/a11y`) e `ux_ui` (UX/UI Review & Design via skill `ux-ui-review-protocol` +
  `ux-ui-design-protocol` + agenti `ux-ui-reviewer` + `ui-designer` + `/ux-ui-review` +
  `/ux-ui-design`).
- Tocca skill/agent esistenti (`dev-protocol` Fase 4-ter, `code-review-protocol`
  precondition + 4° pass opzionale `accessibility`, `parallel-scheduling` domini `a11y` +
  `ux-ui-review`, `lint-checks` Check 4o + 4p, `scrivi-task` sezioni FE), ma **tutto no-op
  a flag spento**: l'opt-in reale è l'attivazione (`a11y.*` / `ux_ui.*` + Playwright).
- Ordering pipeline FE (tutti gli opt-in attivi): `develop → visual-oracle → ux-ui-review
  → code-review` (ADR-019). 7 ADR risolti (ADR-014..020). Nessuna nuova invariante §7.
- Default scelta utente **N** per entrambe (zero friction). Migration v2.17 → v2.18 =
  **no-op di codice** senza attivazione.
- ⚠️ **Nota delta seed**: v2-18 dichiara `extends: v2-17` (catena fino a v2-15 + Fase 2/5
  di v2-12). `extends:` è una convenzione, non auto-risolvente: un agente che fetcha solo
  `meta-prompts/v2-18/factory-bootstrap.md` ottiene la sola Fase 1.sexies, **non** la
  procedura completa. Per evitarlo, risolvi tutta la catena fetchando ogni seed padre,
  **oppure** usa `--version=v2-18-full` (catena inlinata in un unico file).

**Cambiamenti chiave vs v2.16 (eredità v2.17 preservata)**:
- **FE Visual Oracle opt-in** (PATTERN §3 variante di Develop FE). Il seed v2-17
  **estende v2-16** aggiungendo una sola sezione, la **Fase 1.quinquies**, che attiva
  opt-in il FE Visual Oracle: skill `visual-oracle-protocol` (render headless Playwright
  + critica visiva LLM multi-viewport/tema, pattern evaluator-optimizer) + `oracle-precheck`
  + comando `/visual-oracle` + blocco config `fe_correctness`.
- A differenza di v2.16 (file puramente additivi), tocca anche skill esistenti
  (`dev-protocol` Fase 4-bis, `code-review-protocol` Fase 0 precondition, `fe-dev`,
  `scrivi-task` State Matrix/Granularity, `lint-checks` Check 4n, `orchestrator` Oracle
  Gate, `parallel-scheduling` dominio `visual-oracle`), ma **tutte le integrazioni sono
  no-op a flag spento**: l'opt-in reale è l'attivazione (`fe_correctness.*` + Playwright).
- Default scelta utente **N** (zero friction — factory senza attivazione = identica a v2.16).
- Nessuna nuova invariante §7 (restano 18). Single-writer `visual_status` (solo la skill).
- Migration v2.16 → v2.17 = **no-op di codice** senza attivazione.

**Cambiamenti chiave vs v2.15 (eredità v2.16 preservata)**:
- **Pattern Premortem opt-in** (PATTERN §3 operazione opzionale). Il seed v2-16
  **estende v2-15** (non v2-13: estendere v2-13 perderebbe il Compression Layer)
  aggiungendo una sola sezione, la **Fase 1.quater**, che scaffolda opt-in la skill
  `premortem-protocol` + comando `/premortem` + template `management/risk-registry.md`.
- Default scelta utente **N** (zero friction, R.P3 — factory senza skill = identica a v2.15).
- Nessuna nuova invariante §7 (R.P1-R.P3 vivono nella skill). Nessun gate auto-enforcing.
- Migration v2.15 → v2.16 = **no-op di codice** senza opt-in.

**Cambiamenti chiave vs v2.14 (eredità v2.15 preservata)**:
- **Consolidation release**: nessuna nuova feature di framework. Bump versione del
  PATTERN 2.14 → 2.15 per chiudere il ciclo del Compression Layer a due assi come
  baseline stabile.
- **Gate empirici Fase 1.5 + 3a riformulati come opt-in deferred** (non bloccanti
  per il consolidamento del PATTERN). Restano setup-ready ma eseguibili a
  discrezione del derivatore della factory quando dispone di parametri di baseline
  adeguati.
- Tutte le invarianti R.C1-R.C6 (OCL), R.G1-R.G6 (CCL), R.K1 (karpathy non
  comprimibile) **preservate identiche**.
- Default `compression.output.enabled: false` + `compression.context.enabled: false`
  invariati.
- Migration v2.14 → v2.15 = **no-op di codice**. Le factory v2.14 si comportano
  identiche su v2.15.

**Cambiamenti chiave di v2.14 (eredità preservata)**:
- **Compression Layer a due assi opt-in** (PATTERN §20 nuovo):
  - Asse OUTPUT (Fase 1 OCL via Caveman) — comprime canali messaging agent-to-agent.
  - Asse CONTEXT (Fase 2 CCL via Graphify) — knowledge graph del code_path come
    context replacement, confidence-gated dispatch (executor/explorer/reviewer).
- 6 invarianti R.C1-R.C6 (output, R.C1 non overridabili neppure in `custom`).
- 6 invarianti R.G1-R.G6 (context, filesystem single source of truth + side-channel
  write-restricted).
- Nuova §7 r.18 PATTERN: compression mai sugli artefatti persistenti.
- 4° sync adapter `graphify-sync` (PDF / Figma / Repo / Graph).
- Tooling: Graphify v0.8.22+ (pip install graphifyy, binario `graphify`).

**Architettura skill-driven** (invariata da v2.13):
```
factory-bootstrap (thin orchestrator)
    │
    ├── bootstrap-input-protocol         (input + archetipi)
    ├── bootstrap-multirepo-protocol     (coupling se existing-repo)
    ├── bootstrap-multiadapter-protocol  (adapter selection + scaffold)
    ├── bootstrap-scaffolding-protocol   (file + dir L1-L5 + compression artefacts v2.14+)
    ├── bootstrap-vcs-protocol           (submodule stamps + .factory-lock)
    └── bootstrap-validation-protocol    (35+ check + wiki feeding + report)
```

## Esecuzione

**Read** il file della versione risolta (via Method A/B/C) e seguilo letteralmente.
Il seed è auto-contenuto: include riferimenti a PATTERN.md (fetched), agli adapter
manifests, e ai template di reference.

## Cronologia versioni

| Versione | Data | Cambiamenti principali |
|---|---|---|
| **v2.32 (corrente)** | 2026-07-10 | **Capability Formativa + Voice Hardening** (EP-045 + EP-046). Estende v2-31. EP-046: 7 contratti FSM voice hardening (C1 lifecycle single-writer, C2 `playing_watchdog_s`, C3 liveness file-pipe, C4 timer cattura config-driven, C5+C6 gate STT `no_speech_prob`+`compression_ratio`, C7 session-owner stub); ADR-EP046-001 GO. EP-045: tutoring adattivo MVP (agente `tutor.md` + 4 skill + `tools/tutor/` 11 moduli, 35 test); Student Model SM-2, retrieval practice loop, curriculum YAML; `capability_formativa.enabled: false` default. Backward compat totale v2.31. Gate v2.32.0 PASS 2026-07-10. |
| v2.31 | 2026-07-09 | **Voice Handsfree Improvements** (EP-044, PATTERN §30). Estende v2-30. Hardening Voice Channel: VAD debounce configurabile (`vad.debounce_ms`) + wake word threshold (`wake_word.filter_threshold`) + file pipe adapter polling (`runtime.pipe_poll_ms` + `runtime.pipe_timeout`) + PID path (`runtime.pid_file_path`) + blocklist anti-allucinazione STT. Backward compat totale v2.30. Gate v2.31.0 PASS 2026-07-09. Include anche EP-041 Voice Channel (v2.28) + EP-042 Hybrid Wiki Search (v2.29) + EP-043 Temporal Estimate Protocol (v2.30). |
| v2.30 | 2026-07-09 | **Temporal Generative Time Model** (EP-043, PATTERN §3+§18). Estende v2-29. Skill `temporal-estimate-protocol` + comando `/sprint-progress` (burndown sprint, fallback kanban). Config `temporal.estimate_protocol:` + `analytics.sprint_progress:`. Gate v2.30.0 PASS 2026-07-09. |
| v2.29 | 2026-07-08 | **Hybrid Wiki Search Layer** (EP-042, PATTERN §31). Estende v2-28. Ricerca semantica ibrida vector+FTS+RRF su `wiki/`. LanceDB + sentence-transformers. Skill `wiki-search-protocol` + `/wiki-search`. Config `wiki_search:`. Gate v2.29.0 PASS 2026-07-08. |
| v2.28 | 2026-07-08 | **Voice Channel Layer** (EP-041, PATTERN §30). Estende v2-27. Modulo Python `voice/` esterno. STT Faster-Whisper + TTS Piper + VAD Silero + AEC. State machine 5 stati. Custom loop adapter Opzione B. Config `voice_channel:`. Gate v2.28.0 PASS 2026-07-08. |
| v2.27 | 2026-07-06 | **Tavola Rotonda Mode** (EP-039, PATTERN §28). Estende v2-26. Modalità multi-agente collaborativa opt-in per deliberazioni complesse. Agente `tavola-rotonda-moderatore`: macchina a stati 5 fasi (Setup→Posizioni→Confronto→Convergenza→Sintesi). Skill `tavola-rotonda-protocol`: 8 invarianti R.TR1-R.TR8 (blackboard single-writer, Critico obbligatorio, budget guardrail, registro decisioni wiki/decisions/). Comando `/tavola-rotonda`: gate R.P3-TR. ADR-EP039-001 (blackboard markdown strutturato, O(punti-aperti) vs O(n×m) token). Config `tavola_rotonda.enabled: false` default (backward compat totale v2.26). Runbook `wiki/runbooks/tavola-rotonda.md` con decision tree. Gate v2.27.0 PASS. **Variante `v2-27-full`**: catena `extends` (v2.15→v2.27) consolidata in un unico file self-contained. Consigliata per uso offline, accesso URL singola, LLM non-Claude. |
| v2.26 | 2026-07-02 | **Prototype Generation Layer** (EP-035, PATTERN §27). Estende v2-25. Cascata adattiva figma→penpot→react→html con fallback terminale html garantito (INV-1). Skills: `backend-resolver` + `prototype-generation-protocol` + `html-prototype-mapping` + `react-mapping` (T1). Agente `prototype-generator`. Comandi `/prototype` + `/prototype-status`. Config `prototyping:` default off (R.P3, backward compat totale v2.25). INV-1..INV-6 locali §27. ADR-EP035-001..006 GO. Gate v2.26.0 PASS (3/3 RUN-REPORT). **Variante `v2-26-full`**: catena `extends` (v2.15→v2.26) consolidata in un unico file self-contained (1860 righe). Consigliata per uso offline, accesso URL singola, LLM non-Claude. |
| v2.25 | 2026-07-02 | **VCS Branch Awareness Layer** (EP-034, opt-in). Estende v2-24. Ciclo declare→inspect→align per multi-repo/submodule: skill `branch-resolver` + `vcs-preflight-protocol` + `/vcs-status` + gate dev-protocol Fase 0 + drift check vcs-handoff. Config `vcs.branch_awareness` default off; R.B7-R.B10; ADR-EP034-001 GO. Nessuna nuova invariante §7 (restano 18). Gate v2.25.0 PASS. **Variante `v2-25-full`**: catena `extends` (v2.15→v2.25) consolidata in un unico file self-contained (1664 righe). |
| v2.24 | 2026-06-26 | **Runtime Contextual Suggestions** (EP-033). Estende v2-23. TRE artefatti push-based: A = Fase 6 orchestrator.md (6 regole condizionali, gate installazione, output condizionale) + B = dev-handoff.md sezione post-exec per-layer (fe/be/db/qa/docs, deduplication, max 3) + C = suggest-next.py (~220 righe Python stdlib, exit 0 always, `--dry-run`) + hook Stop (matcher `/(dev|lint|run|review)`, timeout 5). Nessun flag factory.config.yaml obbligatorio; backward compat totale. Nessuna nuova invariante §7 (restano 18). Gate v2.24.0 PASS. |
| v2.23 | 2026-06-25 | **Semantic Drift Detection** (EP-031, research sprint). Estende v2-21. Piramide L1 staleness (Check 4ag, always-on in `/lint`) + L2 LLM-judge + L3 embedding coseno (opt-in). Config `wiki_lint.semantic_check:`. Skill `semantic-drift-scan-protocol` + `/semantic-drift-scan`. Gate v2.23.0 PASS. **Variante `v2-23-full`**: self-contained (1480 righe). |
| v2.21 | 2026-06-15 | **Design Intelligence Layer + Token Ledger** (EP-019 + EP-022, opt-in). Estende v2-20. DUE capability opt-in: EP-019 (art-director DSL + LLM-Generator Separation + Critic/Judge + Intention Economy; PATTERN §24; ADR-068..071) + EP-022 (Token Ledger inline — `show-session-tokens.py` + hook Stop). Default entrambi `false`. Nessuna nuova invariante §7 (restano 18). Gate v2.21.0 PASS (3/3 RUN-REPORT, analytics_events_count > 0). **Variante `v2-21-full`**: catena `extends` (v2.15→v2.21) consolidata in un unico file self-contained (1423 righe). |
| v2.20 | 2026-06-10 | **FE Functional Oracle** (EP-018, opt-in). Estende v2-19. Prima capability di prodotto derivabile dopo l'hardening v2.19: la review che *esercita* il flusso reale dell'app (serve → fixture → interazione Playwright → asserzioni domain-agnostic → verdict deterministico, critic LLM advisory). Complementare a Visual Oracle + UX/UI Review; chiude «renderizza ma non funziona». Skill `functional-oracle-protocol` + `interaction-drive-protocol` + `/functional-oracle` + schema `acceptance-spec` + dominio scheduler `functional-oracle`. Default `fe_correctness.functional_oracle.enabled: false` → factory identica a v2.19. ADR-065/066/067. Nessuna nuova invariante §7. Migration v2.19 → v2.20 = no-op senza attivazione. |
| v2.19 | 2026-06-09 | **Hardening & Sustainability** (EP-012..017). Estende v2-18. Delta derivabile: EP-013 Analytics Dogfooding opt-in + fix ux_ui anti-fabbricazione ADR-063. §22/§23 governance META, non scaffoldata in factory derivate. Nessuna nuova invariante §7 (restano 18). Migration v2.18 → v2.19 = no-op senza attivazione. |
| v2.18 | 2026-06-04 | **A11y + UX/UI Integration** opt-in (PATTERN §3, 3 operazioni canoniche opzionali). Estende v2-17 con la Fase 1.sexies opt-in (capability `a11y` via tool `run_a11y_scan` + skill `accessibility-testing-protocol` + agente `a11y-specialist`; capability `ux_ui` via skill `ux-ui-review-protocol` + `ux-ui-design-protocol` + agenti `ux-ui-reviewer` + `ui-designer`). Tocca skill/agent esistenti ma no-op a flag spento. 7 ADR risolti (ADR-014..020). Nessuna nuova invariante §7. Default N. Migration v2.17 → v2.18 = no-op senza attivazione. **Variante `v2-18-full`**: catena `extends` consolidata in un unico file self-contained. |
| v2.17 | 2026-06-03 | **FE Visual Oracle Integration** opt-in (PATTERN §3 variante Develop FE). Estende v2-16 con la Fase 1.quinquies opt-in (attiva skill `visual-oracle-protocol` + `oracle-precheck` + `/visual-oracle` + blocco `fe_correctness`). Tocca skill esistenti ma no-op a flag spento. Nessuna nuova invariante §7 (restano 18). Default N. Migration v2.16 → v2.17 = no-op senza attivazione. |
| v2.16 | 2026-06-01 | **Premortem Integration** opt-in (PATTERN §3). Estende v2-15 con la Fase 1.quater opt-in (scaffolda skill `premortem-protocol` + `/premortem` + template risk-registry). Nessuna nuova invariante §7. Default N. Migration v2.15 → v2.16 = no-op senza opt-in. |
| v2.15 | 2026-05-29 | **Consolidation release** del Compression Layer v2.14. Gate Fase 1.5 + 3a riformulati come opt-in deferred. 35 check. Migration v2.14 → v2.15 = no-op di codice. |
| v2.14 | 2026-05-28 | **Compression Layer a due assi opt-in** (§20 nuovo): Output via Caveman (R.C1-R.C6) + Context via Graphify (R.G1-R.G6). Nuova §7 r.18. 4° sync adapter `graphify-sync`. 34 check. |
| v2.13 | 2026-05-27 | Multi-adapter scaffolding parallelo (§12 esteso) — registry + 5 adapter + R.A1-R.A6. Meta-prompt versionati nel repo. 28 check. |
| v2.12 | 2026-05-27 | CQRL (§19) + multi-repo `code_paths` (§13) + coupling modes R.B1-R.B6 (§16) + existing-repo wiki feeding. Thin orchestrator + 5 bootstrap-* skill. |
| v2.11 | 2026-05-26 | Parallel scheduler DAG-driven (§18). |
| v2.10 | 2026-05-25 | Publisher adapters (§17). |
| v2.9 | 2026-05-21 | Sync adapters multi-sorgente — figma-sync (§16). |
| v2.8 | precedente | VCS integration (§15). |
| v2.7 | precedente | execution layer L5, dev-agent opzionali, topology esplicite. |

Per il diff completo + statistiche evolutive vedi
[`meta-prompts/README.md`](../../meta-prompts/README.md).
