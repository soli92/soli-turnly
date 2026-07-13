---
type: entity
title: "Modello Dati Turnly"
status: draft
created: 2026-07-13
source_path: raw/turnly-documento-funzionale.md
ingested_by: wiki-keeper
pattern_section: "§4"
---

# Modello Dati Turnly

Entità principali del dominio. I tipi indicati sono indicativi; le chiavi/relazioni sono
ciò che conta per l'implementazione.

Vedi anche: [[dominio-turnazione]] | [[regole-di-business]] | [[requisiti-funzionali]]

---

## Utente (User)

| Campo | Tipo / Note |
|---|---|
| `id` | PK |
| `nome`, `cognome` | stringa |
| `email` | univoca |
| `ruolo` | `admin` \| `dipendente` |
| `stato` | `attivo` \| `inattivo` |
| `qualificaId` | FK → Qualifica |
| `oreContrattualiSettimanali` | numero |
| `tipoContratto` | es. full-time, part-time |
| `recapiti` | telefono, email contatto — modificabili dal dipendente |
| `preferenzeContatto` | — modificabili dal dipendente |
| `passwordHash` | — |
| timestamp di audit | — |

**Campi contrattuali/organizzativi** (`qualificaId`, `oreContrattualiSettimanali`,
`tipoContratto`, `ruolo`, `stato`): modificabili **solo dall'admin** (RB-13).

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Utente]

---

## Qualifica (Qualification)

| Campo | Tipo / Note |
|---|---|
| `id` | PK |
| `nome` | stringa |
| `descrizione` | stringa |

Usata per i fabbisogni di copertura. Una qualifica usata da dipendenti o coperture non è
eliminabile senza riassegnazione (RF-B CA3).

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Qualifica]

---

## Tipologia turno (ShiftType)

| Campo | Tipo / Note |
|---|---|
| `id` | PK |
| `nome` | es. "Mattina 06:00–14:00" |
| `oraInizio` | ora |
| `oraFine` | ora |
| `durataMinuti` | derivata; gestisce attraversamento mezzanotte (RB-12) |
| `attraversaMezzanotte` | bool |
| `colore` | per visualizzazione in matrice |
| `pausaMinuti` | opzionale |
| `attivo` | bool — una tipologia usata da turni esistenti può essere disattivata ma non eliminata |

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Tipologia turno]

---

## Turno (Shift)

| Campo | Tipo / Note |
|---|---|
| `id` | PK |
| `userId` | FK → Utente |
| `shiftTypeId` | FK → ShiftType, opzionale se orari custom |
| `data` | giorno di inizio |
| `inizio` | datetime con timezone |
| `fine` | datetime con timezone |
| `stato` | `pianificato` \| `confermato` \| `annullato` |
| `origine` | `manuale` \| `ricorrenza` \| `swap` \| `richiesta` |
| `ricorrenzaId` | FK opzionale |
| `richiestaId` | FK opzionale |
| `isStraordinario` | bool derivabile |
| `note` | testo |
| timestamp di audit | — |

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Turno]

---

## Regola di ricorrenza (RecurrenceRule)

| Campo | Tipo / Note |
|---|---|
| `id` | PK |
| `nome` | stringa |
| `tipo` | `settimanale` \| `ciclo_rotativo` |
| `dataInizio`, `dataFine` | intervallo |
| `definizione` | struttura che descrive il pattern: giorni della settimana + shiftType; oppure sequenza rotante di shiftType con lunghezza ciclo e offset |
| `targetUserIds` | uno o più dipendenti (FK multipla) |

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Regola di ricorrenza]

---

## Assenza (Absence)

| Campo | Tipo / Note |
|---|---|
| `id` | PK |
| `userId` | FK → Utente |
| `tipo` | `ferie` \| `malattia` \| `permesso` |
| `dataInizio`, `dataFine` | intervallo |
| `stato` | `attiva` \| `annullata` |
| `richiestaId` | FK opzionale — se derivata da una richiesta approvata |
| `note` | testo |

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Assenza]

---

## Disponibilità/Preferenza (Availability)

| Campo | Tipo / Note |
|---|---|
| `id` | PK |
| `userId` | FK → Utente |
| `tipo` | `disponibile` \| `non_disponibile` \| `preferenza` |
| `ambito` | ricorrente (giorno della settimana + fascia/shiftType) oppure intervallo di date |
| `note` | testo |

Vincolo **soft** considerato in pianificazione. Un turno in contraddizione genera avviso
(RB-15).

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Disponibilità/Preferenza]

---

## Richiesta (Request)

| Campo | Tipo / Note |
|---|---|
| `id` | PK |
| `userId` | FK → richiedente |
| `tipo` | `assenza` \| `scambio_turno` \| `nuovo_turno` \| `modifica_turno` |
| `stato` | `bozza` \| `inviata` \| `in_attesa_collega` \| `approvata` \| `rifiutata` \| `annullata` \| `applicata` |
| `payload` | dettagli per tipo (vedi sotto) |
| `collegaId` | FK opzionale — destinatario dell'eventuale scambio |
| `accettazioneCollega` | `in_attesa` \| `accettata` \| `rifiutata` (se applicabile) |
| `decisioneAdminId` | FK opzionale |
| `motivoDecisione` | testo |
| timestamp creazione/aggiornamento/decisione | — |

### Payload per tipo

| Tipo richiesta | Payload |
|---|---|
| `assenza` | tipo assenza + intervallo date |
| `scambio_turno` | `turnoProprioId` + `turnoCollegaId` (o `collegaId`) |
| `nuovo_turno` | data + shiftType/orari |
| `modifica_turno` | `turnoId` + modifica proposta |

### Ciclo di vita richiesta

```
bozza → inviata → [in_attesa_collega, se scambio] → approvata | rifiutata
                                                     ↓ se approvata
                                                  applicata
```

Annullo consentito dal dipendente finché la richiesta non è in stato `applicata` (RB-16).
Una richiesta `applicata`, `rifiutata` o `annullata` è **immutabile**.

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Richiesta]

---

## Fabbisogno di copertura (CoverageRequirement)

| Campo | Tipo / Note |
|---|---|
| `id` | PK |
| `giornoOFascia` | giorno della settimana o data; fascia oraria o shiftType |
| `qualificaId` | FK → Qualifica |
| `numeroMinimo` | intero |

Usato in sola lettura dal motore di validazione (RB-07).

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Fabbisogno di copertura]

---

## Operazione di swap (SwapOperation)

| Campo | Tipo / Note |
|---|---|
| `id` | PK |
| `shiftAId`, `shiftBId` | (o `turnoId` + `nuovoUserId`) |
| `origine` | `admin` \| `richiesta` |
| `richiestaId` | FK opzionale |
| `adminId` | FK → Utente admin |
| `dataOperazione` | datetime |
| `esitoValidazione` | `accettato` \| `rifiutato` |
| `motivo` | testo |

Ogni swap è tracciato in AuditLog con origine, esito e motivo.

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Operazione di swap]

---

## Notifica (Notification)

| Campo | Tipo / Note |
|---|---|
| `id` | PK |
| `destinatarioId` | FK → Utente |
| `tipo` | `richiesta_ricevuta` \| `esito_richiesta` \| `scambio_da_accettare` \| `turno_modificato` |
| `payload` | riferimenti all'entità correlata |
| `letta` | bool |
| `timestamp` | — |

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Notifica]

---

## Log di audit (AuditLog)

| Campo | Tipo / Note |
|---|---|
| `id` | PK |
| `attoreId` | FK → Utente |
| `azione` | stringa |
| `entita` | nome entità |
| `entitaId` | PK dell'entità |
| `datiPrima` | snapshot pre-modifica |
| `datiDopo` | snapshot post-modifica |
| `timestamp` | — |

Copre: assegnazioni, swap, assenze, modifiche anagrafiche, decisioni sulle richieste.

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Log di audit]

---

## Relazioni chiave

```
Utente 1—* Turno
Utente 1—* Assenza
Utente 1—* Disponibilità
Utente 1—* Richiesta
Utente 1—* Notifica
Utente *—1 Qualifica

ShiftType 1—* Turno
RecurrenceRule 1—* Turno

Richiesta 0..1—0..1 Assenza        (richiesta assenza approvata → assenza attiva)
Richiesta 0..1—0..1 SwapOperation  (richiesta scambio approvata → swap eseguito)
Richiesta 0..1—0..1 Turno          (richiesta nuovo/modifica approvata → turno creato/modificato)

CoverageRequirement *—1 Qualifica  (usata in sola lettura dal motore di validazione)
```

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Relazioni chiave]
