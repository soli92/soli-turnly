# test-healing-protocol

**Versione:** 1.0 (EP-028, Sprint 30)
**Scope:** `qa-dev` — protocollo di auto-guarigione dei test
**Prerequisiti:** EP-018 (`functional-oracle-protocol`, acceptance-spec come fonte immutabile), EP-027 (`flakiness-detection-protocol`, candidati prioritari per healing)

---

## Sezione 1: Overview e Gate

### Gate di abilitazione

Questa skill e' no-op totale quando:

```yaml
qa_layer:
  test_healing:
    enabled: false   # default (R.P3 opt-in totale)
```

Se `qa_layer.test_healing.enabled: false`, il `qa-dev` non invoca nessuna fase di questa skill. Il comportamento e' identico a quello pre-EP-028.

Per attivare il self-healing: impostare `qa_layer.test_healing.enabled: true` in `factory.config.yaml`.

### Scopo

Il test-healer e' un **evaluator-optimizer probabilistico** specializzato per il corpus test. Opera a livello di singolo test-case (non di TSK o epica — distinzione da EP-029 che opera a livello TSK). Quando un test fallisce, il test-healer:

1. **Classifica** il failure in una delle 4 categorie causali (Fase 1).
2. **Propone o applica** un repair con confidence-gating a 3 livelli (Fasi 2-4).
3. **Tutela** l'immutabilita' degli YAML acceptance-spec (Fase 5).
4. **Registra** ogni azione nell'audit trail JSONL (invariante append-only).

L'analogia con CQRL (EP-019) e' intenzionale: come `code-reviewer` migliora il codice con un loop bounded (`max_iterations: 3`), il test-healer migliora la suite test con un loop bounded (`max_attempts`, default 3).

### Categorie failure (grana fine, livello test-case)

| Categoria | Causa tipica |
|---|---|
| `STALE_SELECTOR` | Selettore CSS/ARIA non trovato nel DOM snapshot corrente (refactoring UI) |
| `SCHEMA_DRIFT` | Campo mancante o tipo errato in fixture o response body rispetto allo schema atteso |
| `INFRA_ERROR` | Timeout, porta occupata, network error, processo non avviato |
| `WRONG_ASSERTION` | Comportamento attuale != acceptance-spec ma diff semanticamente coerente |
| `UNKNOWN` | Nessuna euristica o LLM ha prodotto una classificazione attendibile |

---

## Sezione 2: Fase 1 — Pipeline classificazione failure

La classificazione e' **deterministica prima, LLM dopo**: le euristiche meccaniche (Step 1-3) sono prioritarie rispetto al fallback LLM (Step 4). Questo assicura riproducibilita' e velocita'.

### Regola di idempotenza

Il classificatore e' idempotente: lo stesso input (log di errore + DOM snapshot + fixture diff) produce sempre la stessa classificazione. Lo stato del sistema NON deve essere mutato durante la Fase 1: nessuna scrittura, nessun repair, solo lettura e analisi.

### Step 1 — INFRA_ERROR (deterministico)

**Trigger:** presenza di pattern infrastrutturali nel log di errore.

**Euristiche:**
- Exit code infrastrutturale: `124` (timeout), `SIGKILL`, processo terminato con codice non-zero per motivi OS
- Keyword matching su stderr/log:
  - `ECONNREFUSED` — connessione rifiutata (server non avviato o porta sbagliata)
  - `ETIMEDOUT` — timeout di connessione o operazione
  - `port already in use` / `address already in use` — porta occupata
  - `ENOENT` — file o directory non trovati (dipendenza assente)
  - `EACCES` — permesso negato
  - `DNS resolution failure` / `ENOTFOUND` — errore DNS
  - `ECONNRESET` — connessione interrotta brutalmente
  - `Process exited with code` (non-zero, pattern nei log del test runner)

**Azione:** se almeno un pattern matcha → classificazione `INFRA_ERROR`. La `confidence` e' derivata dalla specificita' del pattern (pattern singolo univoco = alta; pattern generico = media).

**Nessun tentativo di repair automatico** per INFRA_ERROR — genera solo report di escalazione (vedi Fase 2).

### Step 2 — SCHEMA_DRIFT (deterministico)

**Trigger:** campo mancante o tipo incompatibile in fixture o response body vs schema atteso.

**Euristiche:** diff tra fixture corrente e schema corrente dell'endpoint/DB:
- Campo presente nello schema atteso ma assente nella fixture corrente (`undefined` o `null` laddove il tipo e' obbligatorio)
- Tipo diverso: es. schema attende `string`, fixture contiene `number`; schema attende `array`, risposta e' un `object`
- Campo richiesto (`required: true`) con valore mancante nel response body

**Azione:** se il diff di schema produce almeno una discrepanza → classificazione `SCHEMA_DRIFT`. La `confidence` e' derivata dalla completezza del diff (diff completo e strutturato = alta; diff parziale = media).

### Step 3 — STALE_SELECTOR (deterministico)

**Trigger:** selettore CSS o ARIA non trovato nel DOM snapshot corrente al passo fallito.

**Euristiche:**
- Errore `element not found` con selettore esplicitato nel log del test runner
- Selettore (CSS class, ID, ARIA role, `data-testid`) non presente nel DOM snapshot acquisito al momento del fallimento
- Il selettore era valido in run precedenti (informazione dal flakiness log EP-027)

**Acquisizione DOM snapshot:** lo snapshot deve essere acquisito al momento del fallimento. Strumento candidato: `playwright evaluate` o equivalente (vedi Nota tecnica in fondo alla sezione). Il test-healer consuma lo snapshot come input; non e' responsabile della sua acquisizione.

**Azione:** se il selettore del passo fallito non e' trovato nel DOM snapshot → classificazione `STALE_SELECTOR`. La `confidence` e' derivata dall'univocita' del candidato sostitutivo nel DOM snapshot (1 candidato inequivocabile = alta; 0 o 2+ candidati = media/bassa).

### Step 4 — WRONG_ASSERTION / UNKNOWN (LLM fallback)

**Trigger:** nessuno degli Step 1-3 ha prodotto una classificazione.

**Input al LLM:**
- Log di errore completo
- Diff tra comportamento attuale e comportamento atteso (dal YAML acceptance-spec)
- Rationale richiesto: il LLM deve spiegare perche' la discrepanza e' semanticamente coerente o non classificabile

**Logica:**
- Se il LLM individua coerenza semantica tra il diff e un cambiamento legittimo dell'applicazione (es. label rinominata, campo rinominato, flusso modificato deliberatamente) → classificazione `WRONG_ASSERTION`
- Se `confidence` LLM < 0.50 o il LLM non riesce ad associare il failure a nessuna categoria → classificazione `UNKNOWN`

**UNKNOWN policy:**
- Escalation immediata al gate umano
- Nessun tentativo di repair
- Il TSK viene flaggato `self_healing_status: needs_human_review`

### Output schema obbligatorio

Il classificatore produce il seguente JSON per ogni invocazione:

```json
{
  "test_id": "<suite>::<test-name>",
  "classification": "STALE_SELECTOR | WRONG_ASSERTION | INFRA_ERROR | SCHEMA_DRIFT | UNKNOWN",
  "confidence": 0.00,
  "evidence": "<artefatto concreto: log excerpt, DOM snapshot ref, fixture diff>",
  "rationale": "<spiegazione sintetica della classificazione>"
}
```

**Regola:** classificazione senza `evidence` → forzata a `UNKNOWN`. Il campo `evidence` e' obbligatorio e non omissibile: deve contenere un artefatto concreto (non una parafrasi del log).

### Nota tecnica: DOM snapshot

La strategia `STALE_SELECTOR` richiede l'acquisizione del DOM snapshot al momento del fallimento. La skill documenta l'interfaccia attesa (input: DOM snapshot come stringa HTML; output: lista di candidati selettori alternativi) senza vincolare l'implementazione runtime. L'adozione di un tool specifico (es. `playwright evaluate`, serializzazione JSDOM) richiede un ADR separato prima dell'implementazione.

---

---

## Sezione 3: Fase 2 — Strategie repair per categoria

Le strategie di repair sono selezionate in base alla classificazione prodotta dalla Fase 1. Il repair non viene mai applicato direttamente senza passare attraverso il confidence-gating (Fase 3).

### STALE_SELECTOR — strategia repair

Il test-healer cerca nel DOM snapshot corrente un selettore alternativo per l'elemento target. L'ordine di priorita' dei selettori candidati e':

1. `aria-label` — selettore semantico piu' stabile, indipendente dalla struttura HTML
2. `data-testid` — attributo di test esplicito, resistente al refactoring CSS
3. Testo visibile — testo leggibile dell'elemento (es. contenuto `button`, `a`, `h1`)

Il candidato viene scelto solo se e' **univoco** nel DOM snapshot (esattamente 1 match). Se il DOM snapshot contiene 0 candidati o 2+ candidati ambigui per l'elemento target → downgrade automatico a Livello 2 (proposta/patch), non auto-apply.

L'azione consiste nell'aggiornare il selettore nel file test con il candidato identificato.

**Azione vietata:** non modificare file `**/acceptance-spec/*.yaml` (invariante Fase 5).

### SCHEMA_DRIFT — strategia repair

Il test-healer aggiunge il campo mancante con valore `null` o il valore di default del tipo (es. `""` per string, `0` per number, `[]` per array) al file fixture. In alternativa, aggiorna il tipo del campo se il nuovo schema e' un superset compatibile.

**Condizione di auto-apply:** il nuovo schema deve essere un superset compatibile dello schema originale:
- Nessun campo obbligatorio rimosso
- Nessun tipo incompatibile (es. non si puo' cambiare `string` in `object`)

Se il nuovo schema rimuove campi obbligatori → downgrade automatico a Livello 3 (human gate), non auto-apply.

La modifica viene annotata nel log con i campi `before_hash` e `after_hash`.

**Azione vietata:** non modificare YAML acceptance-spec, anche se il drift riguarda un campo documentato nello spec.

### INFRA_ERROR — strategia repair

Nessun repair automatico. Il test-healer genera esclusivamente un report di escalazione con:
- Categoria: `INFRA_ERROR`
- Evidence: estratto del log con il pattern infrastrutturale matchato
- Suggerimento operativo (es. "verificare che il server sia avviato", "liberare la porta X")
- `action_taken: "escalated_to_human"`

### WRONG_ASSERTION — strategia repair

Il test-healer genera un diff tra il comportamento attuale e il comportamento atteso documentato nell'acceptance-spec. Propone l'aggiornamento dell'assertion nel file test.

**Invariante critica:** il repair di `WRONG_ASSERTION` NON puo' modificare il file acceptance-spec. Se il repair richiederebbe una modifica allo spec → attivazione obbligatoria della Fase 5 (invariante acceptance-spec immutabile), indipendentemente dal `confidence_score`.

### UNKNOWN — strategia repair

Nessun repair automatico. Escalation umana immediata con:
- `self_healing_status: needs_human_review` nel frontmatter del TSK
- Report con classificazione, `confidence`, `evidence` e rationale dell'incertezza
- `action_taken: "escalated_to_human"`

---

## Sezione 4: Fase 3 — Confidence-gating (3 livelli)

Il confidence-gating determina se il repair viene applicato automaticamente, proposto come patch/PR, o escalato all'umano. La soglia e' calcolata sul `confidence_score` prodotto dalla Fase 1.

### Livello 1 — Auto-apply (confidence_score > 0.95)

**Condizioni di attivazione:**
- `confidence_score > 0.95`
- Categoria: `STALE_SELECTOR` o `SCHEMA_DRIFT` (le uniche categorice riparabili automaticamente con alta affidabilita')
- Nessun file `**/acceptance-spec/*.yaml` coinvolto nella modifica (glob check pre-write)
- Per `STALE_SELECTOR`: esattamente 1 candidato nel DOM snapshot (altrimenti downgrade a Livello 2)
- Per `SCHEMA_DRIFT`: nuovo schema superset compatibile (altrimenti downgrade a Livello 3)

**Azione:** il repair viene applicato direttamente al working tree. Il file di test o fixture viene modificato.

**Registrazione JSONL:**
```json
{
  "type": "healing_action",
  "test_id": "<suite>::<test-name>",
  "classification": "STALE_SELECTOR | SCHEMA_DRIFT",
  "confidence": 0.00,
  "action_taken": "auto_applied",
  "before_hash": "<sha256 del file prima della modifica>",
  "after_hash": "<sha256 del file dopo la modifica>",
  "iteration": 1
}
```

### Livello 2 — Proposta patch/PR (confidence_score 0.70..0.95)

**Condizioni di attivazione:**
- `confidence_score` nel range `[0.70, 0.95]`
- Oppure: downgrade automatico da Livello 1 per ambiguita' (DOM snapshot con 0 o 2+ candidati)

**Azioni:**
- Produce un diff annotato salvato in: `analytics/qa/healing-proposals/<test_id>-<YYYY-MM-DD>.diff`
  Il diff include: file modificato, contesto 5 righe, annotazione inline con rationale e confidence.
- Il repair NON viene applicato direttamente al working tree.
- Se VCS disponibile (git remoto configurato in `factory.config.yaml`):
  - Crea branch `qa-heal/<test_id>-<YYYY-MM-DD>`
  - Commit con messaggio: `qa(heal): propose fix for <test_id> [confidence=<value>]`
  - Apre PR draft (se provider configurato in `kanban_publish`)
- Se VCS non disponibile: solo file di patch annotato, nessun branch.
- Notifica: l'orchestratore crea un TSK di revisione per PM/lead-architect.

**Registrazione JSONL:**
```json
{
  "type": "healing_action",
  "test_id": "<suite>::<test-name>",
  "classification": "STALE_SELECTOR | SCHEMA_DRIFT | WRONG_ASSERTION",
  "confidence": 0.00,
  "action_taken": "pr_proposed",
  "proposal_path": "analytics/qa/healing-proposals/<test_id>-<date>.diff",
  "iteration": 1
}
```

### Livello 3 — Human gate (confidence_score < 0.70)

**Condizioni di attivazione:**
- `confidence_score < 0.70`
- Oppure: classificazione `UNKNOWN`
- Oppure: classificazione `INFRA_ERROR`
- Oppure: downgrade da Livello 1 per schema drift con campi obbligatori rimossi
- Oppure: downgrade da Livello 2 per mancanza di candidati non ambigui

**Azioni:**
- Nessuna modifica al codebase.
- Il TSK viene flaggato: `self_healing_status: needs_human_review`.
- Il report QA include: classificazione, confidence, evidence, rationale dell'incertezza.

**Registrazione JSONL:**
```json
{
  "type": "healing_action",
  "test_id": "<suite>::<test-name>",
  "classification": "UNKNOWN | <qualsiasi>",
  "confidence": 0.00,
  "action_taken": "escalated_to_human",
  "iteration": 1
}
```

---

## Sezione 5: Audit trail

Ogni azione di healing (auto-apply, proposta, escalazione) viene appesa al JSONL store:

```
analytics/events/qa-events.jsonl
```

Il formato canonico per eventi di healing:

```json
{"type": "healing_action", "test_id": "...", "category": "...", "confidence": 0.0, "action_taken": "auto_applied|proposed|escalated", "timestamp": "..."}
```

Il form esteso con `before_hash`/`after_hash` (per auto-apply) e `proposal_path` (per pr_proposed) e' documentato nelle rispettive sezioni del confidence-gating.

### Invariante audit trail

`analytics/events/qa-events.jsonl` e' **append-only**: nessun record viene modificato o eliminato a posteriori. Ogni record include `before_hash` e `after_hash` (sha256) per le operazioni auto-apply, consentendo verifica dell'integrita' della modifica applicata. Il JSONL e' leggibile da tool esterni (analytics dashboard, audit review).

Questo file e' gia' usato da EP-027 (flakiness detection): il sotto-schema `healing_action` affianca senza sovrascrivere il sotto-schema `flakiness_event`.

---

## Sezione 6: Loop bounded

Il repair viene tentato al massimo `qa_layer.test_healing.max_attempts` volte (default `3`). Dopo ogni tentativo, il test viene rieseguito. Il loop si interrompe quando:

- Il test passa (successo) — repair efficace.
- Il contatore `iteration` raggiunge `max_attempts` — soglia esaurita.

**Al terzo tentativo fallito senza successo:** escalation umana obbligatoria, indipendentemente dalla `confidence_score` del classificatore. Il test viene marcato:

```
self_healing_status: exhausted
```

L'evento finale registrato nel JSONL ha:

```json
{
  "type": "healing_action",
  "test_id": "<suite>::<test-name>",
  "classification": "<ultima classificazione>",
  "confidence": 0.00,
  "action_taken": "max_attempts_exceeded",
  "iteration": 3
}
```

**Invariante contatore:** il contatore `iteration` non viene mai resettato retroattivamente (append-only). Nessun ulteriore tentativo automatico dopo `max_attempts_exceeded`.

---

---

## Sezione 7: Fase 5 — Invariante acceptance-spec immutabile

### Dichiarazione dell'invariante

> I file che corrispondono al glob `**/acceptance-spec/*.yaml` e `**/*.acceptance-spec.yaml` sono **read-only** per il test-healer. Questo invariante non ha eccezioni automatiche e non puo' essere disabilitato via configurazione (`acceptance_spec_immutable: true` non e' overridabile, analogo a `to_artifact: off` nel compression layer).

L'invariante ha priorita' su qualsiasi `confidence_score`: anche con confidence 0.99, il test-healer non scrive su nessun file acceptance-spec YAML. Non esistono path di bypass automatici.

### Trigger di escalazione

La Fase 5 si attiva quando:

1. La classificazione prodotta dalla Fase 1 e' `WRONG_ASSERTION`.
2. Il repair identificato nelle Fasi 2-4 richiederebbe la modifica di un file che corrisponde al glob `**/acceptance-spec/*.yaml` o `**/*.acceptance-spec.yaml`.

Il **glob check pre-write** viene eseguito prima di qualsiasi operazione di write: il test-healer verifica il path del file target rispetto ai glob sopra prima di scrivere o di aprire una PR. Se il path matcha un glob di acceptance-spec → attivazione immediata della Fase 5, senza eccezioni.

### Azione obbligatoria: report di escalazione

Quando la Fase 5 si attiva, il test-healer:

1. **Interrompe immediatamente il repair.** Nessuna modifica al working tree.
2. **Non apre PR** che includano modifiche a file acceptance-spec.
3. **Produce il seguente report strutturato (JSON):**

```json
{
  "test_id": "<suite>::<test-name>",
  "classification": "WRONG_ASSERTION",
  "confidence": 0.00,
  "evidence": "<diff leggibile tra comportamento osservato e comportamento atteso nello YAML>",
  "required_human_action": "UPDATE_ACCEPTANCE_SPEC",
  "acceptance_spec_path": "<path del file YAML coinvolto>",
  "rationale": "Il comportamento applicativo e' cambiato o il test riflette un bug? Il comportamento attuale diverge dall'acceptance-spec in modo semanticamente intenzionale. Aggiornare l'acceptance-spec richiede deliberazione umana."
}
```

Il campo `required_human_action: "UPDATE_ACCEPTANCE_SPEC"` e' obbligatorio e non omissibile.

4. **Salva il report** in: `analytics/qa/healing-proposals/<test_id>-<YYYY-MM-DD>-escalation.json`
5. **Flagga il TSK:** `self_healing_status: needs_human_review`
6. **Registra nel JSONL:**

```json
{
  "type": "healing_action",
  "test_id": "<suite>::<test-name>",
  "classification": "WRONG_ASSERTION",
  "confidence": 0.00,
  "action_taken": "escalated_immutable_spec",
  "iteration": 1
}
```

### Diff leggibile obbligatorio

Il campo `evidence` del report deve contenere un diff leggibile (formato unified diff o tabella before/after) tra:

- **Comportamento osservato:** output attuale del sistema (risposta API, stato UI, valore computato)
- **Comportamento atteso:** contenuto dello YAML acceptance-spec coinvolto (scenario, asserzioni)

Questo diff e' il materiale primario che l'umano usa per decidere:
- Il comportamento nuovo e' corretto → aggiornare l'acceptance-spec (richiede deliberazione umana)
- Il comportamento vecchio era quello giusto → correggere il bug applicativo

### Configurazione in factory.config.yaml

Il blocco di configurazione per il self-healing in `factory.config.yaml`:

```yaml
qa_layer:
  test_healing:
    enabled: false           # opt-in (R.P3) — EP-028 test self-healing layer
    max_attempts: 3          # loop bounded
    auto_apply_threshold: 0.95  # confidence > soglia → auto-apply
    propose_threshold: 0.70     # confidence > soglia → proposta (altrimenti escalation)
    healing_invariants:
      acceptance_spec_immutable: true   # INVARIANTE: test-healer non modifica acceptance-spec
      acceptance_spec_glob: "**/acceptance-spec/*.yaml"
```

**`acceptance_spec_immutable: true` non puo' essere impostato a `false`.** E' un invariante del layer self-healing, non un parametro configurabile. Il validation gate della skill deve rifiutare una configurazione con `acceptance_spec_immutable: false` emettendo un errore fail-loud al boot.

### Allineamento con EP-018

Il glob `acceptance_spec_glob` deve essere coerente con il path usato da `functional-oracle-protocol` (EP-018) per localizzare gli spec. Il valore di default in `fe_correctness.functional_oracle.acceptance_spec_glob` e' `"code_quality/acceptance/*.acceptance.yaml"`.

Se i due glob divergono, la skill deve emettere un warning di configurazione al boot:

```
WARNING: test_healing.acceptance_spec_glob differs from functional_oracle.acceptance_spec_glob.
Verify that both globs cover the same acceptance-spec files to avoid protection gaps.
```

### Allineamento con Fase 1 (US-098)

La classificazione `WRONG_ASSERTION` e' prodotta dalla Fase 1 (Sezione 2 di questa skill). La Fase 5 definisce l'azione da intraprendere *dopo* quella classificazione, specificamente quando il repair richiederebbe la modifica di uno YAML acceptance-spec. Le due fasi sono complementari e non si sovrappongono: la Fase 1 classifica, la Fase 5 enforce l'invariante di immutabilita'.

---

## Riferimenti

- EP-028: `management/kanban/EP-028-test-self-healing/EP-028.md`
- EP-018 (functional-oracle / acceptance-spec): `.claude/skills/functional-oracle-protocol.md`
- EP-027 (flakiness detection): `.claude/skills/flakiness-detection-protocol.md`
- Configurazione: `factory.config.yaml` — blocco `qa_layer.test_healing`
- Audit trail: `analytics/events/qa-events.jsonl` (append-only, side-channel)
