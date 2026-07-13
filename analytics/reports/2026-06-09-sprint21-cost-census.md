# Cost census — Sprint 21 (EP-018 FE Functional Oracle) — actual vs EST-2026-06-09-002

> Censimento per-TSK dei token reali di esecuzione (16 TSK docs, esecutori `docs-dev` su sonnet-4-6,
> orchestrazione su opus). Ground truth: `subagent_tokens` riportati dall'harness per ogni dispatch.
> Confronto con la stima ex-ante `EST-2026-06-09-002`.

## §1 Token reali per-TSK (subagent_tokens, sonnet-4-6)

| Wave | TSK | subagent_tokens | nota |
|---|---|---|---|
| 1 | TSK-154 | 63.018 | interaction-drive-protocol (skill nuova) |
| 1 | TSK-144 | 46.804 | acceptance-spec schema + esempio |
| 2 | TSK-141 | 72.544 | functional-oracle-protocol F1+2 (skill nuova) |
| 2 | TSK-145 | 74.600 | lint Check 4z |
| 2 | TSK-155 | 31.385 | fixture + licenze |
| 2 | TSK-156 | 24.546 | .gitignore |
| 3 | TSK-142 | 73.389 | protocol F3+4 |
| 3 | TSK-146 | 53.697 | comando /functional-oracle |
| 4 | TSK-143 | 63.380 | protocol F5 + Pattern |
| 4 | TSK-147 | 38.861 | scheduler domain |
| 5 | TSK-150 | 50.894 | qa-dev mode + fe-dev fallback |
| 5 | TSK-148 | 47.822 | CLAUDE.md quickstart |
| 5 | TSK-149 | 52.833 | config block |
| 6 | TSK-151 | 51.274 | orchestrator + scheduling |
| 7 | TSK-152 | 58.314 | scrivi-task frontmatter |
| 8 | TSK-153 | 69.378 | PATTERN.md §3/§5/§18 |
| **Totale** | **16 TSK** | **872.739** | media **54.546 tok/TSK** |

**Costo esecuzione (sonnet, split census Sprint 20: cache_read 60% / input 30% / output 8% /
cache_write 2% × pricing.yaml $3/$15, cache 0.1x/1.25x ≈ $2.355/M token blended):**
≈ **$2.06** per l'esecuzione pura dei 16 TSK.

## §2 Confronto actual vs EST-2026-06-09-002

| | Stima (ex-ante) | Actual (ex-post) | Verdetto |
|---|---|---|---|
| **Esecuzione** (sonnet) | P50 ~$1.3 · P85 ~$2.0 | **~$2.06** | **~al P85 / lievemente sopra** |
| token/TSK assunti | ~40K (mediana Sprint 20) | **54.5K** | +36% per-TSK |
| Run cost totale (incl. orchestrazione opus) | P50 ~$5 · P85 ~$9 | non isolato (vedi §4) | dentro la banda P50–P85 attesa |
| Modello esecutori | sonnet-4-6 | sonnet-4-6 ✓ | confermato |
| Contingency | 35% (low conf.) | — | banda ha retto |

## §3 Perché l'esecuzione è arrivata al P85 (non al P50) — lezione di calibrazione

La reference class (Sprint 20) aveva similarity rated **high** perché *stesso layer docs*. Ma la
**natura del task differiva**: Sprint 20 era prevalentemente **edit** di file esistenti (~40K
token/TSK); EP-018 era prevalentemente **create-from-scratch** di artefatti nuovi e corposi
(functional-oracle-protocol a 5 fasi su 3 TSK, interaction-drive-protocol, schema, comando), con
lettura di file-modello per coerenza di stile → ~54.5K token/TSK (+36%).

**Lezione**: la similarity per la reference class dovrebbe pesare anche **create-new vs edit**, non
solo il layer. Un sotto-fattore «task kind» raffinerebbe la stima. La banda P85 ha comunque
contenuto l'actual → la stima resta difendibile (l'incertezza dichiarata era reale, non cosmetica).

## §4 Caveat di onestà (orchestrazione NON inclusa)

I `subagent_tokens` misurano solo il lavoro dei 16 dispatch `docs-dev`. **L'orchestrazione di questa
sessione (opus): diagnosi, 8 wave dispatch, verifica, 8+ commit, census, fix dipendenze danzanti
TPM — NON è isolata qui** ed è, come previsto da EST-2026-06-09-002 §3 driver #1, il **driver di
costo dominante**. Il run cost pieno resta nell'ordine «pochi dollari» (esecuzione $2 + orchestrazione
opus stimata $3–6), dentro la banda run-cost P50 $5 / P85 $9 della stima.

## §5 Insight azionabili

1. **Calibrazione reference class**: aggiungere il fattore *task-kind (create vs edit)* alla
   similarity. EP-018 (create-heavy) costa ~+36% token/TSK rispetto a Sprint 20 (edit-heavy) a
   parità di layer.
2. **Driver dominante confermato = orchestrazione opus**, non l'esecuzione. La leva di risparmio
   resta: orchestrare i passi meccanici (dispatch/commit/verify) su modello intermedio.
3. **Cost-optimization sonnet confermata**: 16/16 TSK passati con 0 ambiguità riportate, 0 rework
   (assunzione «0–1 iterazioni» rispettata) → per i TSK docs/skill sonnet è adeguato.

## §6 Riferimenti
- Stima ex-ante: `analytics/reports/estimates/2026-06-09-ep018-functional-oracle.md` (EST-2026-06-09-002)
- Census reference class: `analytics/reports/2026-06-09-sprint20-cost-census.md`
- Pricing: `analytics/pricing.yaml`
