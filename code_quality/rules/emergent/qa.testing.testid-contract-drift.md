---
rule_id: qa.testing.testid-contract-drift
title: "I selettori dei test devono corrispondere ai contratti reali del componente"
tier: emergent
status: candidate
severity: high
stack: [typescript, playwright]
auto_fixable: false
created_by: code-reviewer
created_at: 2026-07-14
proposed_from: [TSK-024]
---

## Rationale

Un test E2E che referenzia un `data-testid`/ruolo inesistente nel componente sotto test
non verifica nulla: nel migliore dei casi fallisce in CI (timeout), nel peggiore dà una
falsa sicurezza se combinato con rami tolleranti. Il testid è un contratto tra
componente e test: va mantenuto allineato. Inoltre un test deve percorrere il flusso
reale dell'utente (es. tutti gli step di un wizard), non saltare passaggi intermedi.

## Detection

- `getByTestId('X')` dove `X` non esiste in nessun componente della pagina esercitata
  (o esiste solo in un componente diverso/legacy).
- Flusso multi-step che non attraversa gli step intermedi obbligatori prima
  dell'azione finale.

## Remediation

- Allineare il selettore al testid effettivo del componente target.
- Percorrere tutti gli step del flusso (es. avanzare step 2 → step 3 prima di
  cercare il bottone di conferma).
- Considerare un file di costanti condivise per i testid critici, importato sia dal
  componente sia dal test.
