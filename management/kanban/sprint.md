<!-- generated, do not edit — rigenerato da TPM-agent, 2026-07-14 -->
---
sprint_current: 3
sprint_lookahead: 4
generated: 2026-07-14
total_tsk_current: 7
total_tsk_lookahead: 0
---

# Sprint Plan — soli-turnly

## Sprint 1 — Infrastruttura (COMPLETATO)

Tutte le 12 task di Sprint 1 sono `done`.

| TSK | Titolo | Layer | Consumer | Stima | Stato |
|---|---|---|---|---|---|
| TSK-001 | Next.js + Drizzle + shadcn/ui Scaffolding | be+fe | agent | S | done |
| TSK-002 | Database Schema & Migrations | db | agent | M | done |
| TSK-003 | Auth.js v5 + Session + RBAC Middleware | be | agent | M | done |
| TSK-004 | API Skeleton — Route Handlers REST | be | agent | L | done |
| TSK-005 | Matrice Admin — TanStack Table Grid | fe | agent | L | done |
| TSK-006 | Business Rules Engine RB-01..RB-17 | be | agent | L | done |
| TSK-007 | Frontend Forms & Zod Validation | fe | agent | M | done |
| TSK-008 | Notifications Layer SSE | be | agent | M | done |
| TSK-009 | Audit Log & Background Jobs (Inngest) | be | agent | M | done |
| TSK-010 | Acceptance Spec Playwright E2E | qa | agent | M | done |
| TSK-011 | A11y WCAG 2.2 AA (EP-007) | qa | agent | M | done |
| TSK-012 | Code Quality Gate CQRL v2.12 | qa | agent | S | done |

---

## Sprint 2 — UI Pages (COMPLETATO)

**Obiettivo:** implementare tutte le pagine UI mancanti per admin e dipendente.
**Note:** chiude gap G-003 (TSK-013 — tabelle DB mancanti rispetto ad ADR-001).

### Wave 1 — DB gap + Admin base pages

| TSK | Titolo | Layer | Consumer | Stima | Stato | Depends on |
|---|---|---|---|---|---|---|
| TSK-013 | DB migration: availability, coverage_requirements, swap_operations | db | agent | S | done | TSK-002 |
| TSK-014 | Dashboard Admin — KPI operativi + inbox richieste | fe | agent | M | done | TSK-004 |
| TSK-015 | Tipologie di turno — CRUD + form modal | fe | agent | S | done | TSK-004 |
| TSK-016 | Anagrafica dipendenti — CRUD tabella + form modal | fe | agent | M | done | TSK-004 |

### Wave 2 — Admin workflow pages

| TSK | Titolo | Layer | Consumer | Stima | Stato | Depends on |
|---|---|---|---|---|---|---|
| TSK-017 | Gestione assenze — registrazione + conflict resolution | fe | agent | M | done | TSK-004, TSK-013 |
| TSK-018 | Fabbisogni/copertura — setup minimi + monitor sotto-copertura | fe | agent | M | done | TSK-004, TSK-013 |
| TSK-019 | Ricorrenze/cicli — wizard 3 step + anteprima | fe | agent | L | done | TSK-009 |
| TSK-020 | Coda richieste/approvazioni — inbox + approval detail | fe | agent | L | done | TSK-004, TSK-007 |

### Wave 3 — Employee core pages

| TSK | Titolo | Layer | Consumer | Stima | Stato | Depends on |
|---|---|---|---|---|---|---|
| TSK-021 | Calendario dipendente — React Big Calendar + export .ics | fe | agent | L | done | TSK-004 |
| TSK-022 | Le mie richieste — lista stato + accetta/rifiuta scambio | fe | agent | M | done | TSK-004 |

### Wave 4 — Employee form + QA

| TSK | Titolo | Layer | Consumer | Stima | Stato | Depends on |
|---|---|---|---|---|---|---|
| TSK-023 | Nuova richiesta multi-step — 4 tipi (assenza/scambio/turno/modifica) | fe | agent | L | done | TSK-007, TSK-022 |
| TSK-024 | E2E acceptance Sprint 2 — nuove pagine UI (Playwright) | qa | agent | M | done | TSK-014..TSK-023 |

---

## Sprint 3 — Polish & Ops (CORRENTE)

**Obiettivo:** completare disponibilità dipendente, swap admin, report ore, centro
notifiche, email templates, visual regression/A11y, e formalizzare l'endpoint .ics.

**Dependency graph:**
- Wave 1 (parallelizzabile, max 3): TSK-031, TSK-025, TSK-026
- Wave 2 (dopo Wave 1): TSK-027, TSK-028, TSK-029
- Wave 3 (seriale, dopo Wave 2): TSK-030

**Note dipendenze intra-sprint:**
- TSK-031 (be endpoint .ics) in Wave 1 per garantire che il CalendarToolbar di TSK-021 sia
  testato prima di TSK-030 (visual regression).
- TSK-029 (email templates) dipende da TSK-028 (notifiche page) per assicurare che i
  dispatch endpoint siano già implementati.
- TSK-030 dipende da TSK-025..TSK-028 per coprire le pagine Sprint 3 nei visual test.

### Wave 1 — Endpoint BE + pagine self-service (parallelizzabile)

| TSK | Titolo | Layer | Consumer | Stima | Stato | Depends on |
|---|---|---|---|---|---|---|
| TSK-031 | .ics export endpoint — verifica npm, integration test | be | agent | S | todo | TSK-004, TSK-021 |
| TSK-025 | Disponibilità dipendente — page + API GET/POST/DELETE | fe+be | agent | M | todo | TSK-004, TSK-013 |
| TSK-026 | Swap admin page — selezione turni + anteprima + POST /api/admin/swap | fe+be | agent | L | todo | TSK-004, TSK-007, TSK-013 |

### Wave 2 — Features dipendenti da Wave 1 (parallelizzabile)

| TSK | Titolo | Layer | Consumer | Stima | Stato | Depends on |
|---|---|---|---|---|---|---|
| TSK-027 | Report straordinari page + API GET /api/admin/reports/overtime | fe+be | agent | M | todo | TSK-004, TSK-006, TSK-013 |
| TSK-028 | Centro notifiche page + NotificationBell potenziamento | fe | agent | M | todo | TSK-008, TSK-004 |
| TSK-029 | Email notification templates React Email + dispatch Inngest | be | agent | M | todo | TSK-009, TSK-028 |

### Wave 3 — QA (dopo Wave 2)

| TSK | Titolo | Layer | Consumer | Stima | Stato | Depends on |
|---|---|---|---|---|---|---|
| TSK-030 | Visual regression + A11y Sprint 2+3 (EP-005, EP-007) | qa | agent | L | todo | TSK-021..TSK-024, TSK-025..TSK-028 |

---

## Riepilogo stima Sprint 3

| Stima | Count | Task |
|---|---|---|
| S | 1 | TSK-031 |
| M | 4 | TSK-025, TSK-027, TSK-028, TSK-029 |
| L | 2 | TSK-026, TSK-030 |
| **Totale** | **7** | 3 wave |

## Gap chiusi in Sprint 2

| Gap | Chiuso da |
|---|---|
| G-003: tabelle DB mancanti (availability, coverage_requirements, swap_operations) | TSK-013 |

## Note tecniche Sprint 3

| Task | Layer effettivo | Nota |
|---|---|---|
| TSK-025 | fe+be | availability API è stub 501 → richiede implementazione BE |
| TSK-026 | fe+be | POST /api/admin/swap è stub 501 con TODO RB-10 → richiede BE |
| TSK-031 | be | endpoint già scaffolded in TSK-004; task verifica npm dep + test |
| TSK-029 | be | sendNotificationEmail.ts esiste, template HTML inline → upgrade React Email |
