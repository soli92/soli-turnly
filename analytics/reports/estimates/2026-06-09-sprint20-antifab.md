---
estimate_id: EST-2026-06-09-001
type: project_estimate
schema_version: ADR-024-E
generated_at: "2026-06-09T00:00:00Z"
generated_by: estimation-analyst
scope_project_id: sprint20-antifab
method: RCF+PERT hybrid
confidence: medium
reference_class_N: 3
contingency_pct: 20
---

# Stima Sprint 20 — Anti-fabbricazione UX/UI (ADR-063)

> estimate_id: **EST-2026-06-09-001**
> Sub-blocco `estimate` ADR-024 §E. Generato da `estimation-analyst` (EP-010 US-043).
> Immutabile (ADR-027 §A). Stima, NON commitment (concept §Limiti).

---

## Nota onesta sulla reference class

> **N=3 sessioni** (soli-factory 2026-06-04..2026-06-08). Primo estimate con dati reali
> (cfr EST-2026-06-08-001 dove N=0 era il finding principale del dogfooding T4).
> I 3 data point sono **aggregati di sessione**, non per-TSK granulari: dividere $201/39 TSK
> introduce un undercount sistematico (overhead orchestrazione, lint, premortem diluit nel divisore).
> Corretto con aggiustamento 70% pure-dev. Banda dichiarata larga: **$18-$45 P50**.
> Bias di ottimismo parzialmente mitigato ma non eliminato con N=3.

---

## Riepilogo

| Campo | Valore |
|---|---|
| Scope | 8 TSK (TSK-133..TSK-140), layer docs, sprint 20 |
| Metodo | RCF+PERT ibrido (M values ancorati a reference class, O/P elicitation) |
| Modello agentico | claude-opus-4-8 |
| Confidence | **medium** (N=3, similarity=high, +1 upgrade ADR-025 §C) |
| Agentico P50 | **$40 USD** |
| Agentico P85 | **$45 USD** |
| Banda wide (low/likely/high) | **$18 / $29 / $45 USD** |
| Contingency | **20%** separata dal P85 |
| Budget prudente (P85+20%) | **$54 USD** |
| Umano P50 | **135 EUR** (1.5h senior-engineer, gate/decisioni) |
| Split agentico/umano | 97% / 3% |

> MAI un numero puntuale. La stima e' una distribuzione: P50 = probabilita' 50% di completare
> entro $40; P85 = 85% entro $45. La banda $18-$45 riflette l'incertezza del dato di riferimento
> (granularita' session-level, non per-TSK). Non usare P50 come forecast finanziario rigido.

---

## Decomposizione per TSK

| TSK | Size | Prio | O ($) | M ($) | P ($) | E P50 ($) | sigma ($) |
|---|---|---|---|---|---|---|---|
| TSK-133 | S | P0 | 2.53 | 3.97 | 7.22 | **4.27** | 0.78 |
| TSK-134 | M | P1 | 3.97 | 6.49 | 14.43 | **7.40** | 1.74 |
| TSK-135 | XS | P0 | 1.44 | 2.53 | 4.69 | **2.71** | 0.54 |
| TSK-136 | L | P1 | 5.41 | 12.63 | 28.86 | **14.13** | 3.91 |
| TSK-137 | S | P2 | 2.53 | 3.97 | 9.02 | **4.57** | 1.08 |
| TSK-138 | XS | P2 | 1.44 | 2.53 | 5.41 | **2.83** | 0.66 |
| TSK-139 | XS | P3 | 1.08 | 2.16 | 4.33 | **2.34** | 0.54 |
| TSK-140 | XS | P3 | 1.08 | 1.80 | 3.61 | **1.98** | 0.42 |
| **TOTALE** | | | **19.48** | **36.08** | **77.57** | **$40.23** | **4.62** |

Formula PERT: E=(O+4M+P)/6, var=((P-O)/6)^2, additività varianze.
P85 = E + 1.036*sigma = **$45.01**.
P95 = E + 1.645*sigma = **$47.82** (indicativo).

> **TSK-136 L domina**: E=$14.13 (35% del P50 sprint), sigma=$3.91 (55% della varianza totale).
> Il range del solo TSK-136 ($5.41-$28.86) e' quasi pari al costo combinato degli altri 7 TSK.
> Gestire TSK-136 come task ad alto rischio individuale.

---

## Cross-check: raw-session-scale

Ancora alternativa: $2.20/TSK (sessione 2026-06-08 raw, $85.95/39 TSK) * 8.0 weight units = **$17.63 P50**.

I due ancore definiscono il range low/likely/high:
- **Low** ($18): raw session scale, stessa cache behavior, no overhead adj
- **Likely** ($29): midpoint dei due ancore
- **High** ($45): PERT P85 con overhead adjustment

La banda $18-$45 e' la dichiarazione onesta dell'incertezza con N=3 session-level.

---

## Contingency

| Campo | Valore |
|---|---|
| Contingency | **20%** |
| Rationale | N=3 (low bucket, +1 upgrade medium): ADR-025 §C medium -> 15-25%. Ridotto da 35% (EST-2026-06-08-001, N=0) perche' dati reali ora disponibili. 20% per: (1) N=3 e' il limite inferiore del medium; (2) TSK-136 L ha varianza alta; (3) session-level reference introduce errore sistematico. |
| Budget prudente | $45.01 * 1.20 = **$54.01 USD** |

---

## Split agentico / umano

| Componente | Quota | Costo |
|---|---|---|
| Agentico (8 TSK docs-dev) | 97% | P50=$40.23 / P85=$45.01 USD |
| Umano (gate/decisioni) | 3% | P50=135 EUR / P85=180 EUR |

Dettaglio umano:
- TSK-139 model evaluation (genuinamente non delegabile): 0.5h = 45 EUR
- TSK-138 ADR-020 amendment review gate: 0.25h = 23 EUR
- Sprint oversight (wave approvals, parallel_gate_threshold): 0.75h = 67 EUR
- **Totale: 1.5h @ 90 EUR/h (fully-loaded) = 135 EUR**

Rate da `analytics/rates.yaml`: senior-engineer, fully-loaded, valid_from 2026-04-01.

---

## Assunzioni principali

1. **Modello: claude-opus-4-8** — stesso modello dei run di riferimento (pricing.yaml: $5/$25/$0.5/$6.25 per 1M token input/output/cache_read/cache_write).
2. **Cache hit ratio ~65-70%** — osservato nelle sessioni di riferimento (sessione 2026-06-08: cache_read=101M vs input=130K). Sprint 20 opera sullo stesso codebase: comportamento analogo atteso se eseguito in una singola sessione.
3. **TSK-136 L: scope script thin** — i 3 script sono wrapper con `set -euo pipefail` + dependency check + minimal logic. `capture_screenshot.sh` puo' essere un thin wrapper Playwright che fallisce loud se non disponibile (non richiede Playwright funzionante per il DoD). Questa assunzione riduce P verso M; se invece viene richiesta un'implementazione Playwright end-to-end, P sale a $28.86.
4. **Nessuna iterazione CQRL** — docs-dev riflessivo fa self-lint inline. Se lint finale genera ERROR su TSK-133/134/135 (cross-reference check), aggiungere 10-15% overhead per re-run.
5. **TSK-139 opzionale (P3)** — inclusa nell'estimate. Se saltata: P50 scende a ~$37.89 (-$2.34).

---

## Driver di sensibilita'

| Rank | Driver | Impatto |
|---|---|---|
| 1 | TSK-136 L Playwright scripting | +$14.73 vs P50 (worst-case P=$28.86 vs E=$14.13); 55% varianza sprint |
| 2 | Reference class granularity (session vs per-TSK) | ±$22 banda ($18-$40 P50) — fonte di incertezza dominante |
| 3 | Cache hit ratio | -30% a -50% sul costo agentico se cache rimane calda (comportamento osservato) |

---

## Reference Class Quality

| Campo | Valore |
|---|---|
| N | 3 sessioni (soli-factory 2026-06-04..2026-06-08) |
| Period | 2026-06-04 to 2026-06-08 |
| Similarity | high (stesso factory, stesso agent-type docs-dev, stesso code_path '.', stesso layer docs) |
| Confidence | **medium** (N=3->low, +1 high-similarity upgrade) |
| Mode | RCF+PERT |
| Warning | N=3 e' al limite inferiore del medium. Dati session-level, non per-TSK. La banda wide $18-$45 e' la dichiarazione onesta del limite. |

---

## Note

- STIMA, NON COMMITMENT. P50=$40.23 non e' una deadline. P85=$45.01 e' la soglia per pianificazione prudente.
- Primo estimate con dati reali post-EP-013 (N>0). Bias strutturale T4 GIGO risolto per questo sprint.
- Monte Carlo non applicabile: N=3 sessioni, no per-TSK granular throughput. Applicabile dopo 8+ settimane di eventi granulari.
- Raccomandazione: registrare eventi per-TSK in `analytics/events/` dopo Sprint 20. Riduce la banda di incertezza del 60-70% per Sprint 21.
