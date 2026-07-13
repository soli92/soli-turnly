---
type: source
title: "Turnly — Documento Funzionale"
status: draft
created: 2026-07-13
source_path: raw/turnly-documento-funzionale.md
ingested_by: wiki-keeper
---

# Turnly — Documento Funzionale (sorgente)

Documento funzionale originale dell'applicazione **Turnly** per la gestione dei turni di lavoro.

## Metadati sorgente

| Campo | Valore |
|---|---|
| File | `raw/turnly-documento-funzionale.md` |
| Tipo | Documento funzionale (specifica input per sviluppo automatico) |
| Data ingest | 2026-07-13 |
| Sezioni | 13 (§1 contesto, §2 ruoli, §3 glossario, §4 modello dati, §5 RF, §6 RB, §7 flussi, §8 notifiche, §9 RNF, §10 schermate, §11 test, §12 parametri, §13 assunzioni) |

## Copertura wiki derivata

| Pagina wiki | Sezioni coperte |
|---|---|
| [[dominio-turnazione]] | §1, §3 |
| [[ruoli-e-permessi]] | §2 |
| [[regole-di-business]] | §6, §12 |
| [[modello-dati-turnly]] | §4 |
| [[requisiti-funzionali]] | §5, §8 (notifiche), §10 (schermate) |
| [[flussi-principali]] | §7 |
| [[casi-di-test]] | §11 |
| [[requisiti-non-funzionali]] | §9, §13 |

## Nota

Il documento descrive *cosa* costruire (specifica funzionale), non prescrive stack tecnologico o architettura implementativa. La logica turni è **Avanzata** (ricorrenze/cicli, scambio turni, straordinari, vincoli riposo/ore/coperture, rilevamento conflitti). Il self-service dipendente opera su due livelli: scrittura diretta sui propri dati personali (profilo — campi consentiti — e disponibilità) e richieste con workflow di approvazione per azioni sulla pianificazione.

[^src: raw/turnly-documento-funzionale.md §Turnly — Documento Funzionale]
