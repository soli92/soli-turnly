---
type: concept
title: "Regole di Business (RB-01..RB-17)"
status: draft
created: 2026-07-13
source_path: raw/turnly-documento-funzionale.md
ingested_by: wiki-keeper
pattern_section: "§6, §12"
---

# Regole di Business

Regole parametriche che governano la validazione di turni, assenze, swap e richieste in
Turnly. Tutte le regole sono applicate **lato server** oltre che in UI.

Vedi anche: [[dominio-turnazione]] | [[requisiti-funzionali]] | [[casi-di-test]]

---

## Legenda severità

| Severità | Significato |
|---|---|
| **BLOCCANTE** | Salvataggio/approvazione impediti. |
| **AVVISO** | Consentito con conferma esplicita. |
| **CORRETTEZZA** | Requisito di calcolo, non un avviso visivo. |

---

## Tabella regole

| ID | Regola | Severità (default) | Parametro |
|---|---|---|---|
| **RB-01** | Un dipendente non può avere due turni che si **sovrappongono** nel tempo (inclusi i notturni). | BLOCCANTE | — |
| **RB-02** | Tra la fine di un turno e l'inizio del successivo devono passare almeno *N* ore. | AVVISO (configurabile a BLOCCANTE) | `riposoMinimoOre = 11` |
| **RB-03** | Ogni dipendente deve avere almeno *M* ore continuative di riposo ogni 7 giorni. | AVVISO | `riposoSettimanaleOre = 24` |
| **RB-04** | Non più di *K* giorni lavorativi consecutivi. | AVVISO | `maxGiorniConsecutivi = 6` |
| **RB-05** | Le ore settimanali non superano una soglia; oltre l'hard cap è bloccante. | AVVISO (soft) / BLOCCANTE (hard) | `oreSettSoft = 48`, `oreSettHard = 60`, `periodoRiferimentoSettimane = 4` |
| **RB-06** | Le ore oltre le contrattuali sono **straordinario**; oltre la soglia mensile scatta avviso. | AVVISO oltre soglia | `maxStraordinarioMensileOre = 40` |
| **RB-07** | Il numero di persone con la qualifica richiesta in una fascia ≥ minimo del fabbisogno. | AVVISO (sotto-copertura) | definito per fabbisogno |
| **RB-08** | Nessun turno può essere assegnato a un dipendente **in assenza** in quella data. | BLOCCANTE | — |
| **RB-09** | Modifica/creazione di turni **nel passato**. | AVVISO (configurabile a BLOCCANTE) | `bloccaPassato = false` |
| **RB-10** | Uno **swap** è valido solo se, dopo l'esecuzione, entrambe le parti rispettano RB-01…RB-08. Genera bloccante → rifiutato; genera solo avvisi → conferma. | eredita dalle regole | — |
| **RB-11** | La **generazione ricorrente** rispetta assenze/festivi e non crea turni in violazione; i conflitti sono riportati, non forzati. | eredita dalle regole | `gestioneFestivi` |
| **RB-12** | Durata dei turni e "giorno di competenza" calcolati correttamente attraverso **mezzanotte** e **cambio ora legale**. | CORRETTEZZA | `timezone = Europe/Rome` |
| **RB-13** | Il dipendente può modificare **solo i campi non contrattuali** del proprio profilo; qualifica, ore contrattuali, tipo contratto, ruolo e stato sono riservati all'admin. | BLOCCANTE (rifiuto lato server) | — |
| **RB-14** | L'**approvazione di una richiesta** riapplica le regole RB pertinenti sullo stato risultante; se emerge una violazione bloccante, l'approvazione è impedita. | eredita (blocca se bloccante) | — |
| **RB-15** | Un turno che contraddice una **indisponibilità dichiarata** dal dipendente genera un avviso in pianificazione. | AVVISO (configurabile a BLOCCANTE) | `bloccaSuIndisponibilita = false` |
| **RB-16** | Una richiesta in stato `applicata`, `rifiutata` o `annullata` è **immutabile**; modifiche/annullo consentiti solo negli stati `bozza`/`inviata`/`in_attesa_collega` (annullo fino a prima dell'applicazione). | BLOCCANTE | — |
| **RB-17** | *(Opzionale)* Le richieste di assenza richiedono un **preavviso minimo**. | AVVISO se attivo | `preavvisoMinimoAssenzaGiorni = 0` (0 = disattivato) |

[^src: raw/turnly-documento-funzionale.md §6 Regole di business]

---

## Parametri di configurazione (default)

Tutti i parametri sono configurabili; le severità marcate come configurabili sono impostabili
dall'admin.

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

> Le soglie normative (riposi, ore, preavvisi) sono modellate come parametri di default a
> scopo di test e **non costituiscono riferimento legale**; vanno adattate al contesto reale
> d'uso.

[^src: raw/turnly-documento-funzionale.md §12 Parametri di configurazione]

---

## Note critiche su regole composite

### RB-10 — Swap
Uno swap (avviato dall'admin o da richiesta di scambio) è rifiutato se, dopo l'esecuzione,
anche una sola delle due parti viola una regola BLOCCANTE (RB-01..RB-08). Se genera solo
avvisi, è consentito previa conferma. Vedi [[requisiti-funzionali]] RF-F e test T-SWP-*.

### RB-14 — Rivalidazione all'approvazione
Al momento dell'approvazione di qualsiasi richiesta, il sistema riesegue le regole RB
pertinenti sullo stato risultante. Se emerge una violazione BLOCCANTE, l'approvazione è
impedita con indicazione del motivo. Questo chiude il gap tra la validazione UI e la
validazione di backend. Vedi test T-INT-01 e T-REQ-02.

### RB-12 — Mezzanotte e DST
I turni notturni (es. 22:00–06:00) attraversano la mezzanotte: `durataMinuti` è derivata
correttamente, `attraversaMezzanotte = true`, la data di fine è il giorno successivo. Il
cambio ora legale (DST) può produrre durate reali di 7h o 9h per turni che attraversano
l'ora di cambio — calcolate sul fuso configurato (`Europe/Rome`). Vedi test T-DOM-01 e
T-DOM-08.
