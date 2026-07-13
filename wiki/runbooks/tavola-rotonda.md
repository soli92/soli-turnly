---
id: tavola-rotonda-runbook
type: runbook
title: "Tavola Rotonda — Runbook operativo (decision tree attivazione + segnali di allarme)"
status: draft
created: 2026-07-06
updated: 2026-07-06
sources:
  - "management/kanban/EP-039-tavola-rotonda/US-142-comando-runbook-benchmark/TSK-293.md"
  - "wiki/concepts/tavola-rotonda.md"
  - "design_&_architecture/decisions/ADR-EP039-001-blackboard-format.md"
  - ".claude/commands/tavola-rotonda.md"
  - "factory.config.yaml (blocco tavola_rotonda:)"
related:
  - tavola-rotonda
  - blackboard-architecture
  - multi-agent-debate
tags: [runbook, tavola-rotonda, multi-agent, decision-tree, ep-039, attivazione, allarme]
pattern_section: "§28"
---

# Runbook — Tavola Rotonda

> Playbook operativo per chi deve decidere **quando usare `/tavola-rotonda`** invece
> di lanciare query indipendenti, e per chi ha una sessione in corso e vuole
> riconoscere i segnali di deriva. Per il protocollo a cinque fasi vedi
> [[tavola-rotonda]]; per il formato del blackboard vedi
> `design_&_architecture/decisions/ADR-EP039-001-blackboard-format.md`.
>
> **Opt-in totale (R.P3-TR)**: la Tavola Rotonda richiede `tavola_rotonda.enabled: true`
> in `factory.config.yaml`. Una factory non configurata si comporta identica a v2.26
> senza questa modalità — nessun side-effect, nessun overhead.

---

## 1. Decision tree di attivazione

La domanda critica (Elephant dal premortem EP-039): "quando vale la pena usare la
Tavola Rotonda invece di lanciare 3 query indipendenti?"

### Usa `/tavola-rotonda` se TUTTI questi sono veri

```
✓ Il problema richiede prospettive di ≥2 domini diversi
  (es. architettura + sicurezza, performance + consistency + costo)
✓ La decisione avrà impatto su più componenti o più team
✓ Vuoi un audit trail della decisione
  (motivazione + dissensi registrati, non solo la risposta finale)
✓ Hai ≥2 agenti con competenze rilevanti sul dominio
```

Se anche solo uno di questi criteri non è soddisfatto, considera le alternative
nella sezione §5.

### NON usare `/tavola-rotonda` se

```
✗ Il problema è risolvibile con competenza monodominio
  → usa /dev o /query direttamente sull'agente competente
✗ Non hai budget
  (stima: 5–15× costo normale per sessione N=3-5, M=3-4)
  → usa la baseline self-consistency (§5)
✗ Hai già una risposta chiara e cerchi solo conferma
  → usa /query; la Tavola Rotonda non è per validare conclusioni già formate
✗ Il problema è già stato deciso
  → usa /query per documentare la decisione, non ridiscutere
```

---

## 2. Scenari concreti: SI / NO / DIPENDE

### Scenario 1 — SI

**"Stiamo decidendo l'architettura del layer di cache per un'app con requisiti
conflittuali performance / consistency / costo."**

Perché SI:
- Almeno 3 domini in tensione strutturale (infra, applicativo, business).
- La scelta avrà impatto su BE, FE e pipeline di deployment.
- Errori di architettura in questo punto sono costosi da correggere.
- Il valore dell'audit trail è alto: il team ha bisogno di capire *perché* si
  è scelto Redis invece di in-memory e a quali condizioni riesaminare.

Partecipanti suggeriti: `lead-architect`, `be-dev`, `qa-dev` (come Critico).

### Scenario 2 — NO

**"Devo scegliere tra UUID v4 e ULID come primary key."**

Perché NO:
- Problema monodominio (schema DB + performance di insert, nessuna tensione di
  dominio strutturale).
- Esiste letteratura tecnica consolidata; non c'è genuina incertezza.
- Il costo della Tavola Rotonda sarebbe 5–15× quello di una query diretta al
  `lead-architect` o a un documento wiki.

Alternativa raccomandata: `/query "UUID v4 vs ULID come primary key — trade-off
insert performance, sortabilità, e leggibilità"`.

### Scenario 3 — SI / DIPENDE

**"Stiamo valutando se introdurre un nuovo agente nel workflow o estendere uno
esistente."**

Dipende da:
- **Impatto cross-cutting?** Se la decisione tocca routing in `orchestrator`,
  config `factory.config.yaml` e almeno un agente esistente → SI (multi-dominio).
- **Decisione isolata?** Se il nuovo agente opera in un dominio autonomo senza
  toccare il routing corrente → NO (monodominio architetturale, un solo ADR
  basta).
- **Team distribuito con ownership divisa?** Se più persone devono essere
  allineate sul cambiamento → SI (l'audit trail vale il costo).

Criterio rapido: conta quanti file nel repo vengono modificati. Se sono 4+ in
layer diversi, la Tavola Rotonda ha senso.

---

## 3. Segnali di allarme durante una sessione

Questi segnali indicano che la sessione sta producendo costo senza valore.
Riconosci presto e intervieni.

### 1 — Critico silenzioso

**Trigger**: il Critico non modifica nessun Punto Aperto in 2 round consecutivi.

**Significato**: il ruolo Critico sta fallendo il suo mandato (compiacenza o
problema genuinamente non controverso).

**Azione**: riassegna il ruolo Critico a un altro partecipante, oppure rilancia
con il prompt rinforzato del mandato anti-compiacenza (vedi
`.claude/skills/tavola-rotonda-protocol.md` §Test del Critico).

---

### 2 — Blackboard overflow

**Trigger**: il contesto del blackboard supera 20k token prima di Fase 4
(convergenza).

**Significato**: `max_round` è troppo alto, oppure i Punti Aperti crescono
invece di diminuire — il protocollo non sta convergendo.

**Azione**: riduci `max_round` e forza la transizione a Fase 3 (convergenza
anticipata). Il registro decisioni documenterà i Punti Aperti residui come
"questioni aperte non risolte".

---

### 3 — Posizioni Fase 1 convergenti

**Trigger**: tutte le posizioni in Fase 1 sono identiche al 90%.

**Significato**: il problema non è genuinamente multi-dominio, oppure il
contesto fornito ai partecipanti era già orientato verso una soluzione.

**Azione**: considera di terminare la sessione e usare la risposta comune come
risultato (risparmio token); oppure riprova con un problema riformulato che
metta in evidenza la tensione tra domini.

---

### 4 — Token Ledger fuori profilo

**Trigger**: Token Ledger > $0.50 a fine Fase 1 (fase di posizioni isolate).

**Significato**: la sessione consumerà 5–10× questo importo entro la fine —
probabilmente fuori budget.

**Azione**: considera di abortire la sessione e usare l'alternativa
self-consistency (§5), oppure riduci N partecipanti a 2 prima di procedere.
Il costo tipico per sessione N=3, M=4 è $1–$3; N=5, M=5 può superare $10.

---

## 4. Setup in 3 step

Dalla config al primo `/tavola-rotonda`.

### Step 1 — Abilita la modalità in factory.config.yaml

```yaml
tavola_rotonda:
  enabled: true
  partecipanti: [be-dev, lead-architect]   # default; override con --partecipanti
  max_round: 4
  budget:
    max_cost_usd: 2.00                     # obbligatorio (INV-TR-3)
  critico:
    enabled: true                          # avvocato del diavolo attivo
  topologia: lavagna                       # hub-and-spoke (default)
```

`budget.max_cost_usd` è obbligatorio: senza di esso il gate di Fase 0 blocca la
sessione con errore esplicito. Non esiste un default implicito (INV-TR-3).

### Step 2 — Verifica agenti disponibili

```bash
ls .claude/agents/tavola-rotonda-moderatore.md   # deve esistere
ls .claude/agents/be-dev.md                      # ogni partecipante target
ls .claude/agents/lead-architect.md
```

Il comando `/tavola-rotonda` verifica automaticamente ogni slug in
`--partecipanti` — se un file agente manca, STOP esplicito.

### Step 3 — Esegui la prima sessione

```bash
/tavola-rotonda "<topic>" --partecipanti=<a>,<b>,<c>

# Esempi:
/tavola-rotonda "Quale pattern di caching adottare per l'API?"
/tavola-rotonda "Architettura auth" --partecipanti=be-dev,lead-architect,qa-dev
/tavola-rotonda "DB sharding strategy" --max-round=3 --budget=3.00
```

L'output include il path del registro decisioni
(`wiki/decisions/tavola-rotonda-<session-id>-<YYYY-MM-DD>.md`) e il riepilogo
della sessione (round completati, motivo di stop, accordi raggiunti).

---

## 5. Baseline alternativa — self-consistency

Per problemi **mono-dominio** o quando il budget è un vincolo stringente,
la self-consistency è l'alternativa raccomandata:

1. Lancia 3 query **identiche** allo stesso agente (o a `/query`).
2. Seleziona la risposta con la motivazione più completa o la più
   rappresentativa delle 3.
3. Costo: 3× query singola (vs. 5–15× della Tavola Rotonda).

**Come calibrare quando vale il costo extra della Tavola Rotonda:**

| Dimensione | Self-consistency | Tavola Rotonda |
|---|---|---|
| Costo | 3× query | 5–15× query |
| Audit trail | No | Sì (posizioni + dissensi registrati) |
| Domini coperti | 1 | ≥2 |
| Groupthink mitigation | No | Sì (Critico con mandato esplicito) |
| Convergenza garantita | No (voto a maggioranza) | Sì (Fase 3 + terminazione forzata) |

Se dopo una sessione di Tavola Rotonda la decisione coincide con quella che
avresti ottenuto via self-consistency, hai pagato il delta per l'audit trail
e la diversità strutturale — non per l'"intelligenza collettiva emergente".
Questo è normale e documentato dalla letteratura (§2.1 del concept
[[tavola-rotonda]]).

---

## Riferimenti

- ADR normativo blackboard: `design_&_architecture/decisions/ADR-EP039-001-blackboard-format.md`
- Comando: `.claude/commands/tavola-rotonda.md`
- Config gate: `factory.config.yaml` blocco `tavola_rotonda:`
- Concept: [[tavola-rotonda]] (protocollo a cinque fasi, parametri, letteratura)
- Concept: [[blackboard-architecture]] (HEARSAY-II, hub-and-spoke)
- Concept: [[multi-agent-debate]] (MoA, self-consistency baseline)
- PATTERN §28 — Tavola Rotonda multi-agente (EP-039)
- Skill: `.claude/skills/tavola-rotonda-protocol.md` (implementazione Fasi 0-4)
- Agente: `.claude/agents/tavola-rotonda-moderatore.md`
