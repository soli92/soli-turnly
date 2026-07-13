---
type: policy
scope: analytics-dogfooding
version: v2.19
applies_to: analytics/events/*.jsonl
updated: 2026-06-08
requires_adr_to_change: true
---

# Privacy / PII boundary — analytics dogfooding events

Policy canonica che definisce **cosa si registra** e **cosa NON si registra** negli
eventi analytics dogfooding (`analytics/events/*.jsonl`). Stabilisce una **allowlist**
di campi safe-listati e una **blocklist** invariante di categorie vietate, documenta
l'**enforcement pre-write** nel tool `record-event.sh` e l'**audit** a posteriori.

Senza questa policy esplicita gli `actor_id` umani sarebbero leakable e PII potenziale
nel contenuto dei TSK sarebbe persistito silentemente: inaccettabile per adozione
enterprise (GDPR-rischio). Il pattern adottato è **fail-closed applicato alla privacy**:
allowlist 9 campi + blocklist 7 categorie + tool che rifiuta fail-loud su violazione.

> Binding di Arch: [`design_&_architecture/decisions/ADR-040.md`](../design_&_architecture/decisions/ADR-040.md)
> §A (allowlist) · §B (blocklist) · §C (enforcement) · §D (audit) · §E (override) ·
> §F (cross-EP gate) · §G (struttura canonica).
> Storia di origine: [`management/kanban/EP-013-analytics-dogfooding-instrumentation/US-054-privacy-pii-policy-runbook-cross-link-ep014/US-054.md`](../management/kanban/EP-013-analytics-dogfooding-instrumentation/US-054-privacy-pii-policy-runbook-cross-link-ep014/US-054.md) §Business Rules.

## §1 — Cosa si registra (allowlist 9 campi safe-listati)

I soli campi top-level accettati sono i 9 safe-listati seguenti (ADR-040 §A). Il tool
`record-event.sh` rifiuta qualunque chiave top-level non presente in `ALLOWED_KEYS`.

| # | Campo | Tipo | Descrizione | Esempio |
|---|-------|------|-------------|---------|
| 1 | `ts` | string ISO-8601 UTC con Z | Timestamp evento | `2026-06-08T14:32:00Z` |
| 2 | `state` | enum string | Stato canonico (ADR-042 §A): started/finished/blocked/aborted/wave_started/wave_completed/sub_agent_dispatched | `started` |
| 3 | `task_id` | string strutturato | ID strutturato del TSK, no contenuto | `TSK-094-criteri-run-reale` |
| 4 | `actor_id` | string strutturato | Nome agente (slug canonico) o GitHub handle umano | `be-dev`, `@soli92` |
| 5 | `actor_type` | enum string | agent \| human | `agent` |
| 6 | `project_id` | string strutturato | ID progetto/factory | `soli-multi-agents-factory` |
| 7 | `task_type` | enum string | Layer del TSK | `be`, `fe`, `docs`, `qa` |
| 8 | `elapsed_ms` | number | Wall-clock elapsed | `1234567` |
| 9 | `tokens` | object nested | Conteggi token (no contenuto) | `{input: 1234, output: 567}` |

**Campi extension opzionali** (aggiuntivi, sempre allowlist-compliant):

- `wave_id`, `wave_size`, `wave_elapsed_ms`, `success_count`, `failure_count` — scheduling (no PII).
- `aborted_reason`, `blocked_reason` — slug strutturato max 200 char (no testo libero, ADR-040 §B cat 7).
- `blocking_artifacts: [path]` — lista di path, NO contenuto del file.
- `model`, `tool_calls[]` — campi EP-009 esistenti (no PII).
- `hash` — idempotency (no PII, ADR-039 §C).
- `dispatch_ts`, `completion_ts` — wave timing (no PII).
- `candidates: [task_id]` — lista ID TSK nella wave (no contenuto).

**Vincolo invariante**: ogni nuovo campo introdotto dopo v2.19 DEVE essere esplicitamente
aggiunto all'allowlist via ADR. No creep silente. Pattern parallelo a ADR-032 §H
(versioning criteri battle-test).

## §2 — Cosa NON si registra (blocklist invariante, 7 categorie)

Le 7 categorie seguenti sono vietate in qualunque campo del payload (ADR-040 §B).
Il tool applica pattern-matching conservativo per intercettarle pre-write.

| # | Categoria | Esempi | Razionale |
|---|-----------|--------|-----------|
| 1 | Contenuto di qualunque file del repo | `cat src/auth.py`, diff lunghi | Può contenere secrets/PII/business logic |
| 2 | Contenuto dei prompt LLM | system prompt, user prompt, assistant response | Prompt può leakare dati input utente |
| 3 | Tool output completo | output git/npm/pytest | Può contenere path assoluti, env vars, errori con contenuto |
| 4 | Env vars | `OPENAI_API_KEY`, `GH_TOKEN` | Anche redatte sono pericolose (struttura → fingerprint) |
| 5 | Segreti in qualunque forma | API keys, OAuth tokens, password, SSH keys | Mai loggare segreti |
| 6 | PII utente finale | email, nome, indirizzo, CF | GDPR + business contract |
| 7 | Free-text lungo (>200 caratteri) | narrative, commit message lunghi | Può inadvertently contenere categorie 1-6 |

**Vincolo invariante**: la blocklist è **MAI overridabile** senza ADR esplicito. Pattern
parallelo a R.C1 di compression (invarianti non overridabili) e alla policy dati
`<<policy_dati>>` di PATTERN §3 (k-anonymity N≥5): la privacy è un'invariante, non una
preferenza configurabile.

## §3 — Enforcement

> Il tool `record-event.sh`
> ([`.claude/tools/analytics/record-event.sh`](../.claude/tools/analytics/record-event.sh),
> EP-009 US-033 + estensione TSK-104 v2.19) **rifiuta** i payload che violano la
> blocklist con **exit code 1 + messaggio strutturato** su stderr. La validazione è
> **pre-write** (fail-loud al chiamante, non post-hoc): mai una scrittura di payload
> non-conforme. Pattern **fail-closed applicato alla privacy** (ADR-040 §C).
> [^src: design_&_architecture/decisions/ADR-040.md §C]

Caratteristiche dell'enforcement (cross-link al tool esteso in TSK-104):

- **Allowlist-strict**: ogni chiave top-level del JSON DEVE essere in `ALLOWED_KEYS`,
  altrimenti `fail_pii_violation "key '<KEY>' not in allowlist (ADR-040 §A)"`.
- **Free-text fence (cat 7)**: i campi testuali ammessi (`aborted_reason`,
  `blocked_reason`) sono troncati a un limite hard di 200 caratteri; oltre → fail-loud.
- **Pattern-based blocklist (cat 1-5)**: regex conservative su API key, token, password,
  prompt/system, PEM private key, hash di segreti.
- **Email fence (cat 6)**: email accettata SOLO dentro `actor_id` (GitHub handle/email
  convenzione); email altrove → fail-loud.
- **Fail-loud su tool, fail-open su workflow** (ADR-039 §D): il chiamante
  (dev-protocol / scheduler) cattura l'errore e logga un `ERROR` in `wiki/log.md`
  («PII boundary violation, bug del chiamante»); il workflow prosegue, l'evento non
  conforme non viene scritto.

## §4 — Audit

> Chiunque può fare grep su `analytics/events/*.jsonl` cercando pattern PII:
>
> ```bash
> grep -Ei "(content|prompt|api_key|password|email|@.*\.com)" analytics/events/*.jsonl
> ```
>
> Assenza di match = invariante rispettata. Il runbook
> [`analytics-dogfooding-runbook.md`](../wiki/runbooks/analytics-dogfooding-runbook.md)
> (US-054, TSK-108) include il comando `/analytics validate` per la verifica
> sistematica (candidato v2.20+; in v2.19 gli audit grep sono manuali, cron settimanale
> opzionale).

Grep di audit aggiuntivi documentati (ADR-040 §D):

```bash
# Secrets / private keys anywhere
grep -rE '(BEGIN [A-Z ]+PRIVATE KEY|"password":|"[A-Z_]+_KEY":)' analytics/events/ \
  && echo "PII LEAK DETECTED" || echo "audit clean"

# Email fuori da actor_id
grep -rE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' analytics/events/ | \
  grep -vE '"actor_id":"[^"]*@[^"]*"' \
  && echo "EMAIL LEAK DETECTED" || echo "audit clean"

# Free-text >200 char
jq -r '. | to_entries[] | select(.value | type == "string" and length > 200)' \
  analytics/events/*.jsonl
```

> Nota retention/gitignore: `analytics/events/` è **gitignorato** (dati operativi, commit
> selettivo opt-in — vedi [`.gitignore`](../.gitignore) e ADR-021). Gli eventi non sono
> versionati di default: questo riduce la superficie di leak (non finiscono nella history
> git) e mantiene il repo pulito da dati di telemetria. Per report human-readable derivati
> dagli eventi vale la soglia **k-anonymity N≥5** (PATTERN §3 `<<policy_dati>>`): nessuna
> metrica per-actor è pubblicabile se il bucket aggrega meno di 5 occorrenze, per evitare
> de-anonimizzazione di chi-ha-fatto-cosa.

## §5 — Override per casi documentati

> **Nessun override default.** Se una capability futura ha bisogno di registrare campi
> extra, DEVE aggiungere il campo esplicitamente all'allowlist §1 via **ADR**, con:
>
> 1. un nuovo ADR che aggiorna l'allowlist §1 (campo specifico);
> 2. il rationale (perché il campo è safe);
> 3. l'aggiornamento del tool `record-event.sh` (sezione `ALLOWED_KEYS`).
>
> Pattern parallelo a R.C1 (compression: invarianti non overridabili senza ADR) e ad
> ADR-032 §H (versioning criteri). No creep silente. [^src: ADR-040 §E]

## §6 — Cross-link con EP-012 e EP-017

> I metadati `same_author` / `same_machine` / `same_factory` di EP-012 US-049
> (RUN-REPORT §8) acquisiscono significato quando EP-017 produce una **seconda persona**
> che genera eventi. PRIVACY.md cita EP-017 come dipendenza per la mitigation del bias
> di campione (eventi prodotti da un solo autore/macchina/factory sono statisticamente
> deboli per i confronti agentic-vs-baseline).

## Cross-link con altre capability

- **EP-014** è il consumer naturale di questi eventi (reporting/insight); PRIVACY.md
  ne è il prerequisito di conformità.
- **EP-017** (audience esterna) è la dipendenza per la diversità di campione (§6).
- **Cross-EP gate** (ADR-040 §F): il `release-validation-gate` (ADR-033 §D Step 3)
  fallisce un RUN-REPORT con `analytics_events_count == 0` quando
  `analytics.dogfooding.enabled: true` («run senza ground truth»). Conditional su
  dogfooding enabled, coerente con R.P3.
- Runbook operativo: [`analytics-dogfooding-runbook.md`](../wiki/runbooks/analytics-dogfooding-runbook.md)
  (US-054, TSK-108).
