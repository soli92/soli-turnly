---
id: migration-v26
type: runbook
title: "Migrazione v2.5 → v2.6 (gate graduato + propagate + auto-promotion)"
status: draft
created: 2026-05-20
updated: 2026-05-20
sources:
  - "PATTERN.md §3, §7 r.9, §10, §13"
  - "meta-prompt-llm-wiki-factory.md (v2.6)"
related:
  - patch-v26-soft-gate-state-propagation
  - migration-v22
  - thin-agents-fat-skills-refactor
tags: [runbook, migration, v2.6, gate, propagate, auto-promotion]
---

# Migrazione v2.5 → v2.6 — gate graduato, state propagation, auto-promotion

> Playbook riproducibile della migrazione applicata in data 2026-05-20 sul repo
> `soli-multi-agents-factory`. Versione precedente archiviata in
> `meta-prompt-llm-wiki-factory-v2.5.md`.

## Sintesi

| Voce | Prima (v2.5) | Dopo (v2.6) |
|---|---|---|
| Gate L4 (PATTERN.md §7 r.9) | binario (`status: open` blocca tutto) | graduato (`blocking_level: hard\|soft` per Q) |
| Operazioni canoniche (§3) | 7 (Ingest, Query, Lint, Plan, Design, Execute, Promote, Heal) | 8 (+ `Propagate`) |
| Skill `.claude/skills/` | 14 | 15 (`+propagate-resolution`) |
| Stato US blocked_by una sola Q risolta | `blocked` indefinitamente | marker `reconcile-needed` in log + segnalazione in `/run` |
| Promotion suggerimenti | nessuno | concept page citate da ≥ 2 US committed → suggerite in dashboard |
| Lint checks | 4 | 5 (+ Check 4b — Coerenza Q ↔ kanban) |

## Pre-condizioni

1. Pattern version corrente = v2.5.
2. Backup esistente: `meta-prompt-llm-wiki-factory-v2.5.md` archiviato accanto
   al canonical.
3. Tag git suggerito (manuale): `pre-v26-migration-2026-05-20` (non richiesto
   dal framework, utile per rollback).

## Procedura (10 step, ~30 minuti su repo medio)

### 1. Archivio canonical pre-bump

```bash
cp meta-prompt-llm-wiki-factory.md meta-prompt-llm-wiki-factory-v2.5.md
```

Idempotente. Se l'archivio esiste, il sistema procede comunque.

### 2. Bump `PATTERN.md` a v2.6

Edit chirurgici su file esistente, mai overwrite:

- §0 Identità & versione: `2.5` → `2.6`
- Titolo header: `v2.5` → `v2.6`
- §3 Operazioni canoniche: aggiungi `Propagate` come 8° verbo
- §7 r.9: riscrivi come gate graduato (`hard | soft`)
- §10 tabella eventi: 2 nuove righe (Auto-promotion suggerita, Gap chiuso →
  reconcile-needed)
- §13 Versioning: prepend entry v2.6 (descrizione N1+N2+N4)

### 3. Adapter — skill `apri-question.md`

- Aggiungi campo `**Bloccante:** hard | soft` nel template Entry.
- Sezione esplicativa: differenza hard vs soft, regola pratica.
- Effetti collaterali: Q hard → US `blocked` + `blocked_by`; Q soft → US
  `ready` + `pending_clarification`.

### 4. Adapter — skill `propagate-resolution.md` (NUOVA)

Crea da template (vedi meta-prompt-llm-wiki-factory.md §7).
La skill:
1. Identifica Q chiuse contestualmente al gap.
2. Grep delle US ancora con `blocked_by`/`pending_clarification` stale.
3. Append marker `reconcile-needed: US-YYY → Q_NNN closed` a `wiki/log.md`.
4. Surface lista in chat.
5. **MAI** scrittura su `management/kanban/**`.

### 5. Adapter — agent `wiki-keeper.md`

- Aggiungi alla sezione `## Procedura` il riferimento a `propagate-resolution`
  da invocare alla chiusura di un gap che cita una `Q_NNN`.

### 6. Adapter — agent `lead-architect.md`

- Riscrivi `## Gate` come graduato: Q hard → STOP, Q soft → procede annotando
  `pending_clarification:` su ADR.
- Frontmatter ADR: aggiungi campo opzionale `pending_clarification: [Q_NNN, ...]`.

### 7. Adapter — skill `state-scan.md`

- Passo 4 (L3 gate): riscrivi come graduato.
- Aggiungi passo 6 (Reconcile-needed pendenti): grep `reconcile-needed` in
  log, verifica US ancora stale.
- Aggiungi passo 7 (Auto-promotion candidates): concept citate da ≥ 2 US
  committed/in-progress.
- Heuristica next-step: 9 priorità (era 8), con `reconcile-needed` come
  priorità 1.

### 8. Adapter — skill `wiki-log-entry.md` + `lint-checks.md`

- `wiki-log-entry`: aggiungi template `reconcile-needed`.
- `lint-checks`: aggiungi Check 4b (Coerenza Q ↔ kanban) con 3 warning
  (`missing-blocking-level`, `stale-blocked-by`, `orphan-pending-clarification`).
  Nessuno è `heal-eligible`.

### 9. Adapter — skill `scrivi-user-story.md`

- Frontmatter: aggiungi campo opzionale `pending_clarification: []`.
- Sezione esplicativa: `blocked_by` (Q hard) vs `pending_clarification` (Q soft).

### 10. Meta-prompt e wiki

- Aggiorna `meta-prompt-llm-wiki-factory.md` v2.5 → v2.6 in tutti i punti
  embedded: §1 r.9, §5 (PATTERN.md template), §5b (CLAUDE.md template), §7
  (skill templates), §8 scaffolding checklist, §12 changelog (prepend v2.6).
- Scrivi `wiki/syntheses/patch-v26-soft-gate-state-propagation.md` (sintesi
  del razionale).
- Scrivi questo file `wiki/runbooks/migration-v26.md` (playbook).
- Aggiorna `wiki/index.md` con i due nuovi link.
- Append entry `migration` a `wiki/log.md`.

## Post-condizioni (verifica)

```bash
# 1. PATTERN.md aggiornato
grep "^Pattern version" PATTERN.md           # → 2.6

# 2. Skill nuova esiste
ls -1 .claude/skills/propagate-resolution.md  # presente

# 3. apri-question ha blocking_level
grep "Bloccante:" .claude/skills/apri-question.md  # 2+ hit (template + esempio)

# 4. lead-architect gate graduato
grep -c "blocking_level\|hard\|soft" .claude/agents/lead-architect.md  # > 3

# 5. state-scan ha 8 passi
grep "^### [0-9]\." .claude/skills/state-scan.md | wc -l  # = 8

# 6. wiki/syntheses + runbook esistono
ls wiki/syntheses/patch-v26-soft-gate-state-propagation.md
ls wiki/runbooks/migration-v26.md

# 7. wiki/log.md ha entry migration v2.6
grep "migration.*v2\.6" wiki/log.md  # 1 hit
```

Tutti i check sopra → migrazione OK.

## Rollback

Tre opzioni:

1. **Restore meta-prompt v2.5:** `cp meta-prompt-llm-wiki-factory-v2.5.md
   meta-prompt-llm-wiki-factory.md`. Non rollback PATTERN.md né adapter.
2. **Git revert:** `git revert <commit-v2.6>`. Tutto torna a v2.5,
   `wiki/log.md` cresce con un entry `policy — revert v2.6`.
3. **No-op tolerance:** lascia i file v2.6 ma non sfruttare i nuovi campi.
   La default `blocking_level: hard` rende il comportamento identico a v2.5
   per le Q esistenti, e i marker `reconcile-needed` sono inerti se non
   esistono gap che chiudono Q.

L'opzione 3 è il "soft rollback" preferibile: nessun lavoro perso, ritorno
graduale possibile.

## Trade-off documentati

| Decisione | Razionale |
|---|---|
| Default `blocking_level: hard` (retroattivo) | Compatibilità con Q legacy senza il campo |
| Lint emette `WARNING` non `ERROR` per `missing-blocking-level` | Permette migrazione incrementale del kanban |
| Marker `reconcile-needed` mai chiusi esplicitamente | Idempotenza via ricalcolo da filesystem |
| Propagate non scrive sul kanban | Preserva write-scope §2 (proprietà PM) |
| Auto-promotion solo suggerimento | Preserva regime LLM-trust + umano-in-loop |
| Soglia auto-promotion = 2 US committed | Bilanciamento falsi positivi vs ritardo segnalazione |

## Pagine collegate

- [[patch-v26-soft-gate-state-propagation]] — synthesis con razionale completo
- [[migration-v22]] — runbook di riferimento (struttura analoga)
- [[thin-agents-fat-skills-refactor]] — runbook v2.3 (storico)
- [[multi-agent-factory]] — architettura complessiva
- [[feedback-loop-gate]] — concept correlato
