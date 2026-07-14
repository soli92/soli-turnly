---
rule_id: general.dead-broken-code
title: "Nessun componente/modulo orfano o non compilabile a runtime nel deliverable"
tier: emergent
status: candidate
severity: medium
stack: [typescript, react]
auto_fixable: false
created_by: code-reviewer
created_at: 2026-07-14
proposed_from: [TSK-022]
---

## Rationale

Codice non referenziato da alcun entry-point ("orfano") aumenta il costo di
manutenzione, confonde i lettori sul contratto reale (quale componente è "quello
giusto"?) e maschera regressioni: se il file orfano è anche disallineato al modello di
dominio corrente (tipi/enum obsoleti, campi inesistenti), la sua sola presenza suggerisce
un contratto che non esiste più. Va rimosso o reintegrato esplicitamente.

## Detection

- Componente/hook/modulo senza import entranti in tutto il code path.
- Uso di campi/enum non più presenti nel tipo importato (es. proprietà rimossa dal
  modello dati) → indica codice non allineato e mai eseguito.

## Remediation

- Eliminare il file orfano, oppure ricollegarlo e aggiornarlo al modello di dominio
  corrente se ancora necessario.
