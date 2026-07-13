# Stima EP-011 — Temporal Awareness Layer (2026-06-04)

> estimate_id: **EST-2026-06-04-001**
> Sub-blocco `estimate` ADR-024 §E. Generato da `estimation-analyst` (EP-010 US-043) via `/estimate --from-kanban=EP-011`.
> Immutabile (ADR-027 §A). Stima, NON commitment (concept §Limiti).

## Riepilogo

| Campo | Valore |
|---|---|
| Metodo | PERT three-point (PERT-only, confidence very_low) |
| Confidence | very_low (N=0, nessun storico, similarity=low) |
| Durata P50 | 13.74 person-days |
| Durata P85 | 15.54 person-days |
| Durata P95 | 16.59 person-days |
| Costo P50 | 9.893 EUR (fully-loaded) |
| Costo P85 | 11.189 EUR (fully-loaded) |
| Contingency | 35% separata dal P50 |
| Budget prudente (P85 + contingency) | 15.105 EUR |
| Split umano/agentico | 100% umano / 0% agentico |

> MAI un numero puntuale. La stima è una distribuzione: P50 = 50% prob completare entro 13.74 pd, P85 = 85% prob entro 15.54 pd. Il bias di ottimismo (Kahneman/Flyvbjerg) non è mitigato con N=0: calibrare contingency al rialzo se le ADR di Arch espandono lo scope di US-047.

## Decomposizione PERT per storia

| Storia | O | M | P | Expected | Std | % varianza totale |
|---|---|---|---|---|---|---|
| US-045 Temporal Context Injection | 0.5 | 1.0 | 2.0 | 1.08 pd | 0.25 pd | 2% |
| US-046 Temporal Handoff Protocol | 1.5 | 3.0 | 5.0 | 3.08 pd | 0.58 pd | 11% |
| US-047 Temporal State Machine TSK-XL | 3.0 | 6.0 | 12.0 | 6.50 pd | 1.50 pd | **87%** |
| US-048 Config Pattern Integration Scheduler | 1.5 | 3.0 | 5.0 | 3.08 pd | 0.58 pd | 11% |
| **Totale** | **6.5** | **13.0** | **24.0** | **13.74 pd** | **1.73 pd** | 100% |

Formula PERT: attesa = (O + 4M + P)/6 · varianza = ((P-O)/6)^2 · std_totale = sqrt(sum varianze)

## Reference class quality

- **N = 0** — nessun evento nell'event store (`analytics/events/` assente). Stima PERT-only su elicitation PM.
- **confidence: very_low** — bucket N=0 + similarity=low → downgrade a very_low (ADR-025 §A-B).
- **mode: PERT-only** — nessuna outside view disponibile (Kahneman/Flyvbjerg: il bias di ottimismo NON è mitigato).
- Warning verbatim (ADR-025 §D): _"Nessun dato storico disponibile: reference class vuota. Stima basata solo su elicitation. Bias di ottimismo non mitigato. Calibrare contingency al rialzo (>=30%)."_

## Contingency

- **35%** dichiarato separatamente dal P50 (ADR-024 §G).
- Enforce very_low: >=30% obbligatorio (ADR-025 §D). Alzato a 35% per i 7 ADR di Arch aperti.
- Budget prudente pianificazione sprint: P85 (11.189 EUR) + 35% contingency = **15.105 EUR**.
- La contingency NON è inclusa nel P50/P85 pubblicati: è un buffer separato per il TPM.

## Sensitivity drivers (priorità decrescente)

1. **us047_adr_coupling** — impatto P85 +45% (diretto): l'ADR su coupling EP-009 events è il driver principale. Se US-047 sceglie event-derived view, P tende a 12 pd; se standalone semplice, P rimane 5-6 pd.
2. **scope_completeness** — impatto P85 +50% (inverso): i 7 ADR aperti possono espandere lo scope. Priorità: risolverli prima del Develop.
3. **team_familiarity** — impatto P85 +40% (inverso): ramp-up su parallel-scheduler + dev-handoff/vcs-handoff stimato +20-30% su O/M per US-046/US-048.
4. **reference_class_N** — impatto P85 +30% (inverso): N=0 oggi. Con N>=10 EP simili la confidence salirebbe a medium e il P85 sarebbe calibrato su dati reali.
5. **scope_count** — impatto P85 +25% (diretto): 4 US in scope. Ogni US aggiuntiva da ADR scala P85 linearmente.

## Assumptions

- Combinazione P50/P85/P95 = massimo conservativo tra i metodi applicabili (PERT); mai una media (regola anti-bias di ottimismo, ADR-025 §C).
- Mode primario: PERT (sorgente: aggregato worst-case, confidence very_low enforced da ADR-025 §C/§D).
- Reference class aggregata: N=0 campioni, similarity=low, confidence=very_low.
- Durata in person-days (effort, non calendar time). La conversione effort→calendario dipende dalla capacità team.
- Costo derivato: senior-engineer fully-loaded 90 EUR/h (rates.yaml valid_from 2026-04-01), 8h/giorno. EP-011 = sviluppo framework puro, actor_type: human, nessun costo agentico LLM in produzione.
- Confidence very_low → method forzato a PERT (ADR-025 §C/§D enforce).
- US-047 domina la varianza (87%): scomposizione in 2 TSK raccomandata dal PM se P/O > 3 (ratio 12/3 = 4 > 3).
- Nessuna dipendenza hard da EP precedenti: EP-011 è opt-in standalone.
- 7 ADR candidati aperti prima del Develop: risolverli riduce l'incertezza prima della pianificazione sprint.
- Similarity=low: nessuno storico reference class per EP di tipo temporal/framework nel progetto corrente.

## Note operative

- **STIMA, NON COMMITMENT.** P50 ≠ deadline. P85 = soglia per pianificazione prudente.
- **Ricalibrazione raccomandata** dopo i 7 ADR di Fase 1 (Arch): rieseguire `/estimate --from-kanban=EP-011` con O/M/P aggiornati dal TPM. Il nuovo estimate_id indicherà `previous_estimate_id: EST-2026-06-04-001`.
- **Monte Carlo non applicabile**: nessun throughput storico (N=0, < 8 settimane dati EP-009). Diventa applicabile dopo 8+ settimane di eventi `analytics/events/`.
- **ADR prioritario**: US-047 coupling EP-009 (event-derived view vs standalone). Ha il maggior impatto sul range P50-P95.

## Warnings

- Confidence very_low: stima fragile. method=PERT forzato, contingency >=30 enforced. Bias di ottimismo non mitigato (Kahneman/Flyvbjerg). Vedi ADR-025 §C/§D.
- Nessun dato storico disponibile (EP-009 event store assente): stima PERT-only basata su elicitation PM. Calibrare contingency al rialzo.
- 7 ADR di Arch aperti prima del Develop: le decisioni su storage state file + coupling EP-009 + policy attivazione State Machine impattano il range P50-P95 di US-047 (87% varianza). Risolverli prima della pianificazione sprint.
