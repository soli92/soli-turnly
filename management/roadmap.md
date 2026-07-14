---
type: roadmap
project: soli-turnly
created: 2026-07-14
updated: 2026-07-14
release: "1.0"
---

# Roadmap — soli-turnly

Roadmap di Release 1.0 derivata dall'analisi della wiki di dominio.
Epiche ordinate per valore e dipendenza tecnica; le epiche senza `depends_on`
possono essere avviate in parallelo.

[^src: wiki/syntheses/requisiti-funzionali.md §RF-A..RF-N]

---

## Release 1.0 — Funzionalità Core

### Wave A — Fondazione (parallelizzabile)

| EP | Titolo | Priority | Confidence | Depends on |
|---|---|---|---|---|
| EP-001 | Autenticazione e Gestione Ruoli | high | 95% | — |
| EP-002 | Anagrafica Dipendenti e Qualifiche | high | 95% | EP-001 |
| EP-003 | Tipologie di Turno | high | 95% | EP-001 |

### Wave B — Pianificazione Admin (dopo Wave A)

| EP | Titolo | Priority | Confidence | Depends on |
|---|---|---|---|---|
| EP-004 | Matrice Turni Admin | high | 90% | EP-001, EP-002, EP-003 |
| EP-007 | Gestione Assenze Admin | high | 92% | EP-002 |
| EP-008 | Fabbisogni di Copertura | medium | 90% | EP-002, EP-003 |

### Wave C — Funzionalità Avanzate Admin (dopo Wave B)

| EP | Titolo | Priority | Confidence | Depends on |
|---|---|---|---|---|
| EP-005 | Ricorrenze e Cicli Rotativi | high | 85% | EP-004 |
| EP-006 | Scambio Turni Admin | high | 88% | EP-004 |
| EP-009 | Straordinari e Report Ore | medium | 90% | EP-004 |

### Wave D — Esperienza Dipendente (dopo Wave B)

| EP | Titolo | Priority | Confidence | Depends on |
|---|---|---|---|---|
| EP-011 | Calendario e Profilo Dipendente | high | 92% | EP-004 |
| EP-012 | Richieste Dipendente e Workflow Approvazione | high | 88% | EP-006, EP-007, EP-011 |

### Wave E — Operatività e Chiusura (dopo Wave C+D)

| EP | Titolo | Priority | Confidence | Depends on |
|---|---|---|---|---|
| EP-010 | Dashboard Admin | high | 85% | EP-007, EP-008, EP-009, EP-012 |
| EP-013 | Notifiche In-App | high | 85% | EP-012 |

---

## Epiche < 50% confidence — Release 1.1+

Nessuna epica al di sotto della soglia in questa iterazione.

---

## Gap aperti che impattano la roadmap

| Gap | Descrizione | Impatto |
|---|---|---|
| G-001 | Stack tecnologico non prescritto | Neutro per PM — la roadmap è tech-agnostica |
| G-002 | Mockup Figma non disponibili | EP-004, EP-011 possono partire dalla spec funzionale; la validazione UX/UI richiederà i mockup |
| G-003 | Tabelle `availability` e `coverage_requirements` non in TSK-002 | Da coprire con un TSK aggiuntivo wave 2+ |

[^src: wiki/gaps.md §Gap di conoscenza]
