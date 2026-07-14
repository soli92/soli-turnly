---
rule_id: fe.react.radix-select-empty-value
title: "Radix Select.Item non deve avere value=\"\""
tier: emergent
status: candidate
severity: high
stack: [typescript, react, radix-ui, shadcn]
auto_fixable: false
created_by: code-reviewer
created_at: 2026-07-14
proposed_from: [TSK-023]
---

## Rationale

Radix UI `<Select.Item>` (base di shadcn/ui `SelectItem`) vieta esplicitamente il
valore stringa vuota: la stringa vuota è riservata per "clear selection" e mostrare il
placeholder. Renderizzare `<SelectItem value="">` fa lanciare a runtime:

> A `<Select.Item />` must have a value prop that is not an empty string.

L'errore viene sollevato quando il `SelectContent` viene montato (apertura del
dropdown). Un item disabilitato con `value=""` usato come stato "vuoto/nessun dato"
è comunque un anti-pattern: se il trigger non è disabilitato, l'apertura del menu
fa crashare il componente.

## Detection

- `SelectItem value=""` (anche `disabled`).
- Opzione "nessuna selezione" implementata con value vuoto.

## Remediation

- Stato vuoto: NON renderizzare alcun `SelectItem`; usare `placeholder` sul
  `SelectValue` e mostrare un messaggio separato fuori dal `Select`, oppure
  disabilitare il trigger.
- Opzione "nessun cambio / nessuno": usare un valore sentinella non vuoto
  (es. `"__none__"`) e normalizzarlo a `undefined`/`null` prima del submit.
