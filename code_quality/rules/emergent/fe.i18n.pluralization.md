---
rule_id: fe.i18n.pluralization
title: "Pluralizzazione italiana corretta (non concatenare suffissi errati)"
tier: emergent
status: candidate
severity: low
stack: [typescript, react]
auto_fixable: false
created_by: code-reviewer
created_at: 2026-07-14
proposed_from: [TSK-022]
---

## Rationale

Concatenare un suffisso plurale alla forma singolare completa produce parole errate.
`` `${n} richiesta${n !== 1 ? 'e' : ''}` `` genera "1 richiesta" ma "2 richiestae"
(la forma corretta è "richieste": muta la desinenza, non aggiunge una lettera).

## Detection

- Interpolazioni `${parola_singolare}${cond ? 'suffisso' : ''}` per il plurale.

## Remediation

- Selezionare la forma intera per numero: `n === 1 ? 'richiesta' : 'richieste'`.
- Per casi ripetuti, introdurre un piccolo helper di pluralizzazione o `Intl.PluralRules`.
