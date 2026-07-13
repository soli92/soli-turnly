---
type: runbook
sources: ["raw/code_quality_review_layer.md"]
status: draft
created: 2026-05-27
updated: 2026-05-27
tags: [code-quality, review, runbook, implementazione, loop-control, batching]
---

# Code Quality Review Layer — Runbook operativo

> Playbook per implementare e operare il code quality review layer in un framework multi-agentico: roadmap a 9 fasi, configurazione del loop control, strategie di batching dei finding e procedure di escalation.

## Contesto

Questo runbook si affianca al concept [[code-quality-review-layer]] e al concept [[stack-aware-ruleset]]. Copre la dimensione operativa: come costruire il layer passo dopo passo, come configurare il loop control e le soglie di escalation, come scegliere la strategia di batching. [^src: raw/code_quality_review_layer.md §6. Roadmap implementativa suggerita]

## Roadmap implementativa

| Fase | Obiettivo | Output verificabile |
|---|---|---|
| **0** | Definizione formati | Schema JSON per `stack_descriptor`, `finding`, `rule`, `task_package` |
| **1** | Stack Detector MVP | Riconoscimento corretto su 3-5 stack core del dominio |
| **2** | Reviewer mono-passata | Passata 1 (idiomaticità) su uno stack pilota, output JSON valido |
| **3** | Ruleset canonical iniziale | 20-30 regole curate per lo stack pilota |
| **4** | Tre passate + aggregator | Pipeline completa su stack pilota |
| **5** | Persistence + Router | Report in KB, invocazione dev agent con task package |
| **6** | Loop control | Iteration counter, no-progress detection, regression detection |
| **7** | Loop evolutivo KB | Clustering settimanale + promozione candidate rule |
| **8** | Multi-stack | Estensione agli altri stack della flotta |
| **9** | Analytics & tuning | Dashboard su `trigger_count`, `false_positive`, `pass rate` per stack/agente |

## Configurazione del loop control

Il loop control protegge da loop infiniti tra dev agent e reviewer. Vanno configurate tre soglie: [^src: raw/code_quality_review_layer.md §Loop control]

**`max_iterations`** (default: 3) — numero massimo di round review → fix → re-review prima di escalare a agente arbitro o umano.

**No-progress detection** — se due iterazioni consecutive producono lo stesso insieme di `rule_id` violate, escalare immediatamente senza attendere `max_iterations`.

**Regression detection** — se in iter N+1 emergono finding nuovi in file non toccati dalla fix precedente, alzare un flag rosso e consigliare rollback.

Riferimento: il meccanismo è analogo al [[circuit-breaker]] della factory (soglia su retry falliti → escalation).

## Selezione dell'agente dev

Due input combinati per il routing:

1. **`stack_descriptor`** prodotto dallo Stack Detector (vedi [[code-quality-review-layer]])
2. **Routing table** sulla KB: `stack_pattern → agent_id`

Fallback: dev agent generico con flag di warning sul report.

## Strategie di batching dei finding

Scegliere la strategia in base al volume e alla topologia dei finding: [^src: raw/code_quality_review_layer.md §Strategie di batching]

**All-in-one** (≤ 7 finding): un solo task package, fix completo in un giro. Adatto per artefatti piccoli o finding concentrati in un solo modulo.

**Severity-tiered** (> 7 finding): round multipli con mini-review intermedie — prima critical/high, poi medium, infine low. Riduce il rischio che la complessità del fix in un round introduca regressioni nel successivo.

**Split-by-area** (finding su moduli indipendenti con infrastruttura parallela): più istanze dev agent in parallelo. Compatibile con il [[parallel-scheduler]] della factory (v2.11) se i moduli hanno code path non sovrapposti.

Default ragionevole: severity-tiered oltre soglia, altrimenti all-in-one.

## Feedback all'autore originale

L'agente che ha generato il codice originale riceve un **digest** (non il task package completo): "stack X, sui tuoi ultimi N artefatti, errori frequenti su rule Y". Con memoria persistente per agente, questo è il canale per migliorare a monte e ridurre il carico futuro sul reviewer. [^src: raw/code_quality_review_layer.md §Feedback all'autore originale]

## Monitoraggio della salute del layer

Metriche da tenere sotto controllo per evitare derive (vedi [[code-quality-review-layer]] §Rischi sistemici):

- **Pass rate per stack**: se cronicamente sotto il 5%, il reviewer è troppo aggressivo (review theater).
- **Rapporto `false_positive_count / trigger_count`** per regola: sopra soglia → riformulare o disattivare la regola.
- **Tasso di escalation** (iterazioni che raggiungono `max_iterations`): indica loop non convergenti o regole inapplicabili dallo stack.
- **Tempo medio a convergenza** per artefatto: metrica di efficienza complessiva del layer.

## Concetti correlati

[[code-quality-review-layer]]
[[stack-aware-ruleset]]
[[circuit-breaker]]
[[evaluator-optimizer]]
[[parallel-scheduler]]
[[feedback-loop-gate]]

## Pagine collegate

[[2026-05-27-code-quality-review-layer]]

## Storie collegate
<!-- Sezione gestita dal product-manager — non modificare se sei wiki-keeper -->
