# UX/UI Review — Turnly Prototype
**Target:** `output/prototypes/turnly-prototype.html`
**Data:** 2026-07-13
**Rubric:** strict (anti-soggettività)
**Modalita:** no-visual (source analysis — Playwright non installato nel progetto)
**Agente:** ux-ui-reviewer (EP-008, US-030)
**Iterazione:** 1
**Verdict:** CONDITIONAL

---

## Sommario esecutivo

Il prototipo Turnly dimostra un'architettura informativa solida, terminologia di dominio corretta (ospedaliero/healthcare) e buona copertura di stati edge (skeleton loader, empty state, error 500, violazioni regole). I flussi critici Admin (Matrice → Editor → Salva) e Dipendente (Calendario → Nuova Richiesta → Conferma) sono navigabili e coerenti con il dominio.

**Impedimento principale alla production readiness:** il prototipo presenta violazioni WCAG 2.2 AA multiple e sistematiche nelle aree contrasto badge/button e accessibilità da tastiera (tutti i nav-item e matrix cell sono `div+onclick`, zero `tabindex`/`role`). In un contesto healthcare enterprise l'accessibilità è requisito non negoziabile.

La matrice mese (schermata critica primaria) presenta overflow strutturale a 1366px e 1440px, risolto solo a 1920px.

---

## Finding per severita

### CRITICAL (4)

| ID | Rubric | Schermata | Problema | Misura |
|----|--------|-----------|----------|--------|
| C-01 | WCAG-1.4.3 / UI-Contrasto | Tutte (badge badge-green, badge-amber) | `badge-green`: #22c55e su #f0fdf4 = **2.18:1** (AA require 4.5:1). `badge-amber`: #f59e0b su #fffbeb = **2.07:1**. I badge stato sono ovunque (screen-2, 13, 18, 21) e il testo è illeggibile su sfondi chiari. | CR misurato su CSS |
| C-02 | WCAG-1.4.3 / UI-Contrasto | Screen-3, 4, 14, 22 | Testo `.turn-riposo`: #94a3b8 su #F1F5F9 = **2.34:1** (AA require 4.5:1, AA-large require 3.0:1). Failisce anche per testo grande. Si applica a centinaia di celle in matrice settimana e mese. | CR misurato su CSS |
| C-03 | WCAG-2.1.1 / Nielsen-7 | Tutte (sidebar, matrix, dashboard) | Tutti i 22 item di navigazione sidebar sono `<div onclick>` senza `tabindex`, `role="button"` o `aria-label`. Le celle interattive della matrice (screen-3) sono `<div onclick>` identici. Nessun elemento di navigazione o azione primaria è raggiungibile da tastiera. | Grep: zero `tabindex` in 2602 righe |
| C-04 | UI-DensitaInformativa / Nielsen-8 | Screen-4 (Matrice Mese) | Matrice mese: larghezza minima calcolata **1460px** (sidebar 224 + employee col 120 + 31×36px). Overflowa a 1366px (−94px) e 1440px (−20px). Solo a 1920px entra. Il 1440px è il viewport più comune in enterprise. La schermata critica primaria è inaccessibile a 2/3 dei laptop enterprise. | Calcolo dimensionale |

### MAJOR (8)

| ID | Rubric | Schermata | Problema |
|----|--------|-----------|----------|
| M-01 | WCAG-1.4.3 / UI-Contrasto | Tutte | `btn-primary`: testo bianco (#fff) su #3b82f6 = **3.68:1** (AA 4.5:1 per testo normale 13px/500). Bottone call-to-action principale su tutte le 22 schermate fallisce AA. Nota: hover (#2563eb) sarebbe **5.92:1** — invertire default/hover risolve. |
| M-02 | WCAG-1.4.3 / UI-Contrasto | Tutte | `text-slate-400` (#94a3b8) usato sistematicamente per testo secondario su sfondi bianchi/slate-50: **2.56:1** (bianc) e **2.45:1** (slate-50). Colpisce label data, orari, qualifiche, timestamp notifiche. |
| M-03 | WCAG-1.4.1 / UI-Colore | Screen-4 (Matrice Mese) | Vista mese usa singole lettere M/P/N/R con colore di sfondo come unica differenziazione. Due lettere "M" in sequenza nella header di colonna (Martedì = M, Mercoledì = M) sono ambigue. Nel compact cell, "M" = Mattina + "M" = ambiguità giorni. Informazione convogliata solo tramite colore. |
| M-04 | WCAG-2.1.1 / Nielsen-1 | Screen-3 (Matrice Settimana) | Gli indicatori di violazione (`⚠` e `✕` come raw Unicode) nella matrice sono convogliati solo da `title` attribute. I `title` non sono accessibili su touch, non vengono annunciati da screen reader senza `aria-describedby`. Violazione critica in contesto healthcare dove le violazioni turno hanno implicazioni normative. |
| M-05 | Nielsen-4 / UI-Coerenza | Screen-3, 4 | Icone di warning usano raw Unicode (`⚠`, `✕`) mentre tutto il resto del prototipo usa Lucide icons. Inconsistenza sistemica con il design system dichiarato (shadcn/ui + Lucide). |
| M-06 | UI-Tipografia | Tutte | Font size 10px usato per nav section labels (`text-[10px]`), badge text (11px), compact matrix cells (10px), timestamp notifiche (11px). La soglia enterprise minima accettabile è 12px. In un ambiente di lavoro ad alta densità (ospedaliero) con schermi non calibrati, 10px è illeggibile. |
| M-07 | Flusso-Feedback / Nielsen-1 | Screen-13 (Approvazioni) | Dopo l'azione Approva/Rifiuta non c'è stato di feedback (toast, banner, aggiornamento badge). Il contatore "4 in attesa" non si aggiorna. Assenza di feedback su azioni distruttive/irreversibili. |
| M-08 | WCAG-1.4.3 | Screen-4 | `.mc-pomeriggio` (compact cell): #15803d su #BBF7D0 = **4.14:1** (fallisce AA 4.5:1 per testo normale). Il testo di 11px non è large text (18pt), quindi il requisito è 4.5:1. |

### MINOR (7)

| ID | Rubric | Schermata | Problema |
|----|--------|-----------|----------|
| m-01 | Nielsen-6 | Screen-4 | La legenda colori (M=Mattina P=Pomeriggio N=Notte R=Riposo) è posizionata come `<p>` testuale sotto la tabella, separata da whitespace. Non è "in context" con le celle. Distanza visiva troppo grande su schermi alti. |
| m-02 | Nielsen-10 | Screen-3, 5 | I codici regola (RB-02) compaiono senza spiegazione inline. "RB-02" è opaco per l'utente non tecnico. Mancanza di link a legenda regole o tooltip espansivo. |
| m-03 | Flusso-HappyPath | Screen-19 → 20 | Screen-19 mostra step con "Assenza" selezionata. Premendo "Invia richiesta" si arriva a screen-20 che mostra "Proposta scambio turni". Context mismatch nel prototipo — può disorientare chi valuta il flusso. |
| m-04 | Flusso-ErrorRecovery | Screen-18 | Richiesta "Rifiutata" visibile in elenco (badge-red) senza percorso per capire il motivo del rifiuto o re-inviare con modifiche. L'error recovery per le richieste è incompleta. |
| m-05 | Nielsen-8 | Sidebar | Screen-22 "Stati Globali" è visibile nella sidebar di produzione. È uno schermo di debug/dev artifact. Dovrebbe essere rimosso dalla navigazione o role-gated (solo per profilo `developer`). |
| m-06 | Nielsen-4 | Screen-6 | Il posizionamento dei label wizard usa `margin-top: -24px` per allinearsi con i dots. Layout fragile dipendente da misure fisse — si rompe con font scaling o zoom browser. |
| m-07 | Flusso-Onboarding | N/A | Nessun flusso di onboarding per primo accesso admin (nuovo tenant, nessun dipendente configurato). Lo stato vuoto c'è (screen-22b) ma la navigazione verso di esso richiede conoscenza pregressa. |

### SUGGESTION (3)

| ID | Rubric | Osservazione |
|----|--------|--------------|
| S-01 | Nielsen-7 | Nessun keyboard shortcut documentato per le azioni ad alta frequenza (passa alla settimana precedente/successiva, apri editor turno selezionato). In un contesto admin che usa la matrice ore al giorno, le scorciatoie da tastiera sono un requisito ergonomico. |
| S-02 | Flusso-MicroInterazioni | L'icona "unread" nelle notifiche (dot blu `w-2 h-2`) è color-only. Aggiungere `aria-label="Non letta"` o testo visivamente nascosto (sr-only) risolverebbe sia WCAG-1.4.1 sia Nielsen-1. |
| S-03 | WCAG-2.4.2 | La SPA mantiene `<title>Turnly — Prototipo Interattivo</title>` statico per tutte le 22 schermate. In produzione il title deve aggiornarsi con `document.title` ad ogni navigazione per conformità WCAG 2.4.2 e per gli screen reader che annunciano il titolo pagina. |

---

## A11y — Riepilogo WCAG 2.2 AA

| Criterio | Stato | Finding |
|----------|-------|---------|
| 1.1.1 Non-text Content | FAIL | Icone Lucide decorative senza testo alternativo su controlli icon-only (es. logout in sidebar) |
| 1.3.1 Info and Relationships | FAIL | 22 nav-item come `<div>` senza role. Celle matrice interattive senza role. |
| 1.4.1 Use of Color | FAIL | Vista mese: tipo turno da colore+lettera ambigua. Badge unread notification. |
| 1.4.3 Contrast Minimum | FAIL | badge-green (2.18), badge-amber (2.07), badge-blue (3.38), turn-riposo (2.34), btn-primary (3.68), text-slate-400 (2.45-2.56), mc-pomeriggio (4.14) |
| 2.1.1 Keyboard | FAIL | Tutta la navigazione sidebar (22 div), celle matrice interattive, row click su tabelle |
| 2.4.2 Page Titled | FAIL | Titolo documento statico per tutta la SPA |
| 2.4.7 Focus Visible | FAIL | Solo `input:focus` definito. Zero `:focus-visible` su button, nav-item, tab-btn |
| 4.1.2 Name, Role, Value | FAIL | Nav-item senza role/aria-label. Icon-only buttons senza aria-label. |
| 3.1.1 Language of Page | PASS | `lang="it"` presente |
| 1.3.3 Sensory Characteristics | PASS | Le celle matrice hanno testo descrittivo (Mattina/Pomeriggio) oltre al colore nella vista settimanale |
| 2.4.3 Focus Order | OPEN_QUESTION | Non verificabile senza render. Dipende da ordine DOM che sembra logico ma non testato. |

> **Nota metodologica a11y:** `run_a11y_scan` (axe/Playwright) non eseguito — Playwright non installato nel progetto. I finding a11y sono derivati da analisi statica del markup e calcolo contrasto programmatico. Validare con axe-core su browser reale prima della produzione.

---

## Open Questions

| # | Domanda | Schermata | Perche importante |
|---|---------|-----------|-------------------|
| OQ-1 | Che dispositivi usano gli infermieri per consultare i propri turni? Se usano smartphone → la UI attuale (sidebar 224px fissa, font 10px) non scala su mobile. L'`overflow: hidden` sul body con viewport fisso la rende di fatto non usabile su touch. | Tutte | Determina se serve un layout responsive separato per role Dipendente |
| OQ-2 | Il conteggio badge "4 in attesa" in sidebar deve aggiornarsi real-time (WebSocket) o al refresh? La statefulness del badge è assente nel prototipo. | Screen-2, 13 | Impatta l'architettura state management e Nielsen-1 |
| OQ-3 | La matrice 50+ righe (dichiarata nel brief) è virtualizzata? Con 50 righe a 60px cadauna = 3000px di altezza, `max-height: calc(100vh - 200px)` funziona ma implica scroll interno. Come si gestisce la selezione di più dipendenti? | Screen-3, 4 | Impatta densità e usabilità primaria della funzione core |
| OQ-4 | Le violazioni bloccanti (turn-error-ring in screen-3) impediscono il salvataggio o sono solo avvisi? Il prototipo apre lo stesso editor per entrambe le casistiche. Se sono bloccanti, il bottone "Salva turno" dovrebbe essere disabled. | Screen-3, 5 | Nielsen-3 (controllo utente) + Flusso-ErrorRecovery |
| OQ-5 | Esiste un ruolo di "Supervisore" o "Caposala" con permessi intermedi tra Admin e Dipendente? Il prototipo espone l'intera area Admin nella stessa navigazione, ma la legenda ruoli menziona solo Admin/Dipendente. | Sidebar | Determina se il sidebar deve essere filtrato per role |

---

## Top 3 Priorita di Intervento

### P1 — Contrasto badge e btn-primary (scope: globale, effort: basso-medio)

**Finding:** C-01, C-02, M-01, M-02, M-08 | **Rubric:** WCAG-1.4.3 + UI-Contrasto

Colpisce ogni schermata. Correzioni:

| Elemento | Attuale fg/bg | Proposta minima AA |
|----------|---------------|-------------------|
| `badge-green` | #22c55e / #f0fdf4 | fg: #15803d (green-700) → CR **5.88** |
| `badge-amber` | #f59e0b / #fffbeb | fg: #92400e (amber-800) → CR **6.37** |
| `badge-blue` | #3b82f6 / #eff6ff | fg: #1d4ed8 (blue-700) → CR **5.12** |
| `badge-red` | #ef4444 / #fef2f2 | fg: #b91c1c (red-700) → CR **6.05** |
| `btn-primary` | white / #3b82f6 | bg: #1d4ed8 (blue-700) → CR **6.37** oppure usa #2563eb (CR **5.92**) |
| `turn-riposo` text | #94a3b8 / #f1f5f9 | fg: #475569 (slate-600) → CR **4.64** |
| `text-slate-400` secondario | #94a3b8 / white | fg: #64748b (slate-500) → CR **4.76** |

> Nota: I colori di testo nelle celle turno Mattina/Pomeriggio/Notte/Assenza passano gia il contrasto. Solo i componenti UI generici falliscono.

---

### P2 — Accessibilita da tastiera: nav-item e matrix cell (scope: globale, effort: medio)

**Finding:** C-03 | **Rubric:** WCAG-2.1.1 + WCAG-4.1.2

Sostituire ogni `<div class="nav-item" onclick="...">` con:
```html
<button class="nav-item" onclick="showScreen('screen-N')">
  <i data-lucide="..." class="nav-icon" aria-hidden="true"></i>
  Label visibile
</button>
```
Aggiungere `tabindex="0"` e `role="button"` ai `<div onclick>` nelle tabelle (o convertire in `<button>`).
Aggiungere `:focus-visible` ring nel CSS globale:
```css
*:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
```
Aggiungere `aria-current="page"` al nav-item attivo.

---

### P3 — Matrice mese: overflow a 1440px (scope: screen-4, effort: medio)

**Finding:** C-04 | **Rubric:** UI-DensitaInformativa

A 31 giorni × 36px min-width = 1116px solo di celle, la matrice mese non entra neanche a 1440px con sidebar aperta. Opzioni:

1. **Ridurre cell width a 28px** (gia usata per `.mc-cell`) — totale: 224 + 120 + 31×28 = 1212px → entra a 1366px
2. **Sidebar collassabile** a 48px in modalita matrix — libera 176px, risolvendo il problema a 1280px+
3. **Implementare column virtualization** (renderizza solo le colonne visibili nel viewport)
4. **Vista alternativa non-tabellare** per il mese (es. griglia di chip compatta tipo Google Calendar)

L'opzione 1 combinata con l'opzione 2 e la soluzione piu rapida da prototipare.

---

## Metriche summary

- **Schermate analizzate:** 22 / 22
- **Finding totali:** 22 (4 critical, 8 major, 7 minor, 3 suggestion)
- **Finding con rubric_ref:** 22 / 22 (100% — rubric strict soddisfatto)
- **WCAG criteri falliti:** 8 su 10 verificabili da analisi statica
- **Contrasti falliti:** 7 coppie colore su 23 testate
- **Elementi non keyboard-accessible stimati:** 22 nav-item + ~50 celle matrice + ~12 div-link dashboard
- **open_questions:** 5

---

## Metadata

```json
{
  "review_id": "uxui-review-2026-07-13-turnly-prototype",
  "target": "output/prototypes/turnly-prototype.html",
  "date": "2026-07-13",
  "mode": "no-visual",
  "rubric": "strict",
  "skip_a11y_scan": false,
  "a11y_scan_executed": false,
  "a11y_scan_reason": "Playwright not installed in project — static analysis only",
  "verdict": "conditional",
  "critical_count": 4,
  "major_count": 8,
  "minor_count": 7,
  "suggestion_count": 3,
  "rubric_violations_count": 22,
  "open_questions_count": 5,
  "screens_reviewed": 22,
  "agent": "ux-ui-reviewer",
  "ep": "EP-008",
  "us": "US-030"
}
```
