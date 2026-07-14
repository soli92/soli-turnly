---
type: concept
title: "Dominio Turnazione — Contesto, Obiettivi e Glossario"
status: draft
created: 2026-07-13
source_path: raw/turnly-documento-funzionale.md
ingested_by: wiki-keeper
pattern_section: "§1, §3"
---

# Dominio Turnazione — Contesto, Obiettivi e Glossario

Pagina concettuale centrale per il dominio applicativo di **Turnly**, applicazione web di
gestione turni di lavoro (agenda + calendario + matrice turni).

Vedi anche: [[ruoli-e-permessi]] | [[regole-di-business]] | [[modello-dati-turnly]]

---

## Cos'è Turnly

Applicazione per la pianificazione e la consultazione dei turni di lavoro di un'organizzazione
(es. reparto ospedaliero, punto vendita, reception, produzione). Un **amministratore** costruisce
e mantiene la pianificazione su una matrice dipendenti × giorni; ogni **dipendente** consulta
i propri turni, gestisce i propri dati personali e invia richieste (assenze, scambi, modifiche)
soggette ad approvazione. [^src: raw/turnly-documento-funzionale.md §1.1 Cos'è]

---

## Obiettivi

- Fornire all'admin uno strumento rapido per assegnare, modificare e validare turni, con
  controllo automatico dei vincoli normativi e di copertura.
- Automatizzare la generazione di turni ricorrenti/ciclici e il calcolo degli straordinari.
- Dare a ciascun dipendente una vista chiara dei propri turni, il controllo dei propri dati
  personali e un canale strutturato di richieste con approvazione.
- Impedire pianificazioni non valide (sovrapposizioni, riposi insufficienti, turni durante
  assenze) e segnalare i rischi (sotto-copertura, superamento soglie ore), anche in fase di
  approvazione delle richieste. [^src: raw/turnly-documento-funzionale.md §1.2 Obiettivi]

---

## Perimetro

### In scope

- Autenticazione e gestione ruoli (admin, dipendente).
- Anagrafica dipendenti, qualifiche/mansioni, contratti.
- Tipologie di turno e matrice turni con validazione in tempo reale.
- Ricorrenze/cicli rotativi con gestione eccezioni.
- Scambio turni (swap): eseguibile dall'admin o originato da una richiesta del dipendente.
- Assenze (ferie, malattia, permesso): registrate dall'admin o derivate da richiesta approvata.
- Fabbisogni di copertura per fascia/qualifica.
- Calcolo straordinari e reportistica ore.
- **Self-service dipendente diretto:** modifica del proprio profilo (campi consentiti) e
  gestione di disponibilità/preferenze.
- **Richieste del dipendente con workflow di approvazione:** assenza, scambio turno, nuovo
  turno/copertura, modifica turno.
- **Notifiche** legate al ciclo di vita delle richieste e alle modifiche dei turni.

### Out of scope (estensioni future)

- Multi-sede / multi-tenant.
- Timbrature e rilevazione presenze effettive.
- Integrazione con paghe/HR esterni.
- Scrittura diretta del dipendente sulla pianificazione pubblicata.
- App mobile nativa (la web app deve essere responsive).
- Import massivo da file CSV/Excel.

[^src: raw/turnly-documento-funzionale.md §1.3 Perimetro]

---

## Glossario di dominio

| Termine | Definizione |
|---|---|
| **Turno (Shift)** | Assegnazione di una fascia oraria lavorativa a un dipendente in una data specifica. |
| **Tipologia di turno (ShiftType)** | Modello riutilizzabile con orari, durata, colore ed etichetta (es. *Mattina 06:00–14:00*, *Notte 22:00–06:00*). |
| **Turno notturno / a cavallo di mezzanotte** | Turno la cui ora di fine è precedente all'ora di inizio (attraversa la mezzanotte); la data di fine ricade sul giorno successivo. |
| **Matrice turni** | Griglia dipendenti (righe) × giorni (colonne); ogni cella rappresenta turno, riposo o assenza. |
| **Ricorrenza / Ciclo** | Regola che genera turni ripetuti (es. "ogni lunedì Mattina") o rotazioni (es. ciclo *Mattina → Pomeriggio → Notte → Riposo*). |
| **Assenza (Absence)** | Periodo in cui il dipendente non è disponibile (ferie, malattia, permesso). |
| **Disponibilità / Preferenza (Availability)** | Finestre in cui il dipendente si dichiara disponibile o indisponibile, o esprime una preferenza di turno; vincolo *soft* considerato in pianificazione. |
| **Richiesta (Request)** | Proposta avviata dal dipendente (assenza, scambio, nuovo turno, modifica turno) che segue un ciclo di approvazione gestito dall'admin. |
| **Qualifica / Mansione** | Competenza professionale del dipendente (es. Infermiere, OSS, Cassiere), distinta dal ruolo applicativo (admin/dipendente); usata per le coperture. |
| **Fabbisogno / Copertura (CoverageRequirement)** | Numero minimo di persone di una data qualifica richieste in una fascia oraria. |
| **Straordinario** | Ore lavorate oltre l'orario contrattuale del dipendente. |
| **Swap (Scambio)** | Operazione che scambia due turni tra due dipendenti (o riassegna un turno); eseguibile dall'admin o originata da una richiesta di scambio del dipendente. |

[^src: raw/turnly-documento-funzionale.md §3 Glossario di dominio]

---

## Configurazione della logica turni

La versione descritta dal documento funzionale adotta la logica turni **Avanzata**:
- Ricorrenze/cicli rotativi
- Scambio turni (swap) con accettazione collega
- Straordinari e reportistica ore
- Vincoli di riposo/ore/coperture
- Rilevamento conflitti in tempo reale

Il self-service dipendente opera su due livelli distinti:
1. **Scrittura diretta** — propri dati personali (recapiti, preferenze) e propria disponibilità/preferenze.
2. **Richieste con approvazione** — azioni che toccano la pianificazione (assenza, scambio, nuovo turno, modifica turno). Il dipendente non scrive direttamente sulla pianificazione pubblicata.

[^src: raw/turnly-documento-funzionale.md §Scopo del documento]

---

## Storie collegate

| EP | Titolo | Storie |
|---|---|---|
| [EP-001](../management/kanban/EP-001-autenticazione-ruoli/EP-001.md) | Autenticazione e Gestione Ruoli | US-001, US-002 |
| [EP-002](../management/kanban/EP-002-anagrafica-dipendenti-qualifiche/EP-002.md) | Anagrafica Dipendenti e Qualifiche | US-003, US-004 |
| [EP-003](../management/kanban/EP-003-tipologie-turno/EP-003.md) | Tipologie di Turno | US-005 |
| [EP-004](../management/kanban/EP-004-matrice-turni-admin/EP-004.md) | Matrice Turni Admin | US-006, US-007 |
| [EP-005](../management/kanban/EP-005-ricorrenze-cicli-rotativi/EP-005.md) | Ricorrenze e Cicli Rotativi | US-008, US-009 |
| [EP-006](../management/kanban/EP-006-scambio-turni-admin/EP-006.md) | Scambio Turni Admin | US-010 |
| [EP-007](../management/kanban/EP-007-gestione-assenze-admin/EP-007.md) | Gestione Assenze Admin | US-011 |
| [EP-008](../management/kanban/EP-008-fabbisogni-copertura/EP-008.md) | Fabbisogni di Copertura | US-012 |
| [EP-009](../management/kanban/EP-009-straordinari-report-ore/EP-009.md) | Straordinari e Report Ore | US-013 |
| [EP-010](../management/kanban/EP-010-dashboard-admin/EP-010.md) | Dashboard Admin | US-014 |
| [EP-011](../management/kanban/EP-011-calendario-profilo-dipendente/EP-011.md) | Calendario e Profilo Dipendente | US-015, US-016, US-017 |
| [EP-012](../management/kanban/EP-012-richieste-dipendente-workflow/EP-012.md) | Richieste Dipendente e Workflow | US-018, US-019, US-020 |
| [EP-013](../management/kanban/EP-013-notifiche-in-app/EP-013.md) | Notifiche In-App | US-021 |
