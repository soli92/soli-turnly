---
rule_id: fe.next.usesearchparams-suspense
title: "useSearchParams deve essere sotto un confine <Suspense>"
tier: emergent
status: candidate
severity: low
stack: [typescript, react, nextjs]
auto_fixable: false
created_by: code-reviewer
created_at: 2026-07-14
proposed_from: [TSK-023]
---

## Rationale

In Next.js App Router (15.x), un componente client che usa `useSearchParams()` senza
essere avvolto in un `<Suspense>` de-ottimizza l'intera route a CSR e, in
pre-rendering/build statica, produce l'errore "useSearchParams() should be wrapped in a
suspense boundary". Il confine Suspense isola la parte dipendente dai search params e
consente il rendering del resto.

## Detection

- `useSearchParams()` in un componente pagina/foglia senza `<Suspense>` a monte.

## Remediation

- Estrarre la logica che legge i search params in un sotto-componente e avvolgerlo in
  `<Suspense fallback={...}>` dentro la pagina.
