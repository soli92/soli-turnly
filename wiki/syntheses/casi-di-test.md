---
type: synthesis
title: "Casi di Test Trasversali"
status: draft
created: 2026-07-13
source_path: raw/turnly-documento-funzionale.md
ingested_by: wiki-keeper
pattern_section: "§11"
---

# Casi di Test Trasversali

Scenari concreti che l'output del sistema deve superare. Sono la base per valutare la
correttezza sul dominio. Organizzati in sei categorie: correttezza dominio, ricorrenze/swap,
richieste e workflow, integrazione, sicurezza/autorizzazione.

Vedi anche: [[regole-di-business]] | [[requisiti-funzionali]] | [[flussi-principali]]

---

## Correttezza dominio (T-DOM-*)

| ID | Scenario | Risultato atteso | Regola |
|---|---|---|---|
| **T-DOM-01** | ShiftType *Notte 22:00–06:00* creato | `durataMinuti = 480` (8h), `attraversaMezzanotte = true`, data di fine = giorno successivo | RF-C CA1, RB-12 |
| **T-DOM-02** | Mario: turno 08:00–16:00, poi assegnazione 14:00–22:00 stesso giorno | Assegnazione **bloccata** (sovrapposizione) | RB-01 |
| **T-DOM-03** | Mario finisce alle 22:00 (giorno X); assegnazione alle 06:00 del giorno X+1 → riposo 8h | **Avviso** (riposo 8h < 11h) | RB-02 |
| **T-DOM-04** | Luca in ferie 10–14; assegnazione il giorno 12 | Assegnazione **bloccata** | RB-08 |
| **T-DOM-05** | 7 turni in 7 giorni consecutivi | **Avviso** (superamento maxGiorniConsecutivi = 6) | RB-04 |
| **T-DOM-06** | Dipendente con 40h contrattuali, assegnate 46h in una settimana | 6h di **straordinario** calcolato | RB-06 |
| **T-DOM-07** | Fascia notte: fabbisogno 3 Infermieri, pianificati 2 | Fascia marcata **sotto-coperta (-1)** | RB-07 |
| **T-DOM-08** | Turno notturno che attraversa il cambio ora legale (es. 22:00–06:00 nella notte del cambio) | Durata reale corretta (7h o 9h secondo il cambio DST) | RB-12 |

[^src: raw/turnly-documento-funzionale.md §11 T-DOM-*]

---

## Ricorrenze e swap (T-REC-*, T-SWP-*)

| ID | Scenario | Risultato atteso | Regola |
|---|---|---|---|
| **T-REC-01** | Ricorrenza settimanale che cade su un giorno di assenza del dipendente | Occorrenza **saltata o segnalata**, nessun turno in violazione creato | RB-11 |
| **T-REC-02** | Modifica della singola occorrenza di una ricorrenza | Le altre occorrenze **non sono alterate**; modifica della serie → propaga solo alle future non personalizzate | RF-E CA2 |
| **T-SWP-01** | Swap Mario(notte) ↔ Luca(mattina) che lascia Mario con riposo < soglia bloccante | Swap **rifiutato** con indicazione della parte coinvolta e della regola | RB-10 |
| **T-SWP-02** | Swap che genera solo avvisi (nessuna violazione bloccante) | Swap **consentito** previa conferma esplicita; tracciato in AuditLog | RB-10, RF-F CA2 |

[^src: raw/turnly-documento-funzionale.md §11 T-REC-* T-SWP-*]

---

## Richieste e workflow di approvazione (T-REQ-*)

| ID | Scenario | Risultato atteso | Regola |
|---|---|---|---|
| **T-REQ-01** | Dipendente invia richiesta assenza → admin approva → assenza attiva | Assegnazione di turni nelle date di assenza **bloccata** | RB-08, RF-M CA1 |
| **T-REQ-02** | Richiesta il cui esito creerebbe una sovrapposizione (RB-01) | **Approvazione bloccata** con motivo | RB-14, RF-M CA2 |
| **T-REQ-03** | Dipendente propone scambio → il collega deve accettare prima dell'approvazione admin | Se il collega rifiuta, la richiesta non arriva ad approvazione | RF-M, RF-F CA3 |
| **T-REQ-04** | Tentativo di modificare una richiesta già `applicata` o `rifiutata` | Operazione **impedita** | RB-16, RF-M CA5 |
| **T-REQ-05** | Turno assegnato in una finestra di indisponibilità dichiarata dal dipendente | **Avviso** (non bloccante per default) | RB-15, RF-L CA2 |

[^src: raw/turnly-documento-funzionale.md §11 T-REQ-*]

---

## Integrazione tra componenti (T-INT-*)

| ID | Scenario | Risultato atteso | Note |
|---|---|---|---|
| **T-INT-01** | La stessa assegnazione che la UI segnala come bloccante | Rifiutata **anche dall'API** con lo stesso motivo; una segnalata come avviso → accettata dall'API | Parità regole UI ↔ backend, valida sia per matrice sia per approvazione richieste |
| **T-INT-02** | Salvataggio concorrente di due turni sovrapposti per lo stesso dipendente da due sessioni | Uno solo va a buon fine; l'altro riceve un **conflitto** (nessun double-booking) | Richiede locking o serializzazione lato server |
| **T-INT-03** | Invio di una richiesta da parte del dipendente | Badge inbox dell'admin e centro notifiche si aggiornano **coerentemente** con lo stato reale | RF-K CA2, RF-N CA1 |

[^src: raw/turnly-documento-funzionale.md §11 T-INT-*]

---

## Sicurezza e autorizzazione (T-SEC-*)

| ID | Scenario | Risultato atteso |
|---|---|---|
| **T-SEC-01** | Dipendente A richiede turni passando l'id di B (o senza filtro) | Riceve **solo i propri** o un **403**, mai i turni di B |
| **T-SEC-02** | Dipendente invoca una scrittura non consentita (pianificazione turni, anagrafica altrui, approvazioni) | **403** lato server. Le scritture consentite restano: proprio profilo (campi consentiti), propria disponibilità, proprie richieste |
| **T-SEC-03** | Accesso a una risorsa per id inesistente/non autorizzato | **404/403** coerente, nessuna fuga d'informazione |
| **T-SEC-04** | Sessione scaduta | Le API rispondono **401** |
| **T-SEC-05** | Dipendente tenta di modificare qualifica/ore contrattuali/ruolo via API | **403**/rifiutato; il valore non cambia (RB-13) |
| **T-SEC-06** | Dipendente tenta di approvare una richiesta (propria o altrui) via API | **403** |
| **T-SEC-07** | Dipendente A tenta di leggere/modificare una richiesta di B | **403/404**, mai accesso |
| **T-SEC-08** | Dipendente non destinatario tenta di accettare uno scambio | **403** |

[^src: raw/turnly-documento-funzionale.md §11 T-SEC-*]

---

## Matrice copertura test × requisiti

| Area | Test | RF coperti | RB coperti |
|---|---|---|---|
| Correttezza dominio | T-DOM-01..08 | RF-C, RF-D, RF-G, RF-H, RF-I | RB-01, RB-02, RB-04, RB-06, RB-07, RB-08, RB-12 |
| Ricorrenze/swap | T-REC-01/02, T-SWP-01/02 | RF-E, RF-F | RB-10, RB-11 |
| Workflow richieste | T-REQ-01..05 | RF-G, RF-L, RF-M | RB-08, RB-14, RB-15, RB-16 |
| Integrazione | T-INT-01..03 | RF-D, RF-K, RF-M, RF-N | RB-01, RB-14 |
| Sicurezza | T-SEC-01..08 | RF-A, RF-J, RF-L, RF-M | RB-13, RB-16 |
