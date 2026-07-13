---
type: runbook
status: draft
sources:
  - wiki/concepts/factory-premortem-integration.md
  - wiki/concepts/premortem-skill.md
  - wiki/concepts/risk-classification-tigers-paper-tigers-elephants.md
  - design_&_architecture/proposta-premortem-integration-v216.md
created: 2026-06-01
updated: 2026-06-01
---

# Runbook — usare `/premortem` in una factory v2.16

Playbook operativo per chi vuole stress-testare un piano o un artefatto con il
pattern Premortem (operazione opzionale PATTERN §3, v2.16). Per il *perché*
cognitivo vedi [[premortem-skill]]; per la tassonomia dell'output vedi
[[risk-classification-tigers-paper-tigers-elephants]]; per l'architettura completa
vedi [[factory-premortem-integration]].

> **Opt-in totale (R.P3)**: una factory che non scaffolda la skill si comporta
> identica a v2.15. L'output non viene **mai** auto-applicato (R.P1): Revised Plan e
> checklist sono suggerimenti per te.

## 1. Quando usare `/premortem`

Invoca una premortem quando **il costo di sbagliare è alto e hai ancora margine di
manovra**:

- prima di un PATTERN bump major (es. v2.x → v3.0) o di una nuova invariante §7;
- prima di promuovere un'**epica `high-impact`** da draft → review;
- prima di promuovere un **design doc** con touchpoint cross-cutting;
- prima di una migrazione architetturale importante (es. DB, attivazione CCL Fase 3b);
- prima di un'assunzione chiave non verificabile a priori;
- quando la confidence degli stakeholder è alta e va stress-testata, o quando il
  team ha una brutta sensazione che non riesce ad articolare.

## 2. Quando NON usare `/premortem`

- validazione/feedback generico → usa `/code-review` o discussione libera;
- domande fattuali («come fa X a fare Y?») → usa `/query` sul wiki;
- brainstorming creativo → la premortem è retrospettiva, non generativa di alternative;
- decisioni **già irrevocabili** (es. commit già pushato) → spreca token e produce
  ansia inutile; usa la premortem per la *prossima* decisione.

## 3. Esempio 1 — artefatto kanban (`/premortem EP-001`)

**Input**: `/premortem EP-001` (input shape artefatto-kanban; timeframe default 6mo per EP).
**Tempo stimato**: ~3-6 min (Fase 4 fan-out incluso).

La skill carica EP-001 + le sue US figlie + il design doc. Fase 1: bar minimo
soddisfatto per deduzione (artefatto ben formato → 0 domande). Output Risk Registry
(estratto, calibration valida):

```
Total risks: 8
  - Tigers: 4 (Launch-Blocking: 1, Fast-Follow: 2, Track: 1)
  - Paper Tigers: 2
  - Elephants: 2

| # | Risk | Category | Tier | Urgency | ... | Decision |
| 1 | EP-002/003/004 mai chiuse → skill orfana | Execution | Tiger | LB | ... | open |
| 3 | Calibrazione degenere → tassonomia inutile | Assumptions | Tiger | FF | ... | open |
| 7 | R.P1-P3 non enforced (solo doc) | Technical | Paper Tiger | — | ... | dismissed |
| 2 | Adozione zero: opt-in + no trigger | People | Elephant | — | ... | open |
```

**Cosa osservare**: il Most Likely Failure (milestone abbandonata a metà) e
l'Hidden Assumption («il giudizio umano su *quando* fare premortem è affidabile
senza nudge») sono più preziosi delle singole righe.

## 4. Esempio 2 — descrizione libera con `--timeframe` (`/premortem "..." --timeframe=12mo`)

**Input**: `/premortem "PATTERN v2.16 → v3.0: rimozione retro-compat su §2 ruoli" --timeframe=12mo`
**Tempo stimato**: ~4-7 min (Fase 1 richiede ≥1 domanda — descrizione libera).

Su descrizione libera la Fase 1 quasi sempre pone ≥1 domanda di bar minimo (per
chi / come appare il successo). Con orizzonte lungo (12mo) emergono soprattutto
**Elephant**. Output focus:

```
Total risks: 6
  - Tigers: 2 (LB: 1, FF: 1, Track: 0)
  - Paper Tigers: 1
  - Elephants: 3

| # | Risk | Category | Tier | Urgency | ... | Decision |
| 1 | Factory derivate restano su v2.x, nessuno migra a v3.0 | People | Elephant | — | ... | open |
| 2 | "Rimuovere retro-compat sembra pulito ma rompe utenti silenziosi" | Assumptions | Elephant | — | ... | open |
| 4 | Breaking change §2 non rilevato fino al primo bootstrap fallito | Technical | Tiger | LB | ... | open |
```

**Cosa osservare**: l'orizzonte lungo amplifica i rischi `People`/`Assumptions`
(adozione, abitudini, utenti silenziosi) che a 2 settimane non vedresti.

## 5. Esempio 3 — pagina wiki (`/premortem wiki/concepts/factory-premortem-integration.md`)

**Input**: `/premortem wiki/concepts/factory-premortem-integration.md` (input shape pagina-wiki; default 6mo).
**Tempo stimato**: ~3-5 min.

La skill carica la pagina + i wikilink di primo hop. Utile per stress-testare un
**design** prima di taskizzarlo. Output focus sui 4 check non-negoziabili di
preservazione karpathy (densità citazioni, wikilink bidirezionali, namespace,
provenance) se il target tocca la knowledge base:

```
Total risks: 5
  - Tigers: 2 (LB: 1, FF: 1, Track: 0)
  - Paper Tigers: 1
  - Elephants: 2

| # | Risk | Category | Tier | Urgency | ... | Decision |
| 1 | Design approvato ma skill mai dogfoodata → drift doc↔impl | Execution | Tiger | LB | ... | open |
| 3 | "Tutti d'accordo sul design, nessuno l'ha letto fino in fondo" | People | Elephant | — | ... | open |
```

## 6. Backward compat verification

La migration v2.15 → v2.16 è un **no-op** per chi non opta-in. Verifica empirica
documentata in TSK-009 / US-008: due run di `/lint` sulla stessa factory (baseline
v2.15 vs v2.16 senza blocchi `risk_classification:` aggiunti) devono produrre
**0 nuove ERROR / 0 nuove WARNING**. I tre migration path (v2.13 / v2.14 / v2.15 →
v2.16) sono tutti no-op senza opt-in. Vedi i report in `wiki/lint/`.

## 7. Setup opt-in (3 step manuali)

Se la tua factory non ha ancora la skill:

1. Copia `.claude/skills/premortem-protocol.md` (la skill, 5 fasi).
2. Copia `.claude/commands/premortem.md` (il comando dispatcher).
3. Copia `management/risk-registry.md` (il template del Registry — opzionale ma
   raccomandato per persistere l'output).

Nessun edit a `factory.config.yaml` è richiesto per attivare la skill (il dominio
scheduler `premortem` ha default `parallel`, ma `/premortem` funziona anche con
scheduler disattivato).

**Alternativa automatica**: il seed `meta-prompts/v2-16/factory-bootstrap.md`
(TSK-010 / US-009) ha una **Fase 1.quater** opt-in che scaffolda i 3 file
rispondendo `y` a una domanda durante il bootstrap.

## Self-premortem: limiti epistemici

Fare una premortem **su sé stessi** (es. la self-premortem v2.16, US-016) ha un
bias intrinseco: chi ha progettato il piano fatica a immaginarne il fallimento con
la stessa lucidità di un esterno. La premortem riduce il bias ottimistico ma non lo
azzera quando autore e analista coincidono. Mitigazioni: usare un timeframe più
lungo del previsto, nominare esplicitamente almeno un Elephant `People`, e
considerare l'output un *floor* di rischi (mai un *ceiling*). Cross-link: US-016
(self-premortem release gate v2.16).

## Appendice — Esempio 4: self-premortem v2.16 (dogfooding)

**Input**: `/premortem wiki/concepts/factory-premortem-integration.md --timeframe=12mo`
(eseguita come release gate della milestone, TSK-018, `consumer: agent`).

È la premortem applicata al **proprio** design (Opzione B skill standalone opt-in),
con orizzonte lungo (12mo) per far emergere gli Elephant strutturali. Risultato:
7 rischi, calibration valida (Tigers 3 / Paper Tigers 2 / Elephants 2). Output
completo persistito in [`management/risk-registry.md`](../../management/risk-registry.md)
§«Pre-Mortem: v2.16 release (self-premortem)».

Insight chiave (vale la pena leggerli prima di adottare il pattern):
- **Hidden Assumption**: che la *struttura* (5 fasi + tassonomia + registry) valga
  più della cerimonia che impone — e che l'opt-in generi evidenza per evolversi.
- **Most Dangerous Failure**: telemetria solo-metadati (ADR-006) → impossibile
  costruire il business case per promuovere il pattern a v2.17. Gap registrato in
  `wiki/gaps.md` (`premortem-v217-promotion-threshold-undefined`).

Conferma operativa delle invarianti durante il gate: **R.P1** (output non
auto-applicato — counterexample tentato e fallito), **R.P2** (bar soddisfatto per
deduzione, fail-loud non scattato perché contesto sufficiente), **R.P3** (`/lint`
v2.15-only = 0 nuove ERROR/WARNING). Vedi anche la sezione «Self-premortem: limiti
epistemici» sopra: il dogfooding ha bias intrinseco, trattare l'output come *floor*
di rischi, non *ceiling*.

## Vedi anche

[[premortem-skill]] · [[risk-classification-tigers-paper-tigers-elephants]] ·
[[factory-premortem-integration]] · [[compression-validation-template]] ·
[[wiki-as-graph-poc-template]] · [[code-quality-review-runbook]]
