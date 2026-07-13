---
type: synthesis
title: "Requisiti Funzionali (RF-A..RF-N)"
status: draft
created: 2026-07-13
source_path: raw/turnly-documento-funzionale.md
ingested_by: wiki-keeper
pattern_section: "§5, §8, §10"
---

# Requisiti Funzionali

Copertura completa dei requisiti funzionali RF-A..RF-N con criteri di accettazione (CA)
verificabili. Le regole di business richiamate (RB-xx) sono definite in [[regole-di-business]].

Vedi anche: [[dominio-turnazione]] | [[flussi-principali]] | [[casi-di-test]] | [[modello-dati-turnly]]

---

## RF-A — Autenticazione e ruoli

- Login con email + password; logout; sessione persistente con scadenza.
- **CA1:** credenziali errate → messaggio d'errore generico, nessuna indicazione su quale campo sia errato.
- **CA2:** un dipendente che apre un URL/endpoint riservato all'admin riceve **403** (non un redirect cosmetico).
- **CA3:** la sessione scade dopo inattività configurabile; alla scadenza le API rispondono **401**.

[^src: raw/turnly-documento-funzionale.md §5 RF-A]

---

## RF-B — Anagrafica (admin)

- CRUD dipendenti; assegnazione qualifica, ore contrattuali, tipo contratto; attivazione/disattivazione.
- **CA1:** l'email deve essere univoca; tentativo di duplicato → errore di validazione.
- **CA2:** disattivare un dipendente non elimina i turni storici, ma impedisce nuove assegnazioni future.
- **CA3:** CRUD qualifiche; una qualifica usata da dipendenti o coperture non è eliminabile senza riassegnazione (integrità referenziale).

[^src: raw/turnly-documento-funzionale.md §5 RF-B]

---

## RF-C — Tipologie di turno (admin)

- CRUD tipologie con orari, colore, pausa; calcolo automatico della durata, incluso l'attraversamento di mezzanotte (RB-12).
- **CA1:** creando *Notte 22:00–06:00* la durata risultante è **8h** e `attraversaMezzanotte = true`.
- **CA2:** una tipologia usata da turni esistenti non è eliminabile ma può essere disattivata.

[^src: raw/turnly-documento-funzionale.md §5 RF-C]

---

## RF-D — Matrice turni (admin) — funzione centrale

- Vista a griglia dipendenti × giorni, con selettore periodo **settimana** e **mese**.
- Assegnazione di un turno a una cella (tipologia o orari custom), modifica, rimozione, spostamento.
- **Validazione in tempo reale:** al posizionamento/modifica, la UI evidenzia le violazioni (RB-01…RB-09, RB-15) sulla cella/riga, distinguendo **bloccanti** (rosso, salvataggio impedito) da **avvisi** (giallo, salvataggio consentito con conferma).
- Filtri: per qualifica, per dipendente, per tipologia; ricerca dipendente. Visualizzazione disponibilità/indisponibilità dichiarata.
- **CA1:** assegnare un secondo turno sovrapposto per lo stesso dipendente (RB-01) è **impedito**.
- **CA2:** assegnare un turno con riposo < minimo verso il turno adiacente (RB-02) mostra un **avviso** inline con dettaglio e richiede conferma.
- **CA3:** assegnare un turno a un dipendente in assenza in quella data (RB-08) è **impedito**.
- **CA4:** assegnare un turno in una finestra di indisponibilità dichiarata (RB-15) mostra un **avviso**.
- **CA5:** la validazione mostrata in UI e quella applicata al salvataggio lato server **coincidono** — vedi T-INT-01.
- **CA6:** la matrice resta fluida con almeno 50 dipendenti × 31 giorni (RNF-Performance).

[^src: raw/turnly-documento-funzionale.md §5 RF-D]

---

## RF-E — Ricorrenze e cicli (admin)

- Definizione di ricorrenze settimanali e cicli rotativi (sequenza di tipologie con lunghezza e offset per dipendente).
- Generazione dei turni nell'intervallo; rispetto delle eccezioni: nessun turno su date di assenza; gestione dei festivi secondo configurazione.
- Modifica di **una singola occorrenza** vs **l'intera serie**; eliminazione della serie con scelta se mantenere le occorrenze passate.
- **CA1:** una ricorrenza che cade su un giorno di assenza **salta** (o segnala) l'occorrenza e non crea turni non validi (RB-11).
- **CA2:** modificare una singola occorrenza non altera le altre; modificare la serie propaga solo alle occorrenze future non personalizzate.
- **CA3:** la generazione non produce sovrapposizioni (RB-01); i conflitti sono elencati in un report post-generazione.

[^src: raw/turnly-documento-funzionale.md §5 RF-E]

---

## RF-F — Scambio turni / Swap (admin e da richiesta)

- Lo swap può essere **avviato dall'admin** (selezione di due turni da scambiare o riassegnazione) **oppure originare da una richiesta di scambio del dipendente** (RF-M).
- **Anteprima d'impatto:** prima della conferma/approvazione, il sistema mostra l'esito della rivalidazione per **entrambi** i dipendenti coinvolti.
- **CA1:** uno swap che genera una violazione **bloccante** per una delle due parti è **rifiutato**, con indicazione di parte e regola (RB-10).
- **CA2:** uno swap che genera solo **avvisi** è consentito previa conferma esplicita.
- **CA3:** se lo scambio nasce da una richiesta, il collega bersaglio deve **accettare** prima dell'approvazione admin (RF-M, RB-10).
- **CA4:** ogni swap è tracciato in AuditLog con origine, esito e motivo.

[^src: raw/turnly-documento-funzionale.md §5 RF-F]

---

## RF-G — Assenze (admin e da richiesta)

- Registrazione di ferie/malattia/permesso su un intervallo, **da parte dell'admin** o **derivante da una richiesta di assenza approvata** (RF-M).
- Effetto sui turni: se esistono turni pianificati nell'intervallo, il sistema li **segnala** e chiede se annullarli/riassegnarli (non li elimina silenziosamente).
- **CA1:** dopo che un'assenza diventa attiva, non è possibile assegnare nuovi turni al dipendente in quelle date (RB-08).
- **CA2:** registrare un'assenza sovrapposta a turni esistenti produce un elenco dei turni in conflitto con azioni proposte.

[^src: raw/turnly-documento-funzionale.md §5 RF-G]

---

## RF-H — Fabbisogni di copertura (admin)

- Definizione del numero minimo di persone per qualifica in una fascia/tipologia.
- **Vista sotto-copertura:** indicatore, per giorno e fascia, delle coperture non soddisfatte (RB-07).
- **CA1:** se una fascia richiede 3 Infermieri e ne sono pianificati 2, la fascia è marcata **sotto-coperta** con lo scarto (-1).
- **CA2:** la vista si aggiorna quando si aggiungono/rimuovono turni pertinenti.

[^src: raw/turnly-documento-funzionale.md §5 RF-H]

---

## RF-I — Straordinari (admin)

- Calcolo automatico delle ore oltre l'orario contrattuale nel periodo di riferimento; marcatura delle ore in straordinario (RB-06).
- Report per dipendente e periodo: ore ordinarie, straordinarie, totale.
- **CA1:** un dipendente con 40h contrattuali a cui sono assegnate 46h in una settimana risulta con **6h di straordinario**.
- **CA2:** superata la soglia di straordinario configurata, la UI mostra un avviso.

[^src: raw/turnly-documento-funzionale.md §5 RF-I]

---

## RF-J — Vista turni dipendente (sola lettura)

- Calendario personale con viste **giorno / settimana / mese**; dettaglio del singolo turno (orari, tipologia, note).
- Riepilogo delle proprie ore (ordinarie/straordinarie) nel periodo selezionato.
- Export **iCalendar (.ics)** dei propri turni (opzionale ma raccomandato).
- **CA1:** il dipendente vede **esclusivamente** i propri turni; nessuna vista o endpoint espone turni di altri (T-SEC-01/02).
- **CA2:** sui turni pubblicati il dipendente non dispone di controlli di scrittura diretta (agisce solo tramite richieste, RF-M).

[^src: raw/turnly-documento-funzionale.md §5 RF-J]

---

## RF-K — Dashboard admin

- Sintesi operativa: coperture non soddisfatte, violazioni aperte, ore totali pianificate, straordinari del periodo, assenze in corso.
- **Coda richieste (inbox):** conteggio delle richieste in attesa e accesso rapido all'approvazione (RF-M).
- Accesso rapido alle azioni frequenti (nuova assegnazione, gestione assenze).
- **CA1:** i contatori riflettono lo stato reale dei dati (nessun valore statico/finto).
- **CA2:** l'invio di una nuova richiesta da parte di un dipendente incrementa il contatore inbox in tempo utile.

[^src: raw/turnly-documento-funzionale.md §5 RF-K]

---

## RF-L — Profilo e disponibilità (dipendente) — self-service diretto

- Il dipendente modifica i **campi consentiti** del proprio profilo (recapiti, preferenze di contatto). I campi **contrattuali/organizzativi** sono in **sola lettura** (RB-13). Cambio della propria password consentito.
- Il dipendente inserisce/modifica/elimina la propria **disponibilità e preferenze** (finestre disponibile/non disponibile, preferenze di turno), considerate come vincolo **soft** in pianificazione (RB-15).
- **CA1:** il dipendente che tenta di modificare un campo contrattuale (via UI o API) riceve **403**/errore di validazione; il campo non cambia (RB-13, T-SEC-05).
- **CA2:** la disponibilità inserita è visibile all'admin nella pianificazione e genera un **avviso** se un turno la contraddice (RB-15, T-REQ-05).
- **CA3:** il dipendente può gestire solo la **propria** disponibilità e il **proprio** profilo (T-SEC).

[^src: raw/turnly-documento-funzionale.md §5 RF-L]

---

## RF-M — Richieste del dipendente e workflow di approvazione — self-service con approvazione

- Il dipendente crea richieste di tipo: **assenza**, **scambio turno**, **nuovo turno**, **modifica turno**.
- **Ciclo di vita:** `bozza → inviata → [in_attesa_collega, se scambio] → approvata | rifiutata`; se approvata → `applicata`. Il dipendente può **annullare** una richiesta finché non è applicata (RB-16).
- **Rivalidazione all'approvazione:** al momento dell'approvazione, il sistema riapplica le regole RB pertinenti; se l'applicazione genererebbe una violazione **bloccante**, l'approvazione è **impedita** con motivo (RB-14).
- **Scambio con collega:** il collega bersaglio deve **accettare** la proposta prima che l'admin possa approvarla (stato `in_attesa_collega`); il collega può rifiutare, chiudendo la richiesta.
- **CA1:** una richiesta di assenza approvata crea un'**assenza attiva**; da quel momento non è possibile assegnare turni in quelle date (RB-08, T-REQ-01).
- **CA2:** una richiesta di scambio approvata esegue lo swap solo se supera RB-10 per entrambe le parti; altrimenti l'approvazione è bloccata (T-REQ-02).
- **CA3:** il dipendente vede lo **stato** delle proprie richieste e le notifiche relative; non può vedere le richieste altrui (T-SEC-07).
- **CA4:** il dipendente non può **approvare** alcuna richiesta, nemmeno le proprie; l'approvazione è esclusiva dell'admin (T-SEC-06).
- **CA5:** una richiesta **applicata, rifiutata o annullata** non è più modificabile (RB-16, T-REQ-04).
- **CA6:** solo il **collega destinatario** può accettare/rifiutare una proposta di scambio a lui indirizzata (T-SEC-08).

[^src: raw/turnly-documento-funzionale.md §5 RF-M]

---

## RF-N — Notifiche

- **Canale:** in-app di default; email opzionale.
- **Al dipendente:** esito della propria richiesta (approvata/rifiutata); proposta di scambio ricevuta da un collega da accettare; modifica dell'admin ai propri turni (assegnazione/annullamento).
- **All'admin:** nuova richiesta in attesa di approvazione; accettazione/rifiuto di uno scambio da parte del collega.
- **CA1:** all'invio di una richiesta, l'admin riceve una notifica e il contatore inbox si incrementa.
- **CA2:** all'approvazione/rifiuto, il dipendente richiedente riceve una notifica con l'esito.
- **CA3:** le notifiche rispettano i confini di autorizzazione: un dipendente non riceve notifiche relative a dati altrui, salvo la proposta di scambio a lui indirizzata (T-SEC).

[^src: raw/turnly-documento-funzionale.md §5 RF-N — §8 Notifiche]

---

## Inventario schermate (§10)

Per ciascuna schermata: ruolo, scopo, componenti chiave, stati da rappresentare.

| # | Schermata | Ruolo | Scopo | Componenti chiave | Stati |
|---|---|---|---|---|---|
| 1 | Login | Tutti | Accesso | Form email/password, errore credenziali, link reset | Default, errore, caricamento |
| 2 | Dashboard admin | Admin | Sintesi operativa | KPI, badge inbox richieste, scorciatoie | Con dati, vuoto, caricamento |
| 3 | Matrice turni — settimana | Admin | Pianificazione | Griglia dipendenti×giorni, header sticky, celle turno colorate, badge violazioni/indisponibilità, filtri | Con dati, vuoto, caricamento, errore |
| 4 | Matrice turni — mese | Admin | Pianificazione mensile | Variante densa della griglia, navigazione mese | Con dati, vuoto, caricamento |
| 5 | Editor turno (modale su cella) | Admin | Crea/modifica turno | Selettore tipologia, orari custom, note, flag straordinario, **pannello avvisi/violazioni** | Nuovo, modifica, con avvisi, con bloccante |
| 6 | Definizione ricorrenza/ciclo | Admin | Turni ripetuti | Wizard: tipo, sequenza tipologie, intervallo date, target, anteprima | Setup, anteprima, report conflitti |
| 7 | Scambio turni (swap) | Admin | Scambiare turni | Selezione turno A/B, anteprima impatto su entrambe le parti, esito validazione | Selezione, esito ok, esito rifiutato |
| 8 | Gestione assenze | Admin | Registrare assenze | Form tipo/intervallo, elenco turni in conflitto con azioni | Default, con conflitti, vuoto |
| 9 | Fabbisogni / coperture | Admin | Definire minimi e monitorare | Setup fabbisogni; vista sotto-copertura per giorno/fascia con scarti | Setup, monitor, vuoto |
| 10 | Anagrafica dipendenti | Admin | Gestire persone | Lista con ricerca/filtri; dettaglio/edit (qualifica, contratto, stato) | Lista, dettaglio, vuoto, errore |
| 11 | Tipologie di turno | Admin | Gestire modelli turno | Lista tipologie; editor (orari, colore, pausa, notturno) | Lista, editor, vuoto |
| 12 | Report straordinari/ore | Admin | Analisi ore | Tabella per dipendente/periodo, filtri | Con dati, vuoto, caricamento |
| 13 | Coda richieste / approvazioni | Admin | Approvare le richieste | Inbox con richieste in attesa, filtri per tipo/stato; dettaglio con anteprima impatto e azioni approva/rifiuta | Con richieste, vuoto, dettaglio, esito bloccato |
| 14 | Calendario dipendente | Dipendente | Consultazione | Viste giorno/settimana/mese dei soli propri turni, riepilogo ore, export .ics | Con dati, vuoto, caricamento |
| 15 | Dettaglio turno (dipendente) | Dipendente | Dettaglio | Orari, tipologia, note (sola lettura); azione "richiedi modifica/scambio" | Default |
| 16 | Profilo personale (dipendente) | Dipendente | Dati personali | Modifica campi consentiti, campi contrattuali in sola lettura, cambio password | Visualizzazione, modifica, errore validazione, cambio password |
| 17 | Disponibilità e preferenze (dipendente) | Dipendente | Gestire disponibilità | Editor finestre disponibile/non disponibile/preferenza (ricorrenti o a date), elenco voci | Con voci, vuoto, modifica |
| 18 | Le mie richieste (dipendente) | Dipendente | Elenco richieste | Lista con stato e tipo, filtri; include proposte di scambio ricevute da accettare | Con richieste, vuoto, caricamento |
| 19 | Nuova richiesta (dipendente) | Dipendente | Creare una richiesta | Form dinamico per tipo (assenza / scambio / nuovo turno / modifica turno), validazione | Selezione tipo, compilazione, invio |
| 20 | Dettaglio richiesta (dipendente) | Dipendente | Stato e azioni | Stato, cronologia, motivo decisione; azioni: annulla (se consentito), accetta/rifiuta scambio ricevuto | In attesa, approvata, rifiutata, da accettare |
| 21 | Centro notifiche | Tutti | Notifiche | Indicatore (bell) + elenco notifiche, lette/non lette, link all'entità | Con notifiche, vuoto |
| 22 | Stati globali / errori | Tutti | Coerenza UX | Empty state, schermata errore, skeleton di caricamento | — |

[^src: raw/turnly-documento-funzionale.md §10 Inventario schermate]
