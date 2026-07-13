---
type: runbook
sources: ["management/kanban/EP-013-analytics-dogfooding-instrumentation/US-054-privacy-pii-policy-runbook-cross-link-ep014/US-054.md"]
status: draft
created: 2026-06-08
updated: 2026-06-08
tags: [analytics, dogfooding, measurement, opt-in, privacy, pii, runbook, adapter, ep-013]
---

# Runbook: Analytics Dogfooding Opt-in per Factory Derivate

> Parte di EP-013 (Analytics dogfooding instrumentation, v2.19+). Guida per attivare
> la misurazione analytics nella propria factory derivata in modo sicuro e conforme
> alla privacy policy. Per il repo del meta-framework: già configurato da v2.19
> (`analytics.dogfooding.enabled: true`, ADR-041). Le factory derivate sono opt-in:
> seguire questo runbook per attivare. Default `false` → 0 side effect (R.P3).

## §1 Prerequisiti

1. Framework versione **v2.18+** (tool `record-event.sh` disponibile in `.claude/tools/analytics/`).
2. Framework versione **v2.19+** per il cabling inline (dev-protocol + parallel-scheduling).
   Con v2.18: il tool è invocabile manualmente ma non è cablato automaticamente.
3. `factory.config.yaml.analytics.measurement.enabled: true` (abilitato nel repo framework dal 2026-06-04;
   in factory derivate: impostare manualmente).
4. Aver letto e accettato `analytics/PRIVACY.md` (allowlist 9 campi + blocklist 7 categorie, ADR-040). [^src: design_&_architecture/decisions/ADR-040.md §B]

Verifica prerequisiti:

```bash
grep "analytics.measurement.enabled" factory.config.yaml  # deve essere: true
ls .claude/tools/analytics/record-event.sh                 # deve esistere
cat analytics/PRIVACY.md | head -20                        # deve leggere la policy
```

## §2 Setup opt-in factory derivate

Passi per attivare il dogfooding nella propria factory:

1. **Accettare la privacy policy**: leggere `analytics/PRIVACY.md` (o la versione nel repo
   del framework: `https://github.com/soli92/soli-multi-agents-factory/analytics/PRIVACY.md`). [^src: management/kanban/EP-013-analytics-dogfooding-instrumentation/US-054-privacy-pii-policy-runbook-cross-link-ep014/TSK-107.md]

2. **Aggiornare `factory.config.yaml`**: aggiungere il blocco `analytics.dogfooding:`:

```yaml
analytics:
  measurement:
    enabled: true
    required_on_done: true  # consigliato per dogfooding (opt-in, default false)
    granularity: wave        # tsk | wave (default) | tool
  dogfooding:
    enabled: true           # MASTER SWITCH — attiva il cabling inline
    privacy_policy_path: analytics/PRIVACY.md  # path locale o URL al repo framework
    baseline_reports_path: analytics/reports/baseline/
    lock_strategy: flock-advisory
    lock_timeout_seconds: 5
    idempotency_strategy: hash-compound
```

3. **Creare la directory**: `mkdir -p analytics/events analytics/reports/baseline`

4. **Verificare il cabling**: eseguire un TSK pilota e verificare la presenza di eventi:
   ```bash
   ls analytics/events/
   cat analytics/events/$(date +%Y-%m).jsonl | head -5
   ```

## §3 Comandi

- `/analytics report --baseline --version=<vX.Y.Z>` — genera baseline metrics on-demand.
- `/analytics report --window=<N-days>` — report ultimi N giorni.
- `/analytics validate` — verifica conformità PII policy sui propri eventi
  (grep pattern per categorie blocklist, ADR-040 §B). [^src: design_&_architecture/decisions/ADR-040.md §B]

Adattamento per adapter non-Claude:
- Cursor: `<<come_si_invoca_record_task_event su Cursor>>`
- Aider: `<<come_si_invoca_record_task_event su Aider>>`
- OpenAI: `<<come_si_invoca_record_task_event su OpenAI API>>`

## §4 Troubleshooting

| Problema | Causa probabile | Soluzione |
|---|---|---|
| `analytics/events/` resta vuoto | `dogfooding.enabled: false` OR cabling non installato | Verificare factory.config.yaml §2; verificare versione framework ≥v2.19 |
| Evento rifiutato (exit 1 + "Campo PII vietato") | Payload contiene campo blocklist | Rimuovere il campo vietato dal payload. Vedi ADR-040 §B. |
| Lock contention timeout | Wave parallele su disco lento | Aumentare `lock_timeout_seconds` (es. 10). Verificare I/O disco. |
| `hash already present (idempotent)` | Evento duplicato (retry / re-invocazione) | Comportamento corretto. L'evento è già stato registrato. |
| Baseline non generata | `/analytics report --baseline` non invocato | Il baseline è on-demand (mai automatico). Invocare manualmente. |

## §5 Adattamento al framework ospite

Il runbook usa marcatori `<<...>>` per i punti che dipendono dall'adapter in uso:

- `<<come_si_invoca_record_task_event>>` — nel contesto Cursor/Aider/OpenAI, il tool
  `record-event.sh` si invoca: `<<adattare per l'adapter in uso; vedi adapters/README.md>>`.
- `<<path_analytics_events>>` — default `analytics/events/`; adattare se la factory usa
  un path personalizzato.

Riferimento adapter: `adapters/README.md` (multi-adapter support v2.13).

**Cross-link con EP-014 (consumer naturale)**:

Gli eventi prodotti da questo runbook sono consumati da EP-014 (temporal budget governor)
via P85 per layer dal baseline metrics. Il flusso end-to-end è:

```
record-event.sh → analytics/events/ → analyze-timeline.sh → baseline v2.19 → EP-014 governor
```

Vedi `management/kanban/EP-014-*/` per lo stato di EP-014 (consumer downstream).

## Cross-link

- ADR-041 §E (decisione accensione dogfooding repo framework). [^src: design_&_architecture/decisions/ADR-041.md §E]
- `analytics/PRIVACY.md` (allowlist/blocklist PII, TSK-107). [^src: design_&_architecture/decisions/ADR-040.md §B]
- Synthesis [[framework-critical-analysis-premortem]] — EP-013 dogfooding mitiga il rischio T4 (GIGO analytics mai acceso).
