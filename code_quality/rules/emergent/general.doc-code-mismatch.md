---
rule_id: general.doc-code-mismatch
title: "Docstring/commenti non devono dichiarare comportamenti non implementati"
tier: emergent
status: candidate
severity: low
stack: [typescript]
auto_fixable: false
created_by: code-reviewer
created_at: 2026-07-14
proposed_from: [TSK-021, TSK-024]
---

## Rationale

Commenti e docstring sono parte del contratto letto dai manutentori. Quando dichiarano
un comportamento che il codice non implementa (es. "focus trap" che è solo un focus
iniziale; una fixture il cui header dice "seed 3 coverage_requirements + availability +
swap_operation" ma non esegue alcun seeding) inducono in errore, mascherano gap
funzionali e generano falsa fiducia sui prerequisiti dei test.

## Detection

- Docstring che descrive un meccanismo (focus trap, seeding, retry, cache) assente nel
  corpo.
- Header di fixture/helper che elenca dati/setup non prodotti dal file.

## Remediation

- Allineare il commento al comportamento reale, oppure implementare il comportamento
  dichiarato.
- Per le fixture: o eseguire il seed dichiarato, o rimuovere la dichiarazione e
  puntare esplicitamente al modulo che effettua il seed.
