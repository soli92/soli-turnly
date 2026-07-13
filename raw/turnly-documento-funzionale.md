# Turnly — Documento Funzionale

> **Scopo del documento.** Specifica funzionale di **Turnly**, un'applicazione web di gestione turni di lavoro (agenda + calendario + matrice turni). È pensata come **input per un sistema di sviluppo automatico**: descrive *cosa* costruire, con criteri di accettazione verificabili e regole di business parametriche. Non prescrive lo stack tecnologico né l'architettura implementativa.
>
> **Configurazione del caso.** Logica turni **Avanzata** (ricorrenze/cicli, scambio turni, straordinari, oltre a vincoli di riposo/ore/coperture e rilevamento conflitti). Il dipendente dispone di **self-service**: modifica diretta dei propri dati personali (profilo — solo campi consentiti — e disponibilità/preferenze) e **richieste con workflow di approvazione** per le azioni che toccano la pianificazione (assenza, scambio, nuovo turno, modifica turno). Il dipendente non scrive direttamente sulla pianificazione pubblicata; propone, e l'admin approva con rivalidazione delle regole.

---

## 1. Contesto e obiettivi

### 1.1 Cos'è
Applicazione per la pianificazione e la consultazione dei turni di lavoro di un'organizzazione (es. reparto ospedaliero, punto vendita, reception, produzione). Un **amministratore** costruisce e mantiene la pianificazione su una matrice dipendenti × giorni; ogni **dipendente** consulta i propri turni, gestisce i propri dati personali e invia richieste (assenze, scambi, modifiche) soggette ad approvazione.

### 1.2 Obiettivi
- Fornire all'admin uno strumento rapido per assegnare, modificare e validare turni, con controllo automatico dei vincoli normativi e di copertura.
- Automatizzare la generazione di turni ricorrenti/ciclici e il calcolo degli straordinari.
- Dare a ciascun dipendente una vista chiara dei propri turni, il controllo dei propri dati personali e un canale strutturato di richieste con approvazione.
- Impedire pianificazioni non valide (sovrapposizioni, riposi insufficienti, turni durante assenze) e segnalare i rischi (sotto-copertura, superamento soglie ore), anche in fase di approvazione delle richieste.

### 1.3 Perimetro
**In scope**
- Autenticazione e gestione ruoli (admin, dipendente).
- Anagrafica dipendenti, qualifiche/mansioni, contratti.
- Tipologie di turno e matrice turni con validazione in tempo reale.
- Ricorrenze/cicli rotativi con gestione eccezioni.
- Scambio turni (swap) eseguibile dall'admin o originato da una richiesta del dipendente.
- Assenze (ferie, malattia, permesso), registrate dall'admin o derivate da una richiesta approvata; loro effetto sui turni.
- Fabbisogni di copertura per fascia/qualifica.
- Calcolo straordinari e reportistica ore.
- **Self-service dipendente:** modifica del proprio profilo (campi consentiti) e gestione di disponibilità/preferenze.
- **Richieste del dipendente con workflow di approvazione:** assenza, scambio turno, nuovo turno/copertura, modifica turno.
- **Notifiche** legate al ciclo di vita delle richieste e alle modifiche dei turni.

**Out of scope (estensioni future, non richieste)**
- Multi-sede / multi-tenant.
- Timbrature e rilevazione presenze effettive.
- Integrazione con paghe/HR esterni.
- Scrittura diretta del dipendente sulla pianificazione pubblicata (il dipendente agisce sui turni solo tramite richieste approvate).
- App mobile nativa (la web app deve però essere responsive).

---

## 2. Ruoli e permessi

| Capacità | Admin | Dipendente |
|---|---|---|
| Login / logout | ✅ | ✅ |
| Modificare il **proprio** profilo — campi consentiti (recapiti, preferenze) | ✅ | ✅ |
| Modificare i campi **contrattuali** del profilo (qualifica, ore contrattuali, tipo contratto, ruolo, stato) | ✅ | ❌ |
| Cambiare la **propria** password | ✅ | ✅ |
| Gestire la **propria** disponibilità/preferenze | ✅ | ✅ |
| Visualizzare **i propri** turni | ✅ | ✅ |
| Visualizzare i turni di **tutti** | ✅ | ❌ |
| Creare/modificare/eliminare turni sulla pianificazione | ✅ | ❌ |
| Gestire anagrafica, qualifiche, contratti (tutti) | ✅ | ❌ |
| Gestire tipologie di turno | ✅ | ❌ |
| Definire ricorrenze/cicli | ✅ | ❌ |
| Eseguire **direttamente** uno swap | ✅ | ❌ |
| Registrare **direttamente** un'assenza | ✅ | ❌ |
| Definire fabbisogni di copertura | ✅ | ❌ |
| **Inviare richieste** (assenza / scambio / nuovo turno / modifica turno) | — (opera direttamente) | ✅ |
| **Accettare/rifiutare** una proposta di scambio ricevuta | — | ✅ (solo se destinatario) |
| **Approvare/rifiutare** richieste | ✅ | ❌ |
| Vedere report ore/straordinari (tutti) | ✅ | ❌ |
| Vedere il **proprio** riepilogo ore | ✅ | ✅ |

> **Regola trasversale di sicurezza:** ogni permesso è verificato **lato server** su ogni richiesta. Nascondere un controllo nella sola UI non è sufficiente. La scrittura del dipendente è limitata ai **propri** dati personali consentiti e alle **proprie** richieste; ogni altra scrittura (pianificazione, anagrafica altrui, approvazioni) è negata. Vedi RNF-Sicurezza e i casi di test T-SEC-*.

---

## 3. Glossario di dominio

- **Turno (Shift):** assegnazione di una fascia oraria lavorativa a un dipendente in una data specifica.
- **Tipologia di turno (ShiftType):** modello riutilizzabile con orari, durata, colore ed etichetta (es. *Mattina 06:00–14:00*, *Notte 22:00–06:00*).
- **Turno notturno / a cavallo di mezzanotte:** turno la cui ora di fine è precedente all'ora di inizio (attraversa la mezzanotte); la data di fine ricade sul giorno successivo.
- **Matrice turni:** griglia dipendenti (righe) × giorni (colonne); ogni cella rappresenta turno, riposo o assenza.
- **Ricorrenza / Ciclo:** regola che genera turni ripetuti (es. "ogni lunedì Mattina") o rotazioni (es. ciclo *Mattina → Pomeriggio → Notte → Riposo*).
- **Assenza (Absence):** periodo in cui il dipendente non è disponibile (ferie, malattia, permesso).
- **Disponibilità / Preferenza (Availability):** finestre in cui il dipendente si dichiara disponibile o indisponibile, o esprime una preferenza di turno; vincolo *soft* considerato in pianificazione.
- **Richiesta (Request):** proposta avviata dal dipendente (assenza, scambio, nuovo turno, modifica turno) che segue un ciclo di approvazione gestito dall'admin.
- **Qualifica / Mansione:** competenza professionale del dipendente (es. Infermiere, OSS, Cassiere), distinta dal ruolo applicativo (admin/dipendente); usata per le coperture.
- **Fabbisogno / Copertura (CoverageRequirement):** numero minimo di persone di una data qualifica richieste in una fascia oraria.
- **Straordinario:** ore lavorate oltre l'orario contrattuale del dipendente.
- **Swap (Scambio):** operazione che scambia due turni tra due dipendenti (o riassegna un turno); eseguibile dall'admin o originata da una richiesta di scambio del dipendente.

---

## 4. Modello dati

Entità principali (i tipi sono indicativi; le chiavi/relazioni sono ciò che conta).

**Utente (User)**
- `id`, `nome`, `cognome`, `email` (univoca), `ruolo` (`admin` | `dipendente`), `stato` (`attivo` | `inattivo`)
- `qualificaId` (FK → Qualifica), `oreContrattualiSettimanali` (numero), `tipoContratto` (es. full-time, part-time)
- Campi personali modificabili dal dipendente: `recapiti` (telefono, email di contatto), `preferenzeContatto`
- `passwordHash`, timestamp di audit
- Campi **contrattuali/organizzativi** (`qualificaId`, `oreContrattualiSettimanali`, `tipoContratto`, `ruolo`, `stato`): modificabili **solo dall'admin** (RB-13)

**Qualifica (Qualification)**
- `id`, `nome`, `descrizione`

**Tipologia turno (ShiftType)**
- `id`, `nome`, `oraInizio`, `oraFine`, `durataMinuti` (derivata, gestisce l'attraversamento di mezzanotte), `attraversaMezzanotte` (bool), `colore`, `pausaMinuti` (opzionale), `attivo` (bool)

**Turno (Shift)**
- `id`, `userId` (FK → Utente), `shiftTypeId` (FK → ShiftType, opzionale se orari custom)
- `data` (giorno di inizio), `inizio` (datetime con timezone), `fine` (datetime con timezone)
- `stato` (`pianificato` | `confermato` | `annullato`)
- `origine` (`manuale` | `ricorrenza` | `swap` | `richiesta`), `ricorrenzaId` (FK opz.), `richiestaId` (FK opz.), `isStraordinario` (bool derivabile), `note`
- timestamp di audit

**Regola di ricorrenza (RecurrenceRule)**
- `id`, `nome`, `tipo` (`settimanale` | `ciclo_rotativo`)
- `dataInizio`, `dataFine`
- `definizione` (struttura che descrive il pattern: giorni della settimana + shiftType; oppure sequenza rotante di shiftType con lunghezza ciclo e offset)
- `targetUserIds` (uno o più dipendenti)

**Assenza (Absence)**
- `id`, `userId` (FK → Utente), `tipo` (`ferie` | `malattia` | `permesso`), `dataInizio`, `dataFine`, `stato` (`attiva` | `annullata`), `richiestaId` (FK opz. — se derivata da una richiesta approvata), `note`

**Disponibilità/Preferenza (Availability)**
- `id`, `userId` (FK → Utente), `tipo` (`disponibile` | `non_disponibile` | `preferenza`)
- `ambito` (ricorrente: giorno della settimana + fascia/shiftType; oppure intervallo di date)
- `note`

**Richiesta (Request)**
- `id`, `userId` (FK → richiedente), `tipo` (`assenza` | `scambio_turno` | `nuovo_turno` | `modifica_turno`)
- `stato` (`bozza` | `inviata` | `in_attesa_collega` | `approvata` | `rifiutata` | `annullata` | `applicata`)
- `payload` (dettagli per tipo:
  - *assenza* → tipo assenza + intervallo date;
  - *scambio_turno* → `turnoProprioId` + `turnoCollegaId` (o `collegaId`);
  - *nuovo_turno* → data + shiftType/orari;
  - *modifica_turno* → `turnoId` + modifica proposta)
- `collegaId` (FK opz. — destinatario dell'eventuale scambio), `accettazioneCollega` (`in_attesa` | `accettata` | `rifiutata`, se applicabile)
- `decisioneAdminId` (FK opz.), `motivoDecisione`, timestamp di creazione/aggiornamento/decisione

**Fabbisogno di copertura (CoverageRequirement)**
- `id`, `giornoOFascia` (giorno della settimana o data; fascia oraria o shiftType), `qualificaId` (FK), `numeroMinimo` (int)

**Operazione di swap (SwapOperation)**
- `id`, `shiftAId`, `shiftBId` (o `turnoId` + `nuovoUserId`), `origine` (`admin` | `richiesta`), `richiestaId` (FK opz.), `adminId`, `dataOperazione`, `esitoValidazione` (`accettato` | `rifiutato`), `motivo`

**Notifica (Notification)**
- `id`, `destinatarioId` (FK → Utente), `tipo` (es. `richiesta_ricevuta`, `esito_richiesta`, `scambio_da_accettare`, `turno_modificato`), `payload` (riferimenti all'entità), `letta` (bool), `timestamp`

**Log di audit (AuditLog)**
- `id`, `attoreId`, `azione`, `entita`, `entitaId`, `datiPrima`, `datiDopo`, `timestamp`

**Relazioni chiave**
- Utente 1—* Turno; Utente 1—* Assenza; Utente 1—* Disponibilità; Utente 1—* Richiesta; Utente 1—* Notifica; Utente *—1 Qualifica.
- ShiftType 1—* Turno.
- RecurrenceRule 1—* Turno.
- Richiesta 0..1—0..1 Assenza / SwapOperation / Turno (una richiesta approvata può generare l'entità corrispondente).
- CoverageRequirement *—1 Qualifica (usata in sola lettura dal motore di validazione).

---

## 5. Requisiti funzionali

Ogni requisito ha criteri di accettazione (CA) verificabili. Le regole richiamate (RB-xx) sono definite nella §6.

### RF-A — Autenticazione e ruoli
- Login con email + password; logout; sessione persistente con scadenza.
- CA1: credenziali errate → messaggio d'errore generico, nessuna indicazione su quale campo sia errato.
- CA2: un dipendente che apre un URL/endpoint riservato all'admin riceve **403** (non un redirect cosmetico).
- CA3: la sessione scade dopo inattività configurabile; alla scadenza le API rispondono **401**.

### RF-B — Anagrafica (admin)
- CRUD dipendenti; assegnazione qualifica, ore contrattuali, tipo contratto; attivazione/disattivazione.
- CA1: l'email deve essere univoca; tentativo di duplicato → errore di validazione.
- CA2: disattivare un dipendente non elimina i turni storici, ma impedisce nuove assegnazioni future.
- CA3: CRUD qualifiche; una qualifica usata da dipendenti o coperture non è eliminabile senza riassegnazione (integrità referenziale).

### RF-C — Tipologie di turno (admin)
- CRUD tipologie con orari, colore, pausa; calcolo automatico della durata, incluso l'attraversamento di mezzanotte (RB-12).
- CA1: creando *Notte 22:00–06:00* la durata risultante è **8h** e `attraversaMezzanotte = true`.
- CA2: una tipologia usata da turni esistenti non è eliminabile ma può essere disattivata.

### RF-D — Matrice turni (admin) — *funzione centrale*
- Vista a griglia dipendenti × giorni, con selettore periodo **settimana** e **mese**.
- Assegnazione di un turno a una cella (tipologia o orari custom), modifica, rimozione, spostamento.
- **Validazione in tempo reale**: al posizionamento/modifica, la UI evidenzia le violazioni (RB-01…RB-09, RB-15) sulla cella/riga, distinguendo **bloccanti** (rosso, salvataggio impedito) da **avvisi** (giallo, salvataggio consentito con conferma).
- Filtri: per qualifica, per dipendente, per tipologia; ricerca dipendente. Visualizzazione della disponibilità/indisponibilità dichiarata dai dipendenti.
- CA1: assegnare un secondo turno che si sovrappone a uno esistente per lo stesso dipendente (RB-01) è **impedito**.
- CA2: assegnare un turno che lascia meno del riposo minimo verso il turno adiacente (RB-02) mostra un **avviso** inline con il dettaglio e richiede conferma.
- CA3: assegnare un turno a un dipendente in assenza in quella data (RB-08) è **impedito**.
- CA4: assegnare un turno in una finestra di indisponibilità dichiarata (RB-15) mostra un **avviso**.
- CA5: la validazione mostrata in UI e quella applicata al salvataggio lato server **coincidono** — vedi T-INT-01.
- CA6: la matrice resta fluida con almeno 50 dipendenti × 31 giorni (RNF-Performance).

### RF-E — Ricorrenze e cicli (admin)
- Definizione di ricorrenze settimanali e cicli rotativi (sequenza di tipologie con lunghezza e offset per dipendente).
- Generazione dei turni nell'intervallo; **rispetto delle eccezioni**: nessun turno su date di assenza; gestione dei festivi secondo configurazione.
- Modifica di **una singola occorrenza** vs **l'intera serie**; eliminazione della serie con scelta se mantenere le occorrenze passate.
- CA1: una ricorrenza che cade su un giorno di assenza **salta** (o segnala) l'occorrenza e non crea turni non validi (RB-11).
- CA2: modificare una singola occorrenza non altera le altre; modificare la serie propaga solo alle occorrenze future non personalizzate.
- CA3: la generazione non produce sovrapposizioni (RB-01); i conflitti sono elencati in un report post-generazione.

### RF-F — Scambio turni / Swap (admin e da richiesta)
- Lo swap può essere **avviato dall'admin** (selezione di due turni da scambiare o riassegnazione) **oppure originare da una richiesta di scambio del dipendente** (RF-M).
- **Anteprima d'impatto**: prima della conferma/approvazione, il sistema mostra l'esito della rivalidazione per **entrambi** i dipendenti coinvolti.
- CA1: uno swap che, dopo l'esecuzione, genererebbe una violazione **bloccante** per una delle due parti è **rifiutato**, con indicazione di parte e regola (RB-10).
- CA2: uno swap che genera solo **avvisi** è consentito previa conferma esplicita.
- CA3: se lo scambio nasce da una richiesta, il collega bersaglio deve **accettare** prima dell'approvazione admin (RF-M, RB-10).
- CA4: ogni swap è tracciato in AuditLog con origine, esito e motivo.

### RF-G — Assenze (admin e da richiesta)
- Registrazione di ferie/malattia/permesso su un intervallo, **da parte dell'admin** o **derivante da una richiesta di assenza approvata** (RF-M).
- Effetto sui turni: se esistono turni pianificati nell'intervallo, il sistema li **segnala** e chiede se annullarli/riassegnarli (non li elimina silenziosamente).
- CA1: dopo che un'assenza diventa attiva, non è possibile assegnare nuovi turni al dipendente in quelle date (RB-08).
- CA2: registrare un'assenza sovrapposta a turni esistenti produce un elenco dei turni in conflitto con azioni proposte.

### RF-H — Fabbisogni di copertura (admin)
- Definizione del numero minimo di persone per qualifica in una fascia/tipologia.
- **Vista sotto-copertura**: indicatore, per giorno e fascia, delle coperture non soddisfatte (RB-07).
- CA1: se una fascia richiede 3 Infermieri e ne sono pianificati 2, la fascia è marcata **sotto-coperta** con lo scarto (-1).
- CA2: la vista si aggiorna quando si aggiungono/rimuovono turni pertinenti.

### RF-I — Straordinari (admin)
- Calcolo automatico delle ore oltre l'orario contrattuale nel periodo di riferimento; marcatura delle ore in straordinario (RB-06).
- Report per dipendente e periodo: ore ordinarie, straordinarie, totale.
- CA1: un dipendente con 40h contrattuali a cui sono assegnate 46h in una settimana risulta con **6h di straordinario**.
- CA2: superata la soglia di straordinario configurata, la UI mostra un avviso.

### RF-J — Vista turni dipendente (sola lettura)
- Calendario personale con viste **giorno / settimana / mese**; dettaglio del singolo turno (orari, tipologia, note).
- Riepilogo delle proprie ore (ordinarie/straordinarie) nel periodo selezionato.
- Export **iCalendar (.ics)** dei propri turni (opzionale ma raccomandato).
- CA1: il dipendente vede **esclusivamente** i propri turni; nessuna vista o endpoint espone turni di altri (T-SEC-01/02).
- CA2: sui turni pubblicati il dipendente non dispone di controlli di scrittura diretta (agisce solo tramite richieste, RF-M).

### RF-K — Dashboard admin
- Sintesi operativa: coperture non soddisfatte, violazioni aperte, ore totali pianificate, straordinari del periodo, assenze in corso.
- **Coda richieste (inbox):** conteggio delle richieste in attesa e accesso rapido all'approvazione (RF-M).
- Accesso rapido alle azioni frequenti (nuova assegnazione, gestione assenze).
- CA1: i contatori riflettono lo stato reale dei dati (nessun valore statico/finto).
- CA2: l'invio di una nuova richiesta da parte di un dipendente incrementa il contatore inbox in tempo utile.

### RF-L — Profilo e disponibilità (dipendente) — *self-service diretto*
- Il dipendente modifica i **campi consentiti** del proprio profilo (recapiti, preferenze di contatto). I campi **contrattuali/organizzativi** (qualifica, ore contrattuali, tipo contratto, ruolo, stato) sono in **sola lettura** per il dipendente e modificabili solo dall'admin (RB-13). Cambio della propria password consentito.
- Il dipendente inserisce/modifica/elimina la propria **disponibilità e preferenze** (finestre di disponibilità/indisponibilità, preferenze di turno), considerate come vincolo **soft** in pianificazione (RB-15).
- CA1: il dipendente che tenta di modificare un campo contrattuale (via UI o API) riceve **403**/errore di validazione; il campo non cambia (RB-13, T-SEC-05).
- CA2: la disponibilità inserita è visibile all'admin nella pianificazione e genera un **avviso** se un turno la contraddice (RB-15, T-REQ-05).
- CA3: il dipendente può gestire solo la **propria** disponibilità e il **proprio** profilo (T-SEC).

### RF-M — Richieste del dipendente e workflow di approvazione — *self-service con approvazione*
- Il dipendente crea richieste di tipo: **assenza** (ferie/permesso/malattia), **scambio turno** (con un turno di un collega), **nuovo turno** (candidatura/copertura di una fascia), **modifica turno** (proposta di modifica orario/tipologia di un proprio turno).
- **Ciclo di vita:** `bozza → inviata → [in_attesa_collega, se scambio] → approvata | rifiutata`; se approvata → `applicata` (con effetto sui dati). Il dipendente può **annullare** una richiesta finché non è applicata (RB-16).
- **Rivalidazione all'approvazione:** al momento dell'approvazione, il sistema riapplica le regole RB pertinenti sullo stato risultante; se l'applicazione genererebbe una violazione **bloccante**, l'approvazione è **impedita** con motivo (RB-14).
- **Scambio con collega:** se il tipo è scambio, il collega bersaglio deve **accettare** la proposta prima che l'admin possa approvarla (stato `in_attesa_collega`); il collega può rifiutare, chiudendo la richiesta.
- CA1: una richiesta di assenza approvata crea un'**assenza attiva**; da quel momento non è possibile assegnare turni in quelle date (RB-08, T-REQ-01).
- CA2: una richiesta di scambio approvata esegue lo swap solo se supera RB-10 per entrambe le parti; altrimenti l'approvazione è bloccata (T-REQ-02).
- CA3: il dipendente vede lo **stato** delle proprie richieste e le notifiche relative; non può vedere le richieste altrui (T-SEC-07).
- CA4: il dipendente non può **approvare** alcuna richiesta, nemmeno le proprie; l'approvazione è esclusiva dell'admin (T-SEC-06).
- CA5: una richiesta **applicata, rifiutata o annullata** non è più modificabile (RB-16, T-REQ-04).
- CA6: solo il **collega destinatario** può accettare/rifiutare una proposta di scambio a lui indirizzata (T-SEC-08).

### RF-N — Notifiche
- Eventi che generano notifica (canale **in-app** di default; email opzionale):
  - **Al dipendente:** esito della propria richiesta (approvata/rifiutata); proposta di scambio ricevuta da un collega da accettare; modifica dell'admin ai propri turni (assegnazione/annullamento).
  - **All'admin:** nuova richiesta in attesa di approvazione; accettazione/rifiuto di uno scambio da parte del collega.
- CA1: all'invio di una richiesta, l'admin riceve una notifica e il contatore inbox si incrementa.
- CA2: all'approvazione/rifiuto, il dipendente richiedente riceve una notifica con l'esito.
- CA3: le notifiche rispettano i confini di autorizzazione: un dipendente non riceve notifiche relative a dati altrui, salvo la proposta di scambio a lui indirizzata (T-SEC).

---

## 6. Regole di business (parametriche)

Legenda severità: **BLOCCANTE** = salvataggio/approvazione impediti · **AVVISO** = consentito con conferma · **CORRETTEZZA** = requisito di calcolo, non un avviso.

| ID | Regola | Severità (default) | Parametro |
|---|---|---|---|
| RB-01 | Un dipendente non può avere due turni che si **sovrappongono** nel tempo (inclusi i notturni). | BLOCCANTE | — |
| RB-02 | Tra la fine di un turno e l'inizio del successivo devono passare almeno *N* ore. | AVVISO (configurabile a BLOCCANTE) | `riposoMinimoOre = 11` |
| RB-03 | Ogni dipendente deve avere almeno *M* ore continuative di riposo ogni 7 giorni. | AVVISO | `riposoSettimanaleOre = 24` |
| RB-04 | Non più di *K* giorni lavorativi consecutivi. | AVVISO | `maxGiorniConsecutivi = 6` |
| RB-05 | Le ore settimanali non superano una soglia; oltre l'hard cap è bloccante. | AVVISO (soft) / BLOCCANTE (hard) | `oreSettSoft = 48`, `oreSettHard = 60`, `periodoRiferimentoSettimane = 4` |
| RB-06 | Le ore oltre le contrattuali sono **straordinario**; oltre la soglia mensile scatta avviso. | AVVISO oltre soglia | `maxStraordinarioMensileOre = 40` |
| RB-07 | Il numero di persone con la qualifica richiesta in una fascia ≥ minimo del fabbisogno. | AVVISO (sotto-copertura) | definito per fabbisogno |
| RB-08 | Nessun turno può essere assegnato a un dipendente **in assenza** in quella data. | BLOCCANTE | — |
| RB-09 | Modifica/creazione di turni **nel passato**. | AVVISO (configurabile a BLOCCANTE) | `bloccaPassato = false` |
| RB-10 | Uno **swap** è valido solo se, dopo l'esecuzione, entrambe le parti rispettano RB-01…RB-08. Genera bloccante ⇒ rifiutato; genera solo avvisi ⇒ conferma. | eredita dalle regole | — |
| RB-11 | La **generazione ricorrente** rispetta assenze/festivi e non crea turni in violazione; i conflitti sono riportati, non forzati. | eredita dalle regole | `gestioneFestivi` |
| RB-12 | Durata dei turni e "giorno di competenza" calcolati correttamente attraverso **mezzanotte** e **cambio ora legale**. | CORRETTEZZA | `timezone = Europe/Rome` |
| RB-13 | Il dipendente può modificare **solo i campi non contrattuali** del proprio profilo; qualifica, ore contrattuali, tipo contratto, ruolo e stato sono riservati all'admin. | BLOCCANTE (rifiuto lato server) | — |
| RB-14 | L'**approvazione di una richiesta** riapplica le regole RB pertinenti sullo stato risultante; se emerge una violazione bloccante, l'approvazione è impedita. | eredita (blocca se bloccante) | — |
| RB-15 | Un turno che contraddice una **indisponibilità dichiarata** dal dipendente genera un avviso in pianificazione. | AVVISO (configurabile a BLOCCANTE) | `bloccaSuIndisponibilita = false` |
| RB-16 | Una richiesta in stato `applicata`, `rifiutata` o `annullata` è **immutabile**; modifiche/annullo consentiti solo negli stati `bozza`/`inviata`/`in_attesa_collega` (annullo fino a prima dell'applicazione). | BLOCCANTE | — |
| RB-17 | *(Opzionale)* Le richieste di assenza richiedono un **preavviso minimo**. | AVVISO se attivo | `preavvisoMinimoAssenzaGiorni = 0` (0 = disattivato) |

> Tutti i parametri sono **configurabili** con i default indicati. Le severità marcate come configurabili sono impostabili dall'admin.

---

## 7. Flussi principali

**F1 — Pianificazione settimanale (admin).** Apertura matrice → selezione settimana → assegnazione turni per cella → validazione in tempo reale → risoluzione avvisi → salvataggio → verifica coperture in dashboard.

**F2 — Generazione ciclo rotativo (admin).** Definizione ciclo (sequenza tipologie, lunghezza, offset per dipendente) → intervallo date → anteprima → generazione → revisione report conflitti → correzione manuale dei residui.

**F3 — Scambio turni avviato dall'admin.** Selezione turno A e turno B → anteprima impatto su entrambe le parti → esito validazione (RB-10) → conferma o annullamento → tracciamento in audit.

**F4 — Gestione assenza (admin).** Registrazione assenza → rilevazione turni in conflitto → scelta azione (annulla/riassegna) → aggiornamento coperture.

**F5 — Consultazione dipendente.** Login → calendario personale → cambio vista giorno/settimana/mese → dettaglio turno → (opz.) export .ics.

**F6 — Richiesta di assenza (dipendente → admin).** Dipendente crea richiesta assenza → invia → admin riceve notifica (inbox) → admin approva/rifiuta con rivalidazione (RB-14) → se approvata, l'assenza diventa attiva e i turni in conflitto sono segnalati → notifica esito al dipendente.

**F7 — Richiesta di scambio (dipendente ↔ collega ↔ admin).** Dipendente propone scambio con un turno di un collega → il collega riceve la notifica e **accetta/rifiuta** → se accettato, l'admin vede la richiesta in inbox → anteprima impatto (RB-10) → approva/rifiuta → esecuzione dello swap o blocco → notifiche a entrambe le parti.

**F8 — Richiesta di nuovo turno / modifica turno (dipendente → admin).** Dipendente propone un nuovo turno (copertura) o una modifica a un proprio turno → invia → admin valuta con anteprima impatto → approva (con rivalidazione RB-14) o rifiuta → applicazione o blocco → notifica esito.

**F9 — Gestione disponibilità (dipendente).** Dipendente apre disponibilità/preferenze → inserisce/modifica finestre → salva → l'admin le vede in pianificazione; un turno in conflitto genera avviso (RB-15).

---

## 8. Notifiche (riepilogo)

Le notifiche sono trattate funzionalmente in **RF-N**. In sintesi:
- Canale **in-app** obbligatorio (indicatore/centro notifiche); **email** opzionale e configurabile.
- Ogni notifica è indirizzata a un singolo destinatario e non rivela dati fuori dai suoi confini di autorizzazione.
- Eventi minimi: `richiesta_ricevuta` (→ admin), `esito_richiesta` (→ dipendente), `scambio_da_accettare` (→ collega), `turno_modificato` (→ dipendente interessato).

---

## 9. Requisiti non funzionali

**RNF-Sicurezza**
- Autorizzazione verificata lato server su **ogni** endpoint; nessuna fiducia nel client.
- Protezione da **IDOR**: nessun accesso a risorse altrui manipolando identificativi in URL/parametri/payload.
- **Autorizzazione a livello di campo** sul profilo: i campi contrattuali sono rifiutati se modificati dal dipendente (RB-13).
- **Autorizzazione di stato** sulle richieste: solo l'admin approva/rifiuta; il dipendente agisce solo sulle proprie richieste e solo negli stati consentiti (RB-16); l'accettazione di uno scambio è possibile solo al collega destinatario.
- Validazione e sanificazione di tutti gli input; le regole RB sono applicate **lato server** oltre che in UI.
- Password con hashing robusto; messaggi d'errore di login non rivelano quale campo è errato.
- AuditLog delle operazioni di scrittura rilevanti (assegnazioni, swap, assenze, modifiche anagrafiche, decisioni sulle richieste).

**RNF-Performance**
- La matrice con ≥ 50 dipendenti × 31 giorni si carica e resta interattiva senza blocchi percepibili.
- La validazione di un'assegnazione e la rivalidazione all'approvazione danno esito in tempi interattivi.

**RNF-Internazionalizzazione / tempo**
- Gestione corretta del fuso orario e del cambio ora legale (RB-12); date e orari nel formato locale.
- Primo giorno della settimana e formato data configurabili (default: lunedì, formato italiano/ISO).

**RNF-Accessibilità**
- Matrice e calendari navigabili e leggibili; i colori delle tipologie hanno contrasto sufficiente e non sono l'unico veicolo d'informazione (etichette oltre al colore). Gli stati delle richieste sono distinguibili anche senza colore.

**RNF-Responsive**
- Layout utilizzabile da desktop a mobile: la matrice adotta scroll orizzontale con intestazioni fisse o un collasso adeguato; le viste dipendente (turni, richieste, disponibilità) sono pienamente usabili su smartphone.

**RNF-Stati dell'interfaccia**
- Ogni vista che carica dati gestisce esplicitamente gli stati **caricamento**, **vuoto**, **errore** oltre allo stato con dati.

---

## 10. Inventario schermate (per il Figma)

Per ciascuna schermata: ruolo, scopo, componenti chiave, stati da rappresentare.

| # | Schermata | Ruolo | Scopo | Componenti chiave | Stati |
|---|---|---|---|---|---|
| 1 | Login | Tutti | Accesso | Form email/password, errore credenziali, link reset | Default, errore, caricamento |
| 2 | Dashboard admin | Admin | Sintesi operativa | KPI (coperture, violazioni, ore, straordinari, assenze), **badge inbox richieste**, scorciatoie | Con dati, vuoto, caricamento |
| 3 | Matrice turni — settimana | Admin | Pianificazione | Griglia dipendenti×giorni, header sticky, celle turno colorate, badge violazioni/indisponibilità, filtri | Con dati, vuoto, caricamento, errore |
| 4 | Matrice turni — mese | Admin | Pianificazione mensile | Variante densa della griglia, navigazione mese | Con dati, vuoto, caricamento |
| 5 | Editor turno (modale su cella) | Admin | Crea/modifica turno | Selettore tipologia, orari custom, note, flag straordinario, **pannello avvisi/violazioni** | Nuovo, modifica, con avvisi, con bloccante |
| 6 | Definizione ricorrenza/ciclo | Admin | Turni ripetuti | Wizard: tipo, sequenza tipologie, intervallo date, target, anteprima | Setup, anteprima, report conflitti |
| 7 | Scambio turni (swap) | Admin | Scambiare turni | Selezione turno A/B, **anteprima impatto** su entrambe le parti, esito validazione | Selezione, esito ok, esito rifiutato |
| 8 | Gestione assenze | Admin | Registrare assenze | Form tipo/intervallo, elenco turni in conflitto con azioni | Default, con conflitti, vuoto |
| 9 | Fabbisogni / coperture | Admin | Definire minimi e monitorare | Setup fabbisogni; vista sotto-copertura per giorno/fascia con scarti | Setup, monitor, vuoto |
| 10 | Anagrafica dipendenti | Admin | Gestire persone | Lista con ricerca/filtri; dettaglio/edit (qualifica, contratto, stato) | Lista, dettaglio, vuoto, errore |
| 11 | Tipologie di turno | Admin | Gestire modelli turno | Lista tipologie; editor (orari, colore, pausa, notturno) | Lista, editor, vuoto |
| 12 | Report straordinari/ore | Admin | Analisi ore | Tabella per dipendente/periodo (ordinarie, straordinarie, totale), filtri | Con dati, vuoto, caricamento |
| 13 | Coda richieste / approvazioni | Admin | Approvare le richieste | Inbox con richieste in attesa, filtri per tipo/stato; dettaglio con **anteprima impatto** e azioni approva/rifiuta | Con richieste, vuoto, dettaglio, esito bloccato |
| 14 | Calendario dipendente | Dipendente | Consultazione | Viste giorno/settimana/mese dei **soli propri** turni, riepilogo ore, export .ics | Con dati, vuoto, caricamento |
| 15 | Dettaglio turno (dipendente) | Dipendente | Dettaglio | Orari, tipologia, note (sola lettura); azione "richiedi modifica/scambio" | Default |
| 16 | Profilo personale (dipendente) | Dipendente | Dati personali | **Modifica campi consentiti** (recapiti, preferenze), campi contrattuali in sola lettura, cambio password | Visualizzazione, modifica, errore validazione, cambio password |
| 17 | Disponibilità e preferenze (dipendente) | Dipendente | Gestire disponibilità | Editor finestre disponibile/non disponibile/preferenza (ricorrenti o a date), elenco voci | Con voci, vuoto, modifica |
| 18 | Le mie richieste (dipendente) | Dipendente | Elenco richieste | Lista con stato e tipo, filtri; include le proposte di scambio ricevute da accettare | Con richieste, vuoto, caricamento |
| 19 | Nuova richiesta (dipendente) | Dipendente | Creare una richiesta | **Form dinamico per tipo** (assenza / scambio → selezione turno collega / nuovo turno / modifica turno), validazione | Selezione tipo, compilazione, invio |
| 20 | Dettaglio richiesta (dipendente) | Dipendente | Stato e azioni | Stato, cronologia, motivo decisione; azioni: annulla (se consentito), accetta/rifiuta scambio ricevuto | In attesa, approvata, rifiutata, da accettare |
| 21 | Centro notifiche | Tutti | Notifiche | Indicatore (bell) + elenco notifiche, lette/non lette, link all'entità | Con notifiche, vuoto |
| 22 | Stati globali / errori | Tutti | Coerenza UX | Empty state, schermata errore, skeleton di caricamento (in particolare per la matrice) | — |

---

## 11. Casi di test trasversali (criteri di accettazione verificabili)

Scenari concreti che l'output del sistema deve superare. Sono la base per valutare la correttezza sul dominio.

**Correttezza dominio**
- **T-DOM-01 (notturno):** *Notte 22:00–06:00* → durata 8h, `attraversaMezzanotte = true`, data di competenza corretta.
- **T-DOM-02 (sovrapposizione):** a Mario turno 08:00–16:00 poi 14:00–22:00 stesso giorno → **bloccato** (RB-01).
- **T-DOM-03 (riposo 11h):** Mario finisce alle 22:00 (giorno X) e viene assegnato alle 06:00 del giorno X+1 → riposo 8h < 11h → **avviso** (RB-02).
- **T-DOM-04 (assenza):** Luca in ferie 10–14; assegnazione il 12 → **bloccata** (RB-08).
- **T-DOM-05 (7° giorno):** 7 turni in 7 giorni consecutivi → **avviso** (RB-04).
- **T-DOM-06 (straordinario):** 40h contrattuali, 46h assegnate → 6h straordinario (RB-06).
- **T-DOM-07 (sotto-copertura):** fascia notte richiede 3 Infermieri, pianificati 2 → **sotto-coperta (-1)** (RB-07).
- **T-DOM-08 (cambio ora legale):** turno notturno che attraversa il cambio ora → durata reale corretta (7h o 9h) (RB-12).

**Ricorrenze / swap**
- **T-REC-01:** ricorrenza settimanale su un giorno di assenza → occorrenza saltata/segnalata (RB-11).
- **T-REC-02:** modifica singola occorrenza non altera la serie; modifica serie propaga alle future non personalizzate.
- **T-SWP-01:** swap Mario(notte)↔Luca(mattina) che lascia Mario con riposo < soglia bloccante → **rifiutato** con parte e regola (RB-10).
- **T-SWP-02:** swap che genera solo avvisi → consentito previa conferma; tracciato in audit.

**Richieste e workflow di approvazione**
- **T-REQ-01 (ciclo assenza):** il dipendente invia richiesta assenza → l'admin approva → assenza attiva → assegnazione turno in quelle date **bloccata** (RB-08 via richiesta).
- **T-REQ-02 (rivalidazione all'approvazione):** richiesta il cui esito creerebbe una sovrapposizione (RB-01) → **approvazione bloccata** con motivo (RB-14).
- **T-REQ-03 (scambio con accettazione collega):** il dipendente propone uno scambio → il collega deve accettare prima dell'approvazione admin; se il collega rifiuta, la richiesta non arriva ad approvazione.
- **T-REQ-04 (immutabilità):** tentativo di modificare una richiesta già `applicata`/`rifiutata` → **impedito** (RB-16).
- **T-REQ-05 (disponibilità soft):** turno assegnato in una finestra di indisponibilità dichiarata → **avviso** (RB-15).

**Integrazione tra componenti (chiave per un sistema multi-agente)**
- **T-INT-01:** la stessa assegnazione che la UI segnala come bloccante viene **rifiutata anche dall'API** con lo stesso motivo; una segnalata come avviso viene **accettata** dall'API (parità di regole UI↔backend, sia in matrice sia in approvazione richieste).
- **T-INT-02:** salvataggio concorrente di due turni sovrapposti per lo stesso dipendente da due sessioni → uno solo va a buon fine; l'altro riceve un conflitto (nessun double-booking).
- **T-INT-03:** all'invio di una richiesta, il badge inbox dell'admin e il centro notifiche si aggiornano coerentemente con lo stato reale.

**Sicurezza / autorizzazione**
- **T-SEC-01:** il dipendente A richiede i turni passando l'id di B (o senza filtro) → riceve **solo i propri** o un **403**, mai i turni di B.
- **T-SEC-02:** il dipendente invoca una scrittura **non consentita** (pianificazione turni, anagrafica altrui, approvazioni) → **403** lato server. (Le scritture consentite restano: proprio profilo — campi consentiti —, propria disponibilità, proprie richieste.)
- **T-SEC-03:** accesso a una risorsa per id inesistente/non autorizzato → **404/403** coerente, nessuna fuga d'informazione.
- **T-SEC-04:** sessione scaduta → le API rispondono **401**.
- **T-SEC-05 (campi contrattuali):** il dipendente tenta di modificare qualifica/ore contrattuali/ruolo via API → **403**/rifiutato; il valore non cambia (RB-13).
- **T-SEC-06 (approvazione riservata):** il dipendente tenta di approvare una richiesta (propria o altrui) via API → **403**.
- **T-SEC-07 (richieste altrui):** il dipendente A tenta di leggere/modificare una richiesta di B → **403/404**, mai accesso.
- **T-SEC-08 (accettazione scambio):** un dipendente che non è il collega bersaglio tenta di accettare uno scambio → **403**.

---

## 12. Parametri di configurazione (riepilogo default)

| Parametro | Default |
|---|---|
| `riposoMinimoOre` | 11 |
| `riposoSettimanaleOre` | 24 |
| `maxGiorniConsecutivi` | 6 |
| `oreSettSoft` / `oreSettHard` | 48 / 60 |
| `periodoRiferimentoSettimane` | 4 |
| `maxStraordinarioMensileOre` | 40 |
| `bloccaPassato` | false |
| `bloccaSuIndisponibilita` | false |
| `scambioRichiedeAccettazioneCollega` | true |
| `preavvisoMinimoAssenzaGiorni` | 0 (disattivato) |
| `canaleNotifiche` | in-app (email opzionale) |
| `timezone` | Europe/Rome |
| Inizio settimana | Lunedì |
| Scadenza sessione | configurabile (es. 8h) |

---

## 13. Appendice — assunzioni

- **Self-service dipendente su due livelli:** scrittura **diretta** sui propri dati personali (profilo — campi consentiti — e disponibilità/preferenze); azioni sui turni **solo tramite richieste** con approvazione admin. Il dipendente non scrive direttamente sulla pianificazione pubblicata. *Variante alternativa disponibile: scrittura diretta del dipendente sui propri turni, se richiesto.*
- **Swap:** eseguibile dall'admin o originato da una richiesta di scambio del dipendente; in ogni caso vale RB-10. Lo scambio da richiesta prevede l'accettazione del collega prima dell'approvazione admin (parametrico).
- **"Carica i turni" = inserimento diretto in matrice** (manuale o via ricorrenza). L'import massivo da file (CSV/Excel) è un'estensione non richiesta.
- **Singola sede / singolo fuso** in questa versione; il multi-sede è out of scope.
- Le soglie normative (riposi, ore, preavvisi) sono modellate come parametri di default a scopo di test e **non costituiscono riferimento legale**; vanno adattate al contesto reale d'uso.
