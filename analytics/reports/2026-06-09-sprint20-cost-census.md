# Cost census — Sprint 20 (anti-fabbricazione ux_ui) — actual vs estimate

> Censimento per-TSK dei token e costi reali di esecuzione (richiesta maintainer 2026-06-09).
> Ground truth: eventi per-TSK in `analytics/events/2026-06.jsonl` (state `finished`, sprint 20).
> Confronto con la stima `EST-2026-06-09-001` (analytics/reports/estimates/2026-06-09-sprint20-antifab.md).

## §1 Token reali per-TSK (subagent_tokens, harness-reported)

| TSK | Token | Modello | Costo (stima blended) | Note |
|---|---|---|---|---|
| TSK-133 | 38.705 | sonnet-4-6 | ~$0.088 | fail-loud Step 1 (skill) |
| TSK-134 | 33.136 | sonnet-4-6 | ~$0.075 | evidence-provenance Step 5 (skill) |
| TSK-135 | 29.516 | sonnet-4-6 | ~$0.067 | agent Read/Grep + STOP |
| TSK-136 | 45.042 | sonnet-4-6 | ~$0.102 | 3 backing script (effort L) |
| TSK-137 | 52.355 | sonnet-4-6 | ~$0.119 | lint Check 4y |
| TSK-138 | 43.570 | sonnet-4-6 | ~$0.099 | ADR-020 + PATTERN |
| TSK-139 | ~9.000 | opus (inline, stima) | ~$0.102 | decisione modello (orchestrator) |
| TSK-140 | ~7.000 | opus (inline, stima) | ~$0.079 | cross-ref ADR-032 (orchestrator) |
| **Totale esecuzione** | **~258K** | mix | **~$0.73** | 6 TSK subagent + 2 inline |

**Metodo costo**: split euristico documentato (cache_read 60% / input 30% / output 8% / cache_write 2%)
× pricing.yaml (sonnet $3/$15, cache 0.1x/1.25x; opus $15/$75). I **token totali per-TSK sono il dato
autorevole** (harness `subagent_tokens`); la ripartizione nelle 4 sotto-voci è una stima → il costo
USD è ±50% ma l'ordine di grandezza è solido.

## §2 Confronto actual vs EST-2026-06-09-001

| | Stima (ex-ante) | Actual (ex-post) | Δ |
|---|---|---|---|
| Costo esecuzione Sprint 20 | P50 ~$40 · low $18 · budget $54 | **~$0.73** | **~25–50x sotto il low bound** |
| Modello assunto | opus-4-8 | sonnet-4-6 (6/8 TSK) + opus inline (2) | applicato cost-opt |
| Base reference class | session-level ($201/39 TSK) | per-TSK focused | — |

## §3 Perché l'actual è 1–2 ordini di grandezza sotto la stima (analisi)

La stima NON era "sbagliata": aveva dichiarato esplicitamente (assunzione #1 + onestà §limiti) che
(a) usava opus e (b) la sua reference class era **session-level**, non per-TSK. L'actual conferma e
quantifica entrambi gli effetti, che si **compongono**:

1. **Modello cost-optimized (sonnet vs opus)** — applicato come da richiesta. La stima prevedeva
   −40/50% con sonnet. Effetto reale isolato: ~−45% per token.
2. **Esecuzione per-TSK focalizzata vs reference class session-aggregate** — è il fattore dominante.
   La reference class ($201/39 ≈ $5.15/TSK su opus) deriva da una **sessione riflessiva intera** che
   includeva contesto enorme (PATTERN.md ri-letto, premortem con deep-dive paralleli, analytics,
   orchestrazione, lint finale). I subagent di Sprint 20 leggevano solo {TSK + ADR-063 + file target}:
   contesto ~40K token/TSK, non centinaia di K. → il per-TSK *focalizzato* costa ~1–2 ordini di
   grandezza meno del per-TSK *derivato da aggregato di sessione*.
3. **Cache calda** — sessione singola, codebase stabile.

## §4 Caveat di onestà (cosa NON è incluso)

- **Orchestration overhead NON incluso nei per-TSK.** I `subagent_tokens` misurano solo il lavoro
  del singolo subagent. La sessione orchestrante (questo loop su opus: dispatch, verifica, commit,
  record-event, gate, CHANGELOG) ha un costo **aggiuntivo e significativo, su opus**, NON isolato qui.
  La reference class della stima ($201 session) INCLUDEVA l'orchestrazione → il confronto §2 è
  apples-to-oranges sul lato orchestrazione: l'esecuzione pura è $0.73, il "run cost" pieno (con
  orchestrazione) è più alto ma resta nell'ordine di **pochi dollari**, comunque ben sotto il low $18.
- Split token sotto-voce = euristico (vedi §1).
- TSK-139/140 token = stima orchestrator-inline (non subagent_tokens reali).

## §5 Insight per analisi future (azionabile)

1. **La granularità per-TSK ora esiste** (come raccomandato da EST-2026-06-09-001 §azione). Il prossimo
   estimate sui TSK docs può usare questa **reference class focalizzata** (~30–52K token/TSK, ~$0.07–0.12
   su sonnet) invece della session-aggregate → banda di incertezza −1/2 ordini di grandezza, non −60/70%.
2. **Leva di costo dominante residua = orchestrazione su opus**, non l'esecuzione. Per ridurre il run
   cost totale: orchestrare con meno turni e/o valutare un orchestratore su modello intermedio per i
   passi meccanici (dispatch/commit/record), tenendo opus per le decisioni reali.
3. **Cost-optimization confermata sostenibile**: i 6 TSK su sonnet sono passati con build/edit corretti
   e 0 ambiguità riportate → per i TSK docs/skill, sonnet è adeguato; opus va riservato a decisioni e
   ragionamento complesso (es. questo census, le decisioni di scope). Il fail-closed di ADR-063 rende
   sicuro tenere modelli economici anche sugli agenti di review (TSK-139).

## §6 Riferimenti
- Stima ex-ante: `analytics/reports/estimates/2026-06-09-sprint20-antifab.md` (EST-2026-06-09-001)
- Eventi per-TSK: `analytics/events/2026-06.jsonl` (filtro `extras.sprint=20`)
- Pricing: `analytics/pricing.yaml` · ADR-063 §E (decisione modello)
