---
type: concept
title: "Ruoli e Permessi"
status: draft
created: 2026-07-13
source_path: raw/turnly-documento-funzionale.md
ingested_by: wiki-keeper
pattern_section: "§2"
---

# Ruoli e Permessi

Turnly prevede due ruoli applicativi distinti: **Admin** e **Dipendente**.
La distinzione si estende alle qualifiche professionali (Infermiere, OSS, Cassiere…) che sono
ortogonali al ruolo e usate per i fabbisogni di copertura.

Vedi anche: [[dominio-turnazione]] | [[requisiti-funzionali]] | [[sicurezza-autorizzazione-e-rnf]]

---

## Tabella permessi

| Capacità | Admin | Dipendente |
|---|---|---|
| Login / logout | SI | SI |
| Modificare il **proprio** profilo — campi consentiti (recapiti, preferenze) | SI | SI |
| Modificare i campi **contrattuali** del profilo (qualifica, ore contrattuali, tipo contratto, ruolo, stato) | SI | NO |
| Cambiare la **propria** password | SI | SI |
| Gestire la **propria** disponibilità/preferenze | SI | SI |
| Visualizzare **i propri** turni | SI | SI |
| Visualizzare i turni di **tutti** | SI | NO |
| Creare/modificare/eliminare turni sulla pianificazione | SI | NO |
| Gestire anagrafica, qualifiche, contratti (tutti) | SI | NO |
| Gestire tipologie di turno | SI | NO |
| Definire ricorrenze/cicli | SI | NO |
| Eseguire **direttamente** uno swap | SI | NO |
| Registrare **direttamente** un'assenza | SI | NO |
| Definire fabbisogni di copertura | SI | NO |
| **Inviare richieste** (assenza / scambio / nuovo turno / modifica turno) | — (opera direttamente) | SI |
| **Accettare/rifiutare** una proposta di scambio ricevuta | — | SI (solo se destinatario) |
| **Approvare/rifiutare** richieste | SI | NO |
| Vedere report ore/straordinari (tutti) | SI | NO |
| Vedere il **proprio** riepilogo ore | SI | SI |

[^src: raw/turnly-documento-funzionale.md §2 Ruoli e permessi]

---

## Regola trasversale di sicurezza

> Ogni permesso è verificato **lato server** su ogni richiesta. Nascondere un controllo nella
> sola UI non è sufficiente.

- La scrittura del dipendente è limitata ai **propri** dati personali consentiti e alle
  **proprie** richieste.
- Ogni altra scrittura (pianificazione, anagrafica altrui, approvazioni) è negata.
- I casi di test di riferimento sono i `T-SEC-*` (vedi [[casi-di-test]]).

[^src: raw/turnly-documento-funzionale.md §2 Ruoli e permessi]

---

## Campi profilo dipendente: diretti vs. riservati

### Modificabili direttamente dal dipendente
- Recapiti (telefono, email di contatto)
- Preferenze di contatto
- Password

### Riservati all'admin (RB-13)
- `qualificaId`
- `oreContrattualiSettimanali`
- `tipoContratto`
- `ruolo`
- `stato`

Tentativo di modifica dei campi riservati da parte del dipendente (UI o API) → **403** /
errore di validazione; il valore non cambia. Vedi [[regole-di-business]] RB-13 e test T-SEC-05.

[^src: raw/turnly-documento-funzionale.md §4 Modello dati — Utente]

---

## Storie collegate

| EP | Storie | Relazione |
|---|---|---|
| [EP-001](../management/kanban/EP-001-autenticazione-ruoli/EP-001.md) | US-001, US-002 | Login, logout, protezione endpoint per ruolo |
| [EP-002](../management/kanban/EP-002-anagrafica-dipendenti-qualifiche/EP-002.md) | US-003 | Gestione campi contrattuali riservati all'admin (RB-13) |
| [EP-011](../management/kanban/EP-011-calendario-profilo-dipendente/EP-011.md) | US-016 | Self-service dipendente su campi consentiti |
| [EP-012](../management/kanban/EP-012-richieste-dipendente-workflow/EP-012.md) | US-018, US-019, US-020 | Separazione ruoli nel workflow richieste |
