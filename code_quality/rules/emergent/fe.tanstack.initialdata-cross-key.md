---
rule_id: fe.tanstack.initialdata-cross-key
title: "initialData non deve essere condivisa tra query key diverse"
tier: emergent
status: candidate
severity: medium
stack: [typescript, react, tanstack-query]
auto_fixable: false
created_by: code-reviewer
created_at: 2026-07-14
proposed_from: [TSK-021]
---

## Rationale

`initialData` in TanStack Query semina la cache per la query key corrente e, in
assenza di `initialDataUpdatedAt`, è trattata come fresca fino a `staleTime`. Se le
opzioni con `initialData` sono memoizzate una sola volta e passate a un hook la cui
query key cambia (es. navigazione tra periodi/pagine), lo stesso `initialData` viene
applicato a TUTTE le key: la nuova key mostra dati appartenenti alla key iniziale e
non refetcha finché non scade `staleTime`. Risultato: dati errati (di un altro
periodo/entità) mostrati all'utente.

Il sintomo è spesso mascherato da un `// eslint-disable-next-line react-hooks/exhaustive-deps`
sul `useMemo` delle opzioni.

## Detection

- `useMemo(() => ({ initialData }), [])` passato a un hook con query key variabile.
- `initialData` staticamente uguale per range/paginazione differenti.

## Remediation

- Legare `initialData` alla key iniziale (fornirla solo quando i parametri coincidono
  con quelli del fetch server-side) oppure usare `queryClient.setQueryData(key, data)`
  in fase di hydration.
- In alternativa fornire `initialDataUpdatedAt` per forzare la valutazione di
  staleness, o preferire `placeholderData` quando il dato è solo di transizione.
