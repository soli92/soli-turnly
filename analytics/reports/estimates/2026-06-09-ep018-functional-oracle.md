---
estimate_id: EST-2026-06-09-002
type: estimate
scope: EP-018 — FE Functional Oracle (Sprint 21, 16 TSK)
method: hybrid (RCF reference-class + PERT per-TSK)
audience: project
created: 2026-06-09
rate_basis: token-cost (LLM); fully-loaded human N/A (consumer:agent)
reference_class: Sprint 20 anti-fabbricazione (docs-layer, N=6 subagent TSK)
previous_estimate_id: null
---

# Stima costi — EP-018 FE Functional Oracle (Sprint 21)

> **Stima previsionale (forward-looking)**, NON misura consuntiva. 16 TSK, tutti `layer: docs` /
> `consumer: agent`. Reference class: Sprint 20 (anch'esso docs: skill/agent/ADR/lint/PATTERN) —
> costi reali per-TSK in `analytics/reports/2026-06-09-sprint20-cost-census.md`. Mai numero puntuale.

## §1 Reference class (dati reali, Sprint 20 docs subagent su sonnet-4-6)

N=6 TSK direttamente comparabili (skill/agent/ADR/lint/PATTERN authoring):

| metrica | valore |
|---|---|
| costo/TSK (sonnet, esecuzione pura) | min $0.067 · **mediana ~$0.093** · max $0.119 |
| token/TSK | 29.5K – 52.4K (mediana ~40K) |
| P15 / P85 costo | ~$0.072 / ~$0.110 |

## §2 Intervalli di stima (P50 / P85)

EP-018 = **9 TSK S + 7 TSK M**. PERT per-TSK ancorato alla reference class:
- S (config/gitignore/quickstart/lint): O $0.055 · M $0.072 · P $0.10 → mean ~$0.074
- M (skill-phase/agent-mode/PATTERN/schema): O $0.080 · M $0.094 · P $0.125 → mean ~$0.096

| Voce | P50 | P85 |
|---|---|---|
| **Esecuzione TSK** (16 subagent su sonnet, contesto focalizzato) | **~$1.3** | **~$2.0** |
| **Orchestrazione** (opus: 9 wave × dispatch/verify/commit/record + gate) | **~$3.5** | **~$7.0** |
| **Run cost totale** | **≈ $5** | **≈ $9** |

**Contingency: 35%** (enforced per `confidence: low`, ADR-025 §C-D) → **tetto budget ≈ $12**.

Tempo (informativo): ~30–60 min di sessione attiva (subagent 1–3 min ciascuno, `max_parallel: 4`,
9 wave + commit per wave). Il wall-clock dipende dal parallelismo, il costo quasi no.

## §3 Sensitivity drivers (ordinati per impatto)

1. **Modello dell'orchestratore (DOMINANTE).** L'esecuzione pura è ~$1.3; il driver di costo è
   l'orchestrazione su opus (census Sprint 20 §4-§5). Orchestrare i passi meccanici
   (dispatch/commit/record) su un modello intermedio terrebbe opus solo per le decisioni → run cost
   potenzialmente −40/60%.
2. **Rework / loop di review.** Se CQRL (`/review`) o un eventuale loop conditional scattano sui TSK,
   ogni iterazione aggiunge ~1 costo-TSK. La stima assume **0–1 iterazioni** (i TSK docs Sprint 20
   passarono al primo colpo, 0 ambiguità).
3. **Warmth della cache.** Eseguito in sessione singola a cache calda (come Sprint 20) → costi bassi;
   sessioni frammentate o cache fredda alzano l'input cost.
4. **Modello degli esecutori.** Assunto sonnet-4-6 (adeguato per docs, confermato Sprint 20). Un
   upgrade a opus sugli esecutori ~5x il costo esecuzione (ma resta ordine «pochi $»).

## §4 Assunzioni esplicite

- Esecutori = dev-agent su **sonnet-4-6**; orchestratore = **opus** (mix attuale).
- Contesto per-TSK **focalizzato** ({TSK + ADR + file target}, ~30–50K token), non session-aggregate.
- 0–1 iterazioni di rework; nessun blocco da Q hard aperte.
- Nessun costo umano (`consumer: agent`); rate card umana non applicata.
- Pricing da `analytics/pricing.yaml` (sonnet $3/$15; opus $15/$75; cache 0.1x/1.25x).

## §5 Qualità della reference class

| | |
|---|---|
| N | 6 (Sprint 20 docs subagent) |
| similarity | **high** (stesso layer docs, stessa natura skill/agent/ADR/PATTERN) |
| confidence | **low** (N < 10 = `rcf_medium_confidence_threshold`; similarity high non promuove sopra il bucket di N) |
| mode | hybrid RCF+PERT (RCF non pienamente applicabile sotto N=10, PERT integra) |

**Onestà sui limiti**: la banda statistica per-TSK sarebbe molto stretta (task indipendenti, varianza
piccola), ma **sottostimerebbe** l'incertezza reale, che è **sistemica** (scelta modello orchestratore
+ rework), non statistica. P85 è quindi allargato oltre la pura propagazione PERT. Il driver di costo
non è «quanto costa un TSK» (noto e piccolo) ma «quanto costa orchestrare le 9 wave su opus».

## §6 Raccomandazione

Run cost atteso **≈ $5 (P50), tetto ~$12 (P85+contingency)** — un ordine di grandezza «pochi dollari»,
coerente con Sprint 20. Leva di risparmio principale: orchestrare i passi meccanici su modello
intermedio. Calibrabile ex-post con `/estimate --review-accuracy=EST-2026-06-09-002` dopo il Develop.
