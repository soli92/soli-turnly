---
type: synthesis
title: "Requisiti Non Funzionali e Assunzioni"
status: draft
created: 2026-07-13
source_path: raw/turnly-documento-funzionale.md
ingested_by: wiki-keeper
pattern_section: "§9, §13"
---

# Requisiti Non Funzionali e Assunzioni

Requisiti non funzionali (RNF) e assunzioni di progetto per Turnly.

Vedi anche: [[dominio-turnazione]] | [[ruoli-e-permessi]] | [[regole-di-business]] | [[casi-di-test]]

---

## RNF-Sicurezza

- **Autorizzazione server-side obbligatoria** su ogni endpoint; nessuna fiducia nel client.
- **Protezione IDOR:** nessun accesso a risorse altrui manipolando identificativi in URL/parametri/payload.
- **Autorizzazione a livello di campo** sul profilo: i campi contrattuali sono rifiutati se modificati dal dipendente (RB-13).
- **Autorizzazione di stato** sulle richieste:
  - Solo l'admin approva/rifiuta.
  - Il dipendente agisce solo sulle proprie richieste e solo negli stati consentiti (RB-16).
  - L'accettazione di uno scambio è possibile solo al collega destinatario.
- Validazione e sanificazione di tutti gli input; le regole RB sono applicate **lato server** oltre che in UI.
- Password con hashing robusto; messaggi d'errore di login non rivelano quale campo è errato.
- **AuditLog** delle operazioni di scrittura rilevanti: assegnazioni, swap, assenze, modifiche anagrafiche, decisioni sulle richieste.

Test di riferimento: T-SEC-01..T-SEC-08 (vedi [[casi-di-test]]).

[^src: raw/turnly-documento-funzionale.md §9 RNF-Sicurezza]

---

## RNF-Performance

- La matrice con ≥ 50 dipendenti × 31 giorni si carica e resta interattiva senza blocchi percepibili.
- La validazione di un'assegnazione e la rivalidazione all'approvazione danno esito in tempi interattivi.

Test di riferimento: RF-D CA6 (vedi [[requisiti-funzionali]]).

[^src: raw/turnly-documento-funzionale.md §9 RNF-Performance]

---

## RNF-Internazionalizzazione / Tempo

- Gestione corretta del fuso orario e del cambio ora legale (RB-12); date e orari nel formato locale.
- Primo giorno della settimana e formato data configurabili (default: lunedì, formato italiano/ISO).
- Timezone configurata: `Europe/Rome`.

Test di riferimento: T-DOM-01, T-DOM-08 (vedi [[casi-di-test]]).

[^src: raw/turnly-documento-funzionale.md §9 RNF-Internazionalizzazione]

---

## RNF-Accessibilità

- Matrice e calendari navigabili e leggibili.
- I **colori** delle tipologie di turno hanno contrasto sufficiente e **non sono l'unico veicolo d'informazione**: le etichette affiancano sempre il colore.
- Gli stati delle richieste sono distinguibili anche senza colore.

[^src: raw/turnly-documento-funzionale.md §9 RNF-Accessibilità]

---

## RNF-Responsive

- Layout utilizzabile da desktop a mobile.
- La **matrice** adotta scroll orizzontale con intestazioni fisse o un collasso adeguato.
- Le viste dipendente (turni, richieste, disponibilità) sono pienamente usabili su smartphone.

[^src: raw/turnly-documento-funzionale.md §9 RNF-Responsive]

---

## RNF-Stati dell'interfaccia

Ogni vista che carica dati gestisce esplicitamente gli stati:

| Stato | Descrizione |
|---|---|
| **Caricamento** | Skeleton loader o indicatore di progresso (specialmente per la matrice) |
| **Vuoto** | Empty state con messaggio contestuale (nessun turno, nessuna richiesta, ecc.) |
| **Errore** | Schermata errore con indicazione dell'azione possibile |
| **Con dati** | Stato normale |

[^src: raw/turnly-documento-funzionale.md §9 RNF-Stati dell'interfaccia]

---

## Assunzioni di progetto (§13)

- **Self-service dipendente su due livelli:** (1) scrittura diretta su propri dati personali (profilo — campi consentiti — e disponibilità/preferenze); (2) azioni sui turni **solo tramite richieste** con approvazione admin. Il dipendente non scrive direttamente sulla pianificazione pubblicata. *Variante alternativa disponibile: scrittura diretta del dipendente sui propri turni, se richiesto.*
- **Swap:** eseguibile dall'admin o originato da una richiesta di scambio del dipendente; in ogni caso vale RB-10. Lo scambio da richiesta prevede l'accettazione del collega prima dell'approvazione admin (parametrico).
- **"Carica i turni" = inserimento diretto in matrice** (manuale o via ricorrenza). L'import massivo da file (CSV/Excel) è un'estensione non richiesta.
- **Singola sede / singolo fuso** in questa versione; il multi-sede è out of scope.
- Le soglie normative (riposi, ore, preavvisi) sono parametri di default a scopo di test e **non costituiscono riferimento legale**; vanno adattate al contesto reale d'uso.

[^src: raw/turnly-documento-funzionale.md §13 Appendice — assunzioni]
