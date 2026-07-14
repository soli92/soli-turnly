---
type: questions
project: soli-turnly
created: 2026-07-14
updated: 2026-07-14
---

# management/questions.md — Domande Aperte

Registro delle domande bloccanti (hard) e non bloccanti (soft) emerse durante la
definizione delle epiche e delle storie. Le domande soft non bloccano la progressione;
le hard bloccano la US indicata.

---

## Domande aperte

Nessuna domanda hard bloccante al termine di questa iterazione PM.

Le incertezze residue identificate durante la stesura delle epiche sono state classificate
come gap non bloccanti e registrate in `wiki/gaps.md` (vedi G-001, G-002, G-003) oppure
gestite come confidence < 100% nel frontmatter dell'epica.

---

## Note per iterazioni future

| Tema | Epica | Nota |
|---|---|---|
| UX editor disponibilità con ricorrenze | EP-011 / US-017 | La struttura del wizard (selezione giorno settimana + fascia vs. intervallo date) non è illustrata dai mockup attuali (G-002). Suggerito: raccogliere input UX quando disponibili. |
| Latenza notifiche in-app | EP-013 / US-021 | Il requisito non specifica una soglia di latenza accettabile per la consegna in-app. Suggerito: concordare con il product owner (es. "entro 5 secondi in condizioni normali"). |
| Email opzionale RF-N | EP-013 / US-021 | Il canale email è menzionato come opzionale ma non è dettagliato (template, provider, opt-in dipendente). Suggerito: definire prima della taskificazione di EP-013. |
| Gestione festivi RF-E | EP-005 / US-009 | Il parametro `gestioneFestivi` è citato in RB-11 ma il suo comportamento esatto (salta, segnala, segue calendario festivi configurato) non è dettagliato nel documento funzionale. Suggerito: chiedere conferma al product owner. |
