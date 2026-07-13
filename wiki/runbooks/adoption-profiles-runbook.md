---
status: current                    # promosso da draft 2026-06-08 (mappatura approvata maintainer @soli92, TSK-123 done)
capability: EP-016
adr: [ADR-052, ADR-053, ADR-054]
pattern_ref: PATTERN §23.7
owner: "@soli92"
updated: 2026-06-08
---

# Runbook: Profili di adozione del PATTERN

Il PATTERN è un file unico; i "profili" sono **viste filtrate** dello stesso file via
tag inline `<!-- profiles: ... -->` sotto ogni header `## §N` + comando `/pattern-view`.
Mappatura applicata a `PATTERN.md` il 2026-06-08 (TSK-123). Scheda canonica: `PATTERN §23.7`.

## Cosa risolve

Onboarding: un nuovo utente non affronta 22+ sezioni. `/pattern-view minimal` mostra ~8
sezioni (core knowledge-only/plan-only); `standard` ~14; `full` tutto. Single source of
truth: il PATTERN resta unico, i profili sono filtri (§8 — mai copie materializzate).

## Mappatura applicata sezione → profilo

| Sezione | minimal | standard | full | Nota |
|---|:---:|:---:|:---:|---|
| §0 Identità & versione | ✓ | ✓ | ✓ | |
| §1 Modello a layer | ✓ | ✓ | ✓ | |
| §2 Ruoli | ✓* | ✓ | ✓ | *minimal = 5 ruoli core |
| §3 Operazioni canoniche | ✓* | ✓ | ✓ | *minimal = 5 op core |
| §4 Naming conventions | | ✓ | ✓ | |
| §5 Frontmatter | ✓* | ✓ | ✓ | *minimal = campi core |
| §6 Grammatica citazioni | | ✓ | ✓ | |
| §7 Regole inviolabili | ✓* | ✓ | ✓ | *minimal = ~6 invarianti core |
| §8 State derivation | | | ✓ | |
| §9 Memoria cross-conv | | | ✓ | |
| §10 Wiki maintenance | | | ✓ | |
| §11 Standards as constraints | | | ✓ | |
| §12 Adapter | | | ✓ | |
| §13 Topology & routing | ✓* | ✓ | ✓ | *minimal = knowledge-only/plan-only |
| §14 Tech stack modes | | | ✓ | |
| §15 VCS integration | | | ✓ | |
| §16 Sync adapters | | ✓ | ✓ | base in standard |
| §17 Publisher adapters | | | ✓ | |
| §18 Parallel scheduling | | ✓ | ✓ | incl. §18.8 budget + consistency-check |
| §19 Code Quality Review | | ✓ | ✓ | |
| §20 Compression layer | | | ✓ | |
| §21 Versioning | | ✓ | ✓ | |
| §22 Release Governance *(TSK-100 pending)* | | ✓ | ✓ | esisterà dopo TSK-100 |
| §23 Complexity Budget | ✓ | ✓ | ✓ | self-referential |

Conteggio: **minimal 8 · standard 14 · full ~22** (→ 19-21 dopo eventuale rimozione TSK-126).
I subset intra-sezione (`*`) sono descritti a parole in `PATTERN §23.7` (granularità fine
per sub-sezione `###` rinviata a v2.20+, ADR-054 §F).

## Comandi (vedi `.claude/commands/pattern-view.md`)

- `/pattern-view minimal` — sezioni del profilo minimal (+ note di subset).
- `/pattern-view standard` / `full` — idem.
- `/pattern-view list` — tabella sezioni × profili.
- `/pattern-view historical` — rimanda a `PATTERN-historical.md` (sezioni deprecate, TSK-126).

## Manutenzione

- Aggiungere/spostare una sezione tra profili = editare il tag `<!-- profiles: ... -->`
  sotto il suo header in `PATTERN.md` + aggiornare la tabella qui e la scheda §23.7.
- Coerenza con la regola N:1 (§23.1): l'aggiunta di sezioni va bilanciata da deprecazioni.

## Cross-link

- PATTERN §23.7 (scheda profili) + §23 (Complexity Budget) — ADR-052/053/054.
- EP-017 PATTERN-in-1-pagina (TSK-131): mappatura 1:1 col profilo `minimal`.
- [[complexity-budget-runbook]].
