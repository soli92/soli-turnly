---
rule_id: fe.domain.shared-rule-duplication
title: "Non re-implementare regole di dominio / schema condivisi lato FE"
tier: emergent
status: candidate
severity: medium
stack: [typescript, react, zod]
auto_fixable: false
created_by: code-reviewer
created_at: 2026-07-14
proposed_from: [TSK-021, TSK-023]
---

## Rationale

Lo stack di progetto (`raw/tech_stack.md`) impone due invarianti di single-source-of-truth:

1. Le regole di business RB-01..RB-17 vivono in `lib/rules/` come pure function
   invocate SIA dall'API SIA dai form FE.
2. Lo schema Zod è condiviso FE+BE per garantire strutturalmente la parità UI↔API
   (T-INT-01): "un singolo schema Zod usato sia nel form React che nel Route Handler
   garantisce che la stessa regola non diverga tra i due layer".

Re-implementare inline lato FE una regola di dominio (es. calcolo straordinario RB-06)
o definire uno schema Zod locale che duplica il contratto del payload rompe questa
garanzia: le due implementazioni possono divergere silenziosamente nel tempo, con esiti
diversi tra anteprima FE e validazione/persistenza BE.

## Detection

- Logica numerica/temporale di dominio ricalcolata in un componente/hook FE quando
  esiste già una pure function equivalente in `lib/rules/`.
- Schema Zod per-tipo definito localmente in un form quando il contratto dovrebbe
  risiedere in `lib/zod/` ed essere importato anche dal Route Handler.

## Remediation

- Importare e chiamare la pure function di `lib/rules/`; se serve un adattamento per
  aggregazione (es. somma per settimana ISO su un range), incapsularlo in `lib/`.
- Estrarre gli schema del payload per-tipo in `lib/zod/` e riusarli sia nel form
  (`zodResolver`) sia nel Route Handler.
