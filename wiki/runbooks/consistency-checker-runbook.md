---
id: consistency-checker-runbook
title: "Runbook: Consistency Checker — Attivazione operativa"
created: 2026-06-15
updated: 2026-06-15
status: active
capability: EP-015
pattern_ref: "PATTERN §20.4 R.C7"
adr: [ADR-048, ADR-047, ADR-049, ADR-050, ADR-051]
related_us: [US-083]
opt_in: compression.output.consistency_check.enabled
depends_on_runbook: wiki/runbooks/decision-anchor-runbook.md
---

# Runbook: Consistency Checker

> Playbook operativo del `consistency_checker`: agente terzo read-only, single-purpose,
> invocato secondo trigger configurabile (`per_handoff` | `per_review_iter` | `per_wave_close`)
> per rilevare contraddizioni esplicite tra il [[decision-anchor]] e l'output del sub-agent.
> Pattern parallelo al `code-reviewer` CQRL (R.Q1: reviewer != dev-agent).

## 1. Scopo

Il `consistency_checker` e' un **observer esterno** che verifica se l'output di un sub-agent
contraddice le decisioni architetturali registrate nel `decision_anchor`. Il suo ruolo e'
complementare al meccanismo di propagazione del `decision_anchor` (checksum + sezione textuale):
mentre l'anchor garantisce che le decisioni *transitino intatte* tra hop, il checker verifica
che le decisioni *vengano rispettate* nell'output prodotto.

Rischio mitigato: **T3 Context Pollution** (premortem v2.18 — «un handoff context-poisoned
e' internamente coerente, l'agente e' *confidently wrong* e non emette marker»).
[^src: wiki/concepts/consistency-checker.md §Definizione]

**Ordine di attivazione raccomandato** (US-083):

> Attivare prima `decision_anchor` (runbook: [[decision-anchor-runbook]] §12), verificare su
> almeno una wave multi-hop, poi attivare `consistency_check`. Il checker presuppone che
> l'anchor sia stabilmente propagato: verificarlo prima riduce i falsi positivi nelle prime
> iterazioni. [^src: management/kanban/EP-015-decision-preserving-compression/US-083-attivazione-decision-anchor-consistency-checker-runbook/US-083.md §Acceptance Criteria]

---

## 2. Prerequisiti

Prima di attivare `consistency_check`, verificare:

1. **`decision_anchor.enabled: true`** — il consistency checker legge l'anchor come ground
   truth delle decisioni architetturali. Senza anchor attivo, il checker non ha un riferimento
   da confrontare con l'output del sub-agent. Attivare e validare `decision_anchor` prima
   (vedi [[decision-anchor-runbook]] §12). [^src: wiki/concepts/consistency-checker.md §Definizione]

2. **`compression.output.enabled: true`** — il consistency checker e' parte del layer di
   compressione output (EP-015). Entrambi i flag (`decision_anchor.enabled` e
   `consistency_check.enabled`) sono sotto-blocchi di `compression.output:` e richiedono
   che il layer base sia attivo. [^src: factory.config.yaml §compression.output]

3. **Almeno una wave multi-hop con `decision_anchor` verificata** (raccomandato): prima di
   attivare il checker, eseguire la verifica post-attivazione dell'anchor (§12.3 del runbook
   decision-anchor-runbook.md): assenza di `[anchor-stripped]` / `[anchor-checksum-mismatch]`
   in `wiki/log.md` + campo `decision_anchor:` strutturato presente nei handoff.

4. **Telemetria EP-013 attiva** (opzionale ma raccomandato): `analytics.measurement.enabled: true`
   + `analytics.dogfooding.enabled: true` — consente il tracking degli eventi
   `consistency_decision` per audit post-attivazione (§6). [^src: factory.config.yaml §analytics.dogfooding]

---

## 3. Procedura step-by-step

**Step 1 — Verificare i prerequisiti** (§2):

```bash
# Lint per verifica pre-attivazione
/lint
```

Assicurarsi che il lint non riporti ERROR su `compression.output.decision_anchor.enabled: false`
(se l'anchor non e' ancora attivo, attivarlo prima — vedi prerequisito 1).

**Step 2 — Aprire `factory.config.yaml`** e individuare il blocco
`compression.output.consistency_check:`.

**Step 3 — Abilitare il flag e scegliere il trigger** (§4 per la guida alla scelta):

```yaml
compression:
  output:
    enabled: true                    # prerequisito — deve essere true
    decision_anchor:
      enabled: true                  # prerequisito — deve essere true (attivare prima)
    consistency_check:
      enabled: true                  # cambia da false → true
      trigger: per_review_iter       # scelta trigger — vedi §4 per guida
      token_budget_max: 5000         # cap token per invocazione (default 5000)
      required_on_chain: false       # gate empirico — vedi §7 per dettaglio
```

**Step 4 — Salvare il file**. Non sono necessari restart o reload: il flag viene
letto alla prossima invocazione di un'operazione Develop o Handoff.

**Step 5 — Eseguire lint** per verifica di coerenza della configurazione:

```bash
/lint
```

Output atteso: 0 ERROR. I flag restano all'interno del layer opt-in (R.P3); il lint
verifica la coerenza strutturale del `factory.config.yaml` senza side-effect sui
processi in corso.

---

## 4. I tre valori del trigger

Il trigger controlla **quando** il checker viene invocato durante il workflow:
[^src: wiki/concepts/consistency-checker.md §Trigger configurabile] [^src: design_&_architecture/decisions/ADR-048.md §C]

### `per_handoff`

Invoca il checker a **ogni handoff inter-agent** nella chain.

- **Overhead**: alto (una invocazione per ogni hop).
- **Quando scegliere**: factory critiche dove la probabilita' di context-poisoning e'
  alta — ad esempio chain multi-hop con modelli diversi, factory con `policy_profile:
  aggressive`, o factory con piu' di 5 `active_capabilities` attive contemporaneamente.
- **Vantaggio**: rileva il context-poisoning il prima possibile, prima che si propaghi a
  hop successivi.
- **Svantaggio**: costo piu' alto per ogni wave; non raccomandato per factory standard
  con budget token ridotto.

**Esempio d'uso**:

```yaml
consistency_check:
  enabled: true
  trigger: per_handoff       # factory critica con policy_profile: aggressive
  token_budget_max: 5000
```

### `per_review_iter` (default)

Invoca il checker a **ogni iterazione di review** (CQRL loop o step di verifica del
dev-agent).

- **Overhead**: medio (una invocazione per iterazione di review, non per ogni handoff).
- **Quando scegliere**: bilanciamento overhead/copertura per factory standard. Valore
  raccomandato per il primo rollout di `consistency_check` in una factory nuova.
- **Vantaggio**: coverage adeguata con costo contenuto; compatibile con factory che hanno
  gia' CQRL attivo (`code_quality.enabled: true`).
- **Svantaggio**: il context-poisoning puo' essersi propagato per N handoff prima che il
  checker lo rilevi.

**Esempio d'uso**:

```yaml
consistency_check:
  enabled: true
  trigger: per_review_iter   # default — factory standard
  token_budget_max: 5000
```

### `per_wave_close`

Invoca il checker **alla chiusura di ogni wave** (post `wave_close` del parallel scheduler).

- **Overhead**: basso (una invocazione per wave, indipendentemente dal numero di handoff
  nella wave).
- **Quando scegliere**: factory con wave frequenti (molte wave corte) dove il costo di
  `per_review_iter` diventerebbe eccessivo. Adatto a factory mature con `decision_anchor`
  gia' validato empiricamente da molte wave.
- **Vantaggio**: overhead minimo; non impatta la latenza dei singoli handoff.
- **Svantaggio**: se il context-poisoning si verifica a inizio wave, il checker lo rileva
  solo a fine wave — quando i side-effect potrebbero gia' essere stati propagati a piu'
  artefatti.

**Esempio d'uso**:

```yaml
consistency_check:
  enabled: true
  trigger: per_wave_close    # factory con wave frequenti, overhead ridotto
  token_budget_max: 5000
```

---

## 5. Verifica post-attivazione

Dopo la prima invocazione con trigger attivo, verificare:

**Check 1 — Evento `consistency_decision` con verdict `pass` nel log**:

Il log della prima invocazione deve contenere almeno un evento
`state: consistency_decision` con `verdict: pass` (o `warn` se ci sono contraddizioni
minori/maggiori rilevate). Un evento `fail` alla prima invocazione segnala una
contraddizione confermata e richiede gate umano.

```bash
# Se analytics.measurement.enabled: true
grep '"consistency_decision"' analytics/events/*.jsonl | head -5
```

Evento atteso (schema §5.1):

```json
{
  "state": "consistency_decision",
  "task_id": "<task_id>",
  "ts": "<ISO-8601>",
  "trigger": "per_review_iter",
  "verdict": "pass",
  "findings_count": 0,
  "token_used": <int>
}
```

**Check 2 — Nessun evento `fail` imprevisto**:

Un verdict `fail` alla prima attivazione potrebbe segnalare:
- Anchor mal configurato (campo `decisions[]` vuoto o checksum non valido).
- Output del sub-agent che diverge genuinamente dall'anchor — in questo caso
  il checker funziona correttamente e la divergenza va investigata.
- Falso positivo da anchor non ancora stabilizzato (ragione per cui e' raccomandato
  verificare `decision_anchor` prima di attivare il checker — §2 prerequisito 3).

**Check 3 — `token_budget_max` non violato sistematicamente**:

Verificare che il checker non superi sistematicamente il cap `token_budget_max`
(default 5000 token per invocazione). Segnale di allarme: molti eventi
`warn` con messaggio "checker budget exceeded, manual review required" nel log.

```bash
grep "checker budget exceeded" wiki/log.md
```

Se questo messaggio appare frequentemente, significa che l'anchor ha piu' decisioni
di quanto il checker riesca a elaborare nel budget. Azioni possibili:
- Alzare `token_budget_max` (es. `8000` o `10000`) — vedi §5.1 per dettaglio.
- Ridurre il numero di `decisions[]` nell'anchor (rimuovere decisioni non piu' rilevanti).
- Passare a trigger `per_wave_close` per ridurre la frequenza di invocazione.

### 5.1 Quando alzare `token_budget_max`

Il valore default `5000` e' adeguato per anchor con fino a ~10-15 decisioni e output
di medie dimensioni. Segnali che indicano di alzarlo:

- Frequenti `warn` "checker budget exceeded" (>20% delle invocazioni).
- Anchor con piu' di 15 decisioni in `decisions[]`.
- Output del sub-agent con artefatti di grandi dimensioni (es. file > 500 righe).

Valori raccomandati per scenari specifici:

| Scenario | `token_budget_max` raccomandato |
|----------|---------------------------------|
| Factory standard (<10 decisioni, artefatti medi) | 5000 (default) |
| Factory con 10-20 decisioni | 8000 |
| Factory critica con output grandi | 10000 |
| Debug post-incident | 15000 (temporaneo) |

```yaml
consistency_check:
  enabled: true
  trigger: per_review_iter
  token_budget_max: 8000     # alzato per factory con >10 decisioni nell'anchor
```

---

## 6. Semantica del verdict

Il checker produce uno di tre verdict:
[^src: wiki/concepts/consistency-checker.md §Semantica verdict]

| Verdict | Significato | Azione del workflow |
|---------|-------------|---------------------|
| `pass` | Nessuna contraddizione rilevata. | Workflow prosegue normalmente. |
| `warn` | Contraddizione possibile ma non confermata, o budget exceeded. | WARNING in log, workflow prosegue. |
| `fail` | Contraddizione confermata (finding `critical` con `confidence > 0.7`). | **Escalate gate umano fail-loud**. NO auto-rollback in v2.19. |

Un verdict `fail` richiede intervento umano per correggere l'output del sub-agent.
L'auto-rollback non e' disponibile in v2.19 (richiederebbe state machine temporale
EP-011, capability pianificata per v2.20+). [^src: design_&_architecture/decisions/ADR-048.md §G]

---

## 7. `required_on_chain: false` — quando portarlo a `true`

Il flag `required_on_chain` controlla il **Lint Check 4s**:
[^src: wiki/concepts/consistency-checker.md §Lint Check 4s]

```yaml
consistency_check:
  required_on_chain: false   # default — gate empirico opt-in
```

A `false` (default): il Lint Check 4s non e' applicato. Il checker puo' essere attivo
o disattivo senza penalita' di lint.

A `true`: il Lint Check 4s (WARNING-only) segnala se una chain con `chain_depth > 3`
non ha alcuna invocazione del checker loggata in `analytics/events`. Esenzione per-TSK
via frontmatter `consistency_check_skip_reason: "<motivo>"`.

**Quando portarlo a `true`**:
- Dopo aver validato empiricamente che il checker funziona correttamente su almeno
  5-10 wave (nessun falso positivo sistematico, budget non sistematicamente exceeded).
- Quando si vuole forzare la copertura del checker su tutte le chain profonde (es.
  policy aziendale di conformita' su factory critiche).
- Mai prima della validazione empirica: un `required_on_chain: true` prematuro con
  falsi positivi sistematici crea rumore di lint che segnala come ERROR su ogni wave.

Procedura raccomandata per la promozione a `true`:

1. Mantenere `required_on_chain: false` durante le prime wave di validazione.
2. Raccogliere eventi `consistency_decision` in `analytics/events/`.
3. Verificare che il tasso di `warn` "budget exceeded" sia < 20% delle invocazioni.
4. Verificare che nessun `fail` sistematico (stesso sub-agent, stesso anchor, stessa
   decisione) sia presente — se si, e' una contraddizione reale da risolvere prima.
5. Portare `required_on_chain: true` come upgrade successivo (TSK separato).

---

## 8. Rollback

Per disabilitare `consistency_check` dopo l'attivazione:

```yaml
compression:
  output:
    consistency_check:
      enabled: false             # rollback: torna a false
```

Il rollback e' **non distruttivo** (R.P3):
[^src: design_&_architecture/decisions/ADR-050.md] [^src: wiki/concepts/consistency-checker.md §Configurazione]

- Nessun dato viene rimosso (gli eventi `consistency_decision` gia' loggati restano
  in `analytics/events/` come storia di audit).
- Le operazioni Develop successive tornano al comportamento pre-attivazione: checker
  mai invocato, comportamento identico v2.18.
- Non e' necessaria nessuna migrazione dati.
- Se `decision_anchor.enabled: true` resta attivo: il decision anchor continua a
  funzionare normalmente (propagazione, checksum, protezione dalla compressione) —
  il rollback di `consistency_check` non impatta `decision_anchor`.
- Se si vuole disabilitare entrambi, rimettere anche `decision_anchor.enabled: false`
  (rollback completo EP-015 — vedi §12.4 di [[decision-anchor-runbook]]).

---

## 9. Cross-link

- [[decision-anchor-runbook]] §12 — prerequisito logico: attivare prima `decision_anchor`.
- [[decision-anchor]] — l'artefatto che il checker legge come ground truth.
- [[consistency-checker]] — concept dettagliato (skill, schema, tassonomia severity).
- PATTERN §20.4 R.C7 — non comprimibilita' anchor + ban aggressive su chain profonde.
- ADR-048 — schema checker, skill 5-step, tassonomia verdict, trigger.
- ADR-047 — schema decision_anchor (prerequisito logico del checker).
- ADR-050 — backward compat + soft migration.
- ADR-051 — dominio scheduler `consistency-check`.
- Runbook precedente: [[decision-preserving-compression-runbook]] (TSK-120, overview EP-015).
