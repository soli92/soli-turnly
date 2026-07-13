# Stima Sprint 31 — Semantic Drift Detection (EP-031)

**estimate_id**: EST-2026-06-25-001
**generated_at**: 2026-06-25
**generated_by**: estimation-analyst
**schema**: ADR-024-E

---

## Scope

| Campo | Valore |
|---|---|
| Sprint | 31 |
| Epica | EP-031 Semantic Drift Detection (Research) |
| US | US-107, US-108, US-109 |
| TSK | TSK-206..TSK-209 (4 TSK seriali) |
| Layer | docs |
| Routing | docs → agent (docs-dev riflessivo) |
| DAG | seriale: TSK-206 → TSK-207 → TSK-208 → TSK-209 |

---

## Risultato — Intervalli (STIMA, NON COMMITMENT)

### Wallclock (dal lancio del docs-dev al commit)

| Percentile | Minuti | Note |
|---|---|---|
| P25 | ~52 min | |
| **P50** | **63 min** | Stima centrale PERT |
| P75 | ~70 min | |
| **P85** | **77 min** | Soglia pianificazione prudente |
| P95 | 85 min | Coda lunga (PERT gaussiana) |
| Budget prudente (P85 + 30% contingency) | **~100 min** | Ceiling per scheduling |

Cross-check RCF (N=8 sprint storici, aggiustato per TSK extra): P50=57 min, P75=65 min.
Convergenza PERT/RCF nella banda 57-65 min. PERT primario (low confidence, ADR-025 §C).

### Effort umano (supervisione operatore)

| Percentile | Minuti |
|---|---|
| P50 | 20 min |
| P85 | 30 min |

Breakdown: kickoff 5 min + monitoraggio 4 wave x 2 min + review finale 7 min + margine P85 10 min.
**Nessun gate umano attivo** (tutte le wave = 1 TSK, mai >= parallel_gate_threshold: 3).

---

## Metodo e Reference Class

**Metodo primario**: PERT three-point a livello sprint + corroborazione per-TSK.
**Cross-check**: RCF su N=8 sprint storici omogenei (tutti docs + agent, stesso factory).

| Parametro PERT Sprint | Valore |
|---|---|
| O (ottimistico) | 40 min |
| M (più probabile) | 55 min |
| P (pessimistico) | 120 min |
| E = P50 | 63 min |
| sigma | 13 min |

**O = 40 min**: 4 TSK seriali con DoD chiaro; TSK-206/209 (S) meccanici; TSK-208/209 sono file nuovi (veloci).
**M = 55 min**: mediana reference class (47 min) + 10 min per TSK extra + small research premium su TSK-208.
**P = 120 min**: analogo Sprint 28 (117 min con agent wait) + extra TSK + ambiguità definitoria TSK-208 (EP confidence 38%).

### Reference Class Sufficiency (ADR-025)

| Campo | Valore |
|---|---|
| N | 8 sprint |
| Bucket (N) | low (1 ≤ 8 < 10) |
| Similarity | high (stesso factory, agent, layer, routing) |
| Downgrade | nessuno (similarity=high, factor=1.0) |
| **Confidence finale** | **LOW** |
| Contingency | 30% (range ADR-025 §C low: 25-35%) |

**Note sui dati**: Sprint 28 (117 min, wait LLM) e Sprint 30 (8 min, sprint tutto-file-nuovi)
inclusi come anchor di coda superiore/inferiore, non esclusi. Sprint 29 (38 min, parallelizzato
con Sprint 27) incluso con similarità ridotta.

### PERT per-TSK (sommario)

| TSK | Size | O (min) | M (min) | P (min) | E (min) | sigma |
|---|---|---|---|---|---|---|
| TSK-206 | S | 8 | 12 | 22 | 13 | 2.3 |
| TSK-207 | M | 10 | 16 | 32 | 17.7 | 3.7 |
| TSK-208 | M | 12 | 18 | 45 | 21.2 | 5.5 |
| TSK-209 | S | 5 | 9 | 21 | 10.3 | 2.7 |
| **Totale** | | **35** | **55** | **120** | **62.2** | **7.5** |

Somma per-TSK (62 min) corrobora sprint-level PERT (63 min) — scarto < 2%.

---

## Split Agentico / Umano

| | % |
|---|---|
| Agentico (docs-dev) | 96% |
| Umano (supervisione) | 4% |

4 TSK tutti consumer:agent. Nessun TSK human-residuo. L'operatore supervisiona, non esegue.

---

## Assunzioni

1. **Modello**: docs-dev usa il modello corrente della factory (factory.config.yaml `default_model: current`). Cambio modello → M ±15-20%.
2. **DAG seriale**: catena TSK-206→207→208→209 non parallelizzabile (single-writer lint-checks.md). Wallclock = somma sequenziale.
3. **Scope TSK-208**: la skill `semantic-drift-scan-protocol.md` definisce la PROCEDURA futura, non implementa l'embedding. Nessuna chiamata API esterna durante il sprint.
4. **Scope TSK-209**: ADR-EP031-001 è un template con sezioni PLACEHOLDER. La decisione go/no-go è esplicitamente deferred (EP confidence 38%). Non richiede dati empirici da riempire.
5. **Nessuna API esterna**: nessuna chiamata Figma, GitHub publisher, Playwright, embedding durante l'esecuzione. Solo tool Read/Edit/Write/Bash (file ops).
6. **1 pass lint per TSK**: se Check 4af (TSK-207) triggerasse WARNING su check esistenti, +10 min (parzialmente catturato in P).
7. **compression.output.enabled=false**: nessuna compressione caveman attiva; docs-dev riceve contesto completo.
8. **analytics.measurement.enabled=true, dogfooding.enabled=true**: gli eventi di costo vengono registrati durante l'esecuzione. N reference class crescerà verso la soglia medium (10) dopo Sprint 31.

---

## Fattori di Rischio (sensitivity_drivers)

### R1 — TSK-208 skill definition ambiguity (PRINCIPALE)
**Impatto**: +30 min se worst-case (P=45 min per TSK-208 vs E=21 min)

TSK-208 è il task più aperto. La skill `semantic-drift-scan-protocol.md` non ha un template
da copiare; deve definire 5 step per una capability sperimentale (EP confidence 38%). Se il
docs-dev incontra ambiguità strutturale nel definire gli step della skill, il TSK può richiedere
più iterazioni.

**Mitigazione**: il DoD deve essere preciso sulla struttura OUTPUT (pattern file simile a skill esistenti
in `.claude/skills/`). L'ambiguità nelle sezioni PLACEHOLDER è accettabile — è il design intent.
Se emerge un'ambiguità architettonica irrisolvibile, aprire una Question e procedere con un skill stub
semplificato mantenendo il wallclock entro P85.

### R2 — Effetto cascata DAG seriale
**Impatto**: ogni TSK ritardato ritarda tutti i successori. Sigma aggregato = 7.5 min (per-TSK) → 13 min (sprint-level PERT).

Strutturale: non mitigabile senza modificare il DAG (impossibile per single-writer constraint).
Pianificare un buffer di 100 min (P85 + 30% contingency).

### R3 — Outlier Sprint 28 (117 min) come scenario sistemico
**Impatto**: se la latenza agent-wait è sistemica (non incidentale), P50 reale potrebbe essere 60-80 min
e P85 avvicinarsi a 100 min.

**Mitigazione**: eseguire Sprint 31 in sessione con cache calda, preferibilmente in finestra oraria
a basso carico LLM.

### R4 — EP confidence 38%: possibile abort/escalate
**Impatto**: non incluso nel wallclock (scenario ABORT, non lentezza).

Se TSK-208 rivela un'ambiguità architettonica non risolvibile dall'agente, il docs-dev deve aprire
una Question e attendere risposta umana. Questo scenario **non è un ritardo** — è un gate umano
non pianificato. Il wallclock di questo scenario è fuori dall'intervallo stimato.

---

## Raccomandazione operativa

**Quando eseguire**: nessun prerequisito bloccante. Sprint 31 è sbloccato (EP-029 done, Sprint 27 rimuove
la dipendenza soft sulla serie Check 4a*).

**Timing consigliato**: sessione mattutina con cache calda (massimizza cache_read, minimizza latenza LLM).
Evitare esecuzione in parallelo con altri sprint / run pesanti sulla stessa factory.

**Finestra da bloccare**: 100 minuti (P85 + 30% contingency = 77 * 1.30 ≈ 100 min). Aggiungere
30 minuti di buffer per la supervisione umana → finestra totale 2h10 min.

**Gate umani attivi**: nessuno (tutte le wave hanno 1 TSK, mai >= parallel_gate_threshold: 3).
L'operatore può avviare il docs-dev e monitorare passivamente.

**Dopo Sprint 31**: registrare il wallclock effettivo per-TSK in `analytics/events/`. Con N=9 sprint
il bucket rimane low; al decimo sprint (N=10) si sblocca il bucket medium, riducendo la banda di
incertezza stimata del 30-40% per Sprint 32.

---

## Qualità Reference Class

| Campo | Valore |
|---|---|
| N | 8 sprint storici |
| Periodo | Sprint 23..30 |
| Similarity | high |
| Confidence | **LOW** |
| Mode | PERT bottom-up primary + RCF cross-check |
| Warning | N=8 < soglia medium (10). Contingency 30% obbligatoria. Due outlier inclusi (Sprint 28: 117 min; Sprint 30: 8 min). |

**Bias di ottimismo (Kahneman/Flyvbjerg)**: parzialmente mitigato dall'anchor empirico (8 sprint reali
vs PERT puro). Non eliminato: il planning fallacy tende a comprimere i tempi percepiti per sprint "semplici".
Il M=55 min già incorpora un research premium; non abbassarlo senza evidenza empirica.

---

*STIMA, NON COMMITMENT. P50=63 min e P85=77 min non sono deadline.
Una stima è una distribuzione, non un impegno contrattuale (EP-010 invariante).*
