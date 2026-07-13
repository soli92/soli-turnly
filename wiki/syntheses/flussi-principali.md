---
type: synthesis
title: "Flussi Principali (F1..F9)"
status: draft
created: 2026-07-13
source_path: raw/turnly-documento-funzionale.md
ingested_by: wiki-keeper
pattern_section: "§7"
---

# Flussi Principali

I nove flussi operativi di Turnly. I flussi F1-F4 sono prevalentemente admin; F5 è il flusso
dipendente di consultazione; F6-F8 sono i flussi di richiesta self-service; F9 è il flusso
di gestione disponibilità.

Vedi anche: [[requisiti-funzionali]] | [[regole-di-business]] | [[casi-di-test]]

---

## F1 — Pianificazione settimanale (admin)

**Attore principale:** Admin

```
Apertura matrice
  → selezione settimana
  → assegnazione turni per cella
  → validazione in tempo reale (RB-01..RB-09, RB-15)
  → risoluzione avvisi
  → salvataggio
  → verifica coperture in dashboard (RF-K)
```

Requisiti correlati: [[requisiti-funzionali]] RF-D, RF-H.

[^src: raw/turnly-documento-funzionale.md §7 F1]

---

## F2 — Generazione ciclo rotativo (admin)

**Attore principale:** Admin

```
Definizione ciclo (sequenza tipologie, lunghezza, offset per dipendente)
  → intervallo date
  → anteprima
  → generazione
  → revisione report conflitti
  → correzione manuale dei residui
```

La generazione rispetta assenze/festivi e non forza turni in violazione (RB-11).

Requisiti correlati: [[requisiti-funzionali]] RF-E.

[^src: raw/turnly-documento-funzionale.md §7 F2]

---

## F3 — Scambio turni avviato dall'admin

**Attore principale:** Admin

```
Selezione turno A e turno B
  → anteprima impatto su entrambe le parti
  → esito validazione (RB-10)
  → conferma o annullamento
  → tracciamento in AuditLog
```

Uno swap che genera una violazione bloccante per una delle due parti è rifiutato.

Requisiti correlati: [[requisiti-funzionali]] RF-F.

[^src: raw/turnly-documento-funzionale.md §7 F3]

---

## F4 — Gestione assenza (admin)

**Attore principale:** Admin

```
Registrazione assenza (tipo + intervallo)
  → rilevazione turni in conflitto nell'intervallo
  → scelta azione per ciascun turno (annulla / riassegna)
  → aggiornamento coperture
```

I turni in conflitto non vengono eliminati silenziosamente; vengono segnalati con azioni
proposte (RF-G CA2).

Requisiti correlati: [[requisiti-funzionali]] RF-G.

[^src: raw/turnly-documento-funzionale.md §7 F4]

---

## F5 — Consultazione dipendente

**Attore principale:** Dipendente

```
Login
  → calendario personale
  → cambio vista giorno / settimana / mese
  → dettaglio turno (orari, tipologia, note)
  → (opzionale) export .ics
```

Il dipendente vede **esclusivamente** i propri turni (T-SEC-01/02). Non sono disponibili
controlli di scrittura diretta sulla pianificazione.

Requisiti correlati: [[requisiti-funzionali]] RF-J.

[^src: raw/turnly-documento-funzionale.md §7 F5]

---

## F6 — Richiesta di assenza (dipendente → admin)

**Attori:** Dipendente (inizia), Admin (decide)

```
Dipendente crea richiesta assenza (tipo + intervallo)
  → invia
  → Admin riceve notifica in inbox
  → Admin approva / rifiuta (con rivalidazione RB-14)
     → Se approvata:
          assenza diventa attiva
          turni in conflitto segnalati
          notifica esito al dipendente
     → Se rifiutata:
          notifica con motivazione al dipendente
```

Alla prima approvazione, nessun turno può essere assegnato in quelle date (RB-08).

Requisiti correlati: [[requisiti-funzionali]] RF-M CA1, RF-G, RF-N.

[^src: raw/turnly-documento-funzionale.md §7 F6]

---

## F7 — Richiesta di scambio (dipendente ↔ collega ↔ admin)

**Attori:** Dipendente richiedente, Collega bersaglio, Admin

```
Dipendente propone scambio con un turno di un collega
  → Collega bersaglio riceve notifica
  → Collega accetta / rifiuta
     → Se rifiuta: richiesta chiusa, notifica al richiedente
     → Se accetta:
          Admin vede la richiesta in inbox (stato in_attesa_collega → inviata)
          Admin valuta con anteprima impatto (RB-10)
          Admin approva / rifiuta
             → Se approva e supera RB-10: swap eseguito, notifiche a entrambe le parti
             → Se approva e RB-10 bloccante: approvazione impedita con motivo (RB-14)
             → Se rifiuta: notifiche a entrambe le parti
```

Requisiti correlati: [[requisiti-funzionali]] RF-M CA2/CA6, RF-F, RF-N.

[^src: raw/turnly-documento-funzionale.md §7 F7]

---

## F8 — Richiesta di nuovo turno / modifica turno (dipendente → admin)

**Attori:** Dipendente (inizia), Admin (decide)

```
Dipendente propone un nuovo turno (copertura) O una modifica a un proprio turno
  → invia
  → Admin valuta con anteprima impatto
  → Admin approva (con rivalidazione RB-14) o rifiuta
     → Se approvata e supera RB-14: applicazione (turno creato / modificato), notifica esito
     → Se approvata ma RB-14 bloccante: approvazione impedita con motivo
     → Se rifiutata: notifica con motivazione al dipendente
```

Requisiti correlati: [[requisiti-funzionali]] RF-M, RF-N.

[^src: raw/turnly-documento-funzionale.md §7 F8]

---

## F9 — Gestione disponibilità (dipendente)

**Attore principale:** Dipendente

```
Dipendente apre vista disponibilità/preferenze
  → inserisce / modifica / elimina finestre
       (disponibile, non disponibile, preferenza)
       (ambito: ricorrente o intervallo di date)
  → salva
  → L'admin le vede in pianificazione
  → Un turno assegnato in contraddizione genera avviso (RB-15)
```

La disponibilità è un vincolo **soft** (AVVISO, non bloccante per default). Il parametro
`bloccaSuIndisponibilita` permette di renderlo bloccante.

Requisiti correlati: [[requisiti-funzionali]] RF-L CA2.

[^src: raw/turnly-documento-funzionale.md §7 F9]

---

## Schema attori × flussi

| Flusso | Admin | Dipendente | Collega |
|---|---|---|---|
| F1 Pianificazione settimanale | inizia e chiude | — | — |
| F2 Generazione ciclo | inizia e chiude | — | — |
| F3 Swap admin | inizia e chiude | — | — |
| F4 Gestione assenza admin | inizia e chiude | — | — |
| F5 Consultazione | — | legge | — |
| F6 Richiesta assenza | decide | inizia | — |
| F7 Richiesta scambio | decide | inizia | accetta/rifiuta |
| F8 Richiesta nuovo turno/modifica | decide | inizia | — |
| F9 Gestione disponibilità | consulta in matrice | inizia e chiude | — |
