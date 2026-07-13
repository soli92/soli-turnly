---
id: verifier-as-gate
type: runbook
title: Verifier-as-gate — staging buffer e two-phase commit del wiki
status: draft
created: 2026-05-15
updated: 2026-05-15
sources: []
tags: [runbook, hooks, verifier, staging, orchestrator, p1]
---

# Verifier-as-gate

Runbook del flusso two-phase commit introdotto in P1.2. Spiega come i producer
scrivono in `wiki-staging/`, come l'hook `auto_invoke_verifier.sh` emette un
marker, e come l'orchestrator promuove il file in `wiki/` solo al pass del
verifier. Riferimenti complementari: [[hook-dependencies]] per il setup deps,
[[2026-05-15-p0-silent-guardrail-degradation]] per il razionale fail-closed
ereditato in P1.2.

## Perché un buffer di staging

Pre-P1.2 i producer scrivevano direttamente in `wiki/<path>` e *poi* invocavano
il verifier. Se il verifier rilevava ungrounded/contradicted claims, la pagina
restava in `status: draft` ma era già nel grafo. Lettori (umani o altri agent)
potevano linkare a una pagina non verificata, propagando claim non grounded.

Il pattern two-phase commit risolve la corsa logica:

1. **Phase 1 — staging.** Il producer scrive in `wiki-staging/<same-path>`.
   Il file esiste su disco ma non è raggiungibile dal grafo wiki ufficiale.
2. **Phase 2 — promotion.** L'orchestrator invoca il verifier; al
   `verifier_outcome=pass`, fa `mv wiki-staging/<path> wiki/<path>`. Il file
   entra nel grafo solo dopo la verifica.

## Struttura `wiki-staging/`

Mirror di `wiki/` per i namespace soggetti a verifier [^code: wiki-staging/.gitkeep:1]:

```
wiki-staging/
├── sources/         ← wiki-keeper
├── concepts/        ← wiki-keeper
├── entities/        ← wiki-keeper
├── syntheses/       ← wiki-keeper
├── product/         ← product-manager (roadmap, epics, stories, confidence, questions)
├── design/          ← lead-architect (decisions, be, fe, api, db, components, risks)
└── execution/       ← tpm (current_sprint, parking_lot, done)
```

Le pagine **operational** restano fuori dal staging:

- `wiki/index.md` (navigazione hub) — scritta da `wiki-keeper` direttamente
  perché è rendering non-typed.
- `wiki/log.md` (audit narrativo) — scritta da tutti i producer direttamente,
  append-only enforced da [^code: .claude/hooks/enforce_append_only.sh:1].
- `wiki/runbooks/` e `wiki/incidents/` — pagine operational scritte da
  human/orchestrator senza producer-verifier loop (non sono artefatti tipizzati).

## Flusso del marker file

Quando un producer scrive in `wiki-staging/**`, il PostToolUse hook
[^code: .claude/hooks/auto_invoke_verifier.sh:1] emette un marker JSON:

```
logs/verifier_requests/<ISO-ts>-<producer>-<flatpath>.req.json
```

Esempio di nome: `logs/verifier_requests/2026-05-15T15-30-00Z-lead-architect-wiki-staging-design-decisions-ADR-007.req.json`.

Contenuto:

```json
{
  "ts": "2026-05-15T15:30:00Z",
  "producer": "lead-architect",
  "staged_path": "wiki-staging/design/decisions/ADR-007.md",
  "target_path": "wiki/design/decisions/ADR-007.md",
  "verifier": "verifier-grounding",
  "status": "pending"
}
```

Il marker viene letto dall'orchestrator al turno successivo. Non viene mai
modificato dal hook stesso (post-emissione è read-only per il hook). La
directory `logs/verifier_requests/` è hard-protected da
[^code: .claude/hooks/enforce_write_scope.sh:54]: né main né human possono
scriverci; solo il hook auto_invoke (emit) e l'orchestrator (cleanup/status).

## Promozione: cosa fa l'orchestrator

Al turno successivo, l'orchestrator esegue lo step 0 documentato in
[^code: .claude/agents/orchestrator.md:25]:

1. Scansiona `logs/verifier_requests/*.req.json`.
2. Per ogni marker: invoca `Agent` con `subagent_type=<verifier>`, passando
   `staged_path` come oggetto della verifica.
3. Attende l'esito (JSONL emesso dal verifier in `logs/runs/`).
4. **Pass**: `mkdir -p $(dirname target_path); mv staged_path target_path; rm marker`.
   Append a [[log]]: `[YYYY-MM-DD HH:MM] promote — <producer>:<target> via <verifier> — files touched: 1`.
5. **Fail**: aggiorna il marker `status` da `pending` a `failed-<N>` (N = attempt
   count nel turno corrente, contato anche in `memory/episodic/`). Append a
   [[log]]: `[YYYY-MM-DD HH:MM] VERIFIER-FAIL — <producer>:<staged> attempt=<N> — files touched: 0`.

## Interazione con il retry budget (P1.3)

Il marker `status: failed-<N>` è il signal che alimenta il circuit-breaker di
[^code: constitution.md:122]. Quando N raggiunge
`verifier.max_retries_per_producer_turn` (default 2), l'orchestrator NON
ri-delega il producer; appende `[BLOCKED]` a `wiki/log.md` ed escalation a
human. Il marker resta nel filesystem come audit trail della catena di fail
fino a quando un umano o un turno successivo lo risolve.

Cleanup policy:

- **Marker pass**: rimosso immediatamente dopo `mv`.
- **Marker fail**: conservato finché il `(producer, target)` non raggiunge un
  pass (cleanup) o un BLOCKED (preservato come audit). Nessuna scadenza
  temporale automatica.

## Come bypassare temporaneamente (sconsigliato)

Solo per debug locale. Mai in repo committato. Le opzioni teoriche:

1. Disabilitare `auto_invoke_verifier.sh` in [^code: .claude/settings.json:16].
   Risultato: i producer scrivono in staging ma nessun marker è emesso.
   Niente promotion. Sintomo: la wiki resta vuota e le pagine si accumulano
   in staging. Razionale per non farlo: viola l'invariante "producer-verifier
   pairing mandatory" di [^code: AGENTS.md:380].
2. Mettere `wiki/<namespace>/**` nello `write_scope` di un producer.
   Risultato: bypass del staging. enforce_write_scope.sh lo permette
   (perché è dichiarato nello scope), ma viola l'intent del two-phase commit.
   È esplicitamente vietato dalla policy: ogni write a `wiki/<typed-namespace>/`
   da producer è un bug nel design.

## Troubleshooting

### "Marker emitted but verifier non viene invocato"

Causa probabile: l'orchestrator non è stato lanciato dopo il write. Soluzione:
invocare l'orchestrator (`/run` o equivalente). I marker si accumulano
asincronicamente fino al prossimo turn dell'orchestrator.

### "auto_invoke_verifier: WARN — wiki-staging/ write without agent slug"

Significa che una write a `wiki-staging/` è avvenuta senza `CLAUDE_AGENT_SLUG`
propagato. È un bug della harness o un tentativo di bypass dall'umano (che
sarebbe già stato rifiutato da enforce_write_scope.sh in via separata). Verifica:
controlla `logs/runs/*.jsonl` per identificare l'origine.

### "agent X has no declared verifier; staged file Y will not be auto-promoted"

L'agent ha scritto in staging ma la sua frontmatter non dichiara un `verifier:`
oppure dichiara `null`. Soluzione: aggiungere `verifier: <slug>` alla
frontmatter dell'agent file. Senza verifier, il file resta in staging
indefinitamente — non è un bug del hook, è una configurazione incompleta.

### "Marker accumulato in logs/verifier_requests/ ma il file non c'è più in wiki-staging"

Un umano ha mosso o cancellato il file in staging manualmente, lasciando un
marker orfano. L'orchestrator al prossimo turn tenterà di verificare un file
inesistente. Soluzione: rimuovere il marker orfano a mano dopo aver capito
perché il file è stato spostato.

## Cosa NON fare

- ❌ Non scrivere direttamente in `wiki/<typed-namespace>/` (concepts, entities,
  sources, syntheses, product, design, execution). Tutte le typed pages passano
  da staging.
- ❌ Non rimuovere o modificare a mano i marker in `logs/verifier_requests/`
  durante un turno dell'orchestrator: race condition con il consumo.
- ❌ Non rimuovere `wiki-staging/.gitkeep` o le sotto-directory: l'hook
  presume che la struttura mirror di `wiki/` esista.
- ❌ Non far scrivere all'orchestrator content (paragrafi, frontmatter) in
  `wiki/` o `wiki-staging/`. Il suo write_scope esteso copre **solo** mv e
  cleanup; il vincolo è ribadito nel prompt dell'orchestrator.

## Stato del status

Status iniziale `draft`. Promotion a `reviewed` quando il primo
producer reale (es. wiki-keeper su un ingest concreto) avrà completato un
ciclo end-to-end: write in staging → marker → verifier pass → mv → marker
rimosso. Promotion a `certified` dopo aver osservato anche un ciclo fail+retry
e un BLOCKED escalation senza che emergano edge case non documentati.
