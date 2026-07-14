---
rule_id: qa.testing.hollow-acceptance
title: "Un test di accettazione non deve passare/skippare in modo vacuo"
tier: emergent
status: candidate
severity: medium
stack: [typescript, playwright]
auto_fixable: false
created_by: code-reviewer
created_at: 2026-07-14
proposed_from: [TSK-024]
---

## Rationale

Un test di accettazione ha valore solo se FALLISCE quando la feature verificata è
assente o rotta. Due anti-pattern annullano questo valore:

1. **Skip-guard pervasivo**: `test.skip(true, ...)` su ogni prerequisito mancante
   (seed, endpoint, sessione) trasforma un fallimento in un "verde silenzioso". La
   suite riporta "0 failed" senza aver verificato nulla — particolarmente grave sui
   test di sicurezza (es. T-SEC-08) e sui flussi critici (T-REQ-03).
2. **Assert condizionale che esce prima**: `if (count === 0) { ...; return; }` fa
   passare il test anche quando la condizione centrale dell'AC (es. cella
   sotto-coperta per T-DOM-07) non si verifica mai.

L'AC di progetto richiede fixture deterministiche e "ogni test parte da stato DB
pulito": i prerequisiti devono essere garantiti dal seed, non aggirati a runtime.

## Detection

- `test.skip(true, ...)` usato per prerequisiti di dato/endpoint che dovrebbero essere
  deterministici.
- Ramo `if (empty) { assert-debole; return; }` che salta l'asserzione centrale dell'AC.

## Remediation

- Rendere i prerequisiti deterministici nel seed/fixture; se un prerequisito manca,
  il test DEVE fallire (o essere un errore di setup esplicito), non skippare.
- Asserire direttamente la condizione dell'AC (es. esiste ≥1 cella sotto-coperta con
  deficit atteso), senza rami di uscita anticipata.
