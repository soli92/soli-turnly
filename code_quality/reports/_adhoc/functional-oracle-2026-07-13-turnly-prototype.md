# Functional Oracle — Turnly Prototype
**File:** `output/prototypes/turnly-prototype.html`
**Data:** 2026-07-13
**Verdict:** `conditional`

---

## Riepilogo esecutivo

Il prototipo è strutturalmente solido: tutte le 22 schermate sono presenti con IDs univoci,
la funzione `showScreen()` è correttamente definita e richiamata da tutti i 22 nav-item della
sidebar, lo stato attivo si aggiorna correttamente al click, e una sola schermata è visibile
alla volta. Le interazioni critiche di navigazione funzionano. Sono stati rilevati **2 bug
bloccanti** e **4 implementazioni parziali** sui flussi wizard/interattivi interni.

---

## A — Navigazione sidebar

| Interazione | Stato | Note |
|---|---|---|
| 22 schermate presenti con ID unici | ✅ OK | screen-1…screen-22, nessun duplicato |
| Ogni voce sidebar → schermata corretta | ✅ OK | tutti i `nav-item` hanno `onclick="showScreen('screen-X')"` |
| Active state sidebar aggiornato al click | ✅ OK | `showScreen` rimuove `.active` da tutti e lo applica al `nav-X` corrispondente |
| Sezioni Auth / Admin / Dipendente / Trasversali | ✅ OK | presenti con intestazioni separate |
| Solo una schermata visibile alla volta | ✅ OK | `showScreen` nasconde tutte le `.screen` prima di mostrarne una |
| screen-1 (Login) nasconde la sidebar | ✅ OK | `appLayout.style.display = 'none'` quando `id === 'screen-1'` |
| Start page al caricamento | ✅ OK | DOMContentLoaded → `showScreen('screen-2')` (dashboard) |

---

## B — Interazioni interne alle schermate

| Interazione | Stato | Note |
|---|---|---|
| Screen 3 — celle matrice cliccabili → screen-5 | ✅ OK | `onclick="showScreen('screen-5')"` su ogni cella turn |
| Screen 3 — filtro dropdown qualifiche | ✅ OK | `<select>` presente con 4 opzioni |
| Screen 3 — navigazione settimana (frecce prev/next) | ⚠ parziale | pulsanti presenti visivamente ma **nessun onclick** — decorativi |
| Screen 3 — bottone "Oggi" | ⚠ parziale | presente ma **nessun onclick** |
| Screen 5 — apertura modale da cella matrice | ✅ OK | le celle hanno `onclick="showScreen('screen-5')"` |
| Screen 5 — chiusura con X | ✅ OK | `onclick="showScreen('screen-3')"` sull'icona X |
| Screen 5 — chiusura con "Annulla" | ✅ OK | `onclick="showScreen('screen-3')"` sul bottone |
| Screen 5 — pannello avvisi visibile | ✅ OK | box amber RB-02 presente nel markup |
| Screen 6 — wizard step 1 → 2 → 3 (Avanti) | ❌ rotto | la schermata mostra staticamente lo **step 3** (1 e 2 marcati "done"); non esiste contenuto step-1 né step-2, né bottoni Avanti |
| Screen 6 — bottone "Indietro" | ❌ rotto | `<button class="btn-secondary text-xs">Indietro</button>` — **nessun onclick** (riga ~919) |
| Screen 6 — bottone "Genera ciclo" | ✅ OK | `onclick="showScreen('screen-3')"` |
| Screen 9 — tab Setup ↔ Monitor | ✅ OK | `switchTab()` correttamente definita; IDs `tab-setup`, `tab-monitor`, `tabcontent-setup`, `tabcontent-monitor` coerenti |
| Screen 13 — click su item 1 (pre-selezionato) | ✅ OK | item 1 già mostrato con highlight e dettaglio nel pannello destro |
| Screen 13 — click su item 2, 3, 4 → dettaglio | ❌ rotto | items 2-4 hanno `cursor-pointer` ma **nessun onclick** — il pannello destro rimane fisso sul dettaglio dell'item 1 |
| Screen 18 — tab "Le mie richieste" ↔ "Proposte ricevute" | ✅ OK | `switchTab2()` definita; IDs `tab-mie`, `tab-swap`, `tabcontent2-mie`, `tabcontent2-swap` coerenti |
| Screen 19 — step 1 selezione tipo (card cliccabili) | ⚠ parziale | le card tipo sono mostrate greyed-out con `pointer-events-none opacity-50`; la schermata parte già allo **step 2** |
| Screen 19 — bottone "Indietro" (step 2 → screen-18) | ✅ OK | `onclick="showScreen('screen-18')"` |
| Screen 19 — bottone "Invia richiesta" (→ screen-20) | ✅ OK | `onclick="showScreen('screen-20')"` |
| Screen 21 — bell notification panel | ⚠ parziale | implementato come pagina completa (screen-21), non come dropdown overlay; il bell nella topbar di screen-2 naviga a `showScreen('screen-21')` — navigazione funzionante, ma pattern dropdown non implementato |

---

## C — Stati UI

| Interazione | Stato | Note |
|---|---|---|
| Screen 22 — skeleton loader | ✅ OK | presente con animazione CSS `shimmer` |
| Screen 22 — empty state | ✅ OK | presente con SVG illustration e CTA "Crea ciclo turni" → screen-6 |
| Screen 22 — errore 500 | ✅ OK | presente con icona `server-crash`, testo "500 — Internal Server Error" e bottoni Torna/Riprova |
| Badge numerico inbox (approvazioni) | ✅ OK | `nav-screen-13` mostra badge rosso "4" |
| Badge numerico notifiche | ✅ OK | `nav-screen-21` mostra badge rosso "3"; topbar screen-2 badge "4" sul bell |
| Badge stato "In attesa" (amber) | ✅ OK | presente in screen-13 (item selezionato + pannello dettaglio) e screen-18 |
| Badge stato "Approvata" (green) | ✅ OK | presente in screen-18 ("Richiesta turno extra") |
| Badge stato "Rifiutata" (red) | ✅ OK | presente in screen-18 ("Modifica turno") |

---

## D — Consistenza markup

| Check | Stato | Note |
|---|---|---|
| IDs unici per ogni schermata | ✅ OK | nessun duplicato trovato tra screen-1…screen-22 e tutti i panel/tab IDs |
| `showScreen(id)` definita | ✅ OK | funzione completa a riga 2525 |
| Tutti i nav-item chiamano `showScreen` | ✅ OK | 22/22 voci sidebar cablate |
| `switchTab()` definita (screen-9) | ✅ OK | riga 2556 |
| `switchTab2()` definita (screen-18) | ✅ OK | riga 2566 |
| `togglePanel()` definita | ✅ OK | riga 2576; usata in screen-10, screen-16, screen-17 |
| Errori sintattici HTML | ✅ OK | `</body>` e `</html>` presenti a fine file (righe 2600-2601); struttura nidificata corretta |
| screen-1 fuori dall'app-layout | ✅ OK | posizionamento corretto — screen-1 è nell'outer body, app-layout lo segue; la gestione `appLayout.style.display = 'none'` è corretta |

---

## Bug trovati

### BUG-01 — Screen 6: bottone "Indietro" senza onclick (CRITICO)
**Riga:** ~919
```html
<button class="btn-secondary text-xs">Indietro</button>
```
Il bottone "Indietro" nello step 3 del wizard ricorrenza/ciclo non ha onclick. Premendolo non accade nulla.

**Fix:** Aggiungere `onclick="showScreen('screen-3')"` (o navigare allo step 2 se implementato).

---

### BUG-02 — Screen 13: list items 2, 3, 4 non cliccabili (CRITICO)
**Righe:** ~1660-1685
```html
<div class="p-3 hover:bg-slate-50 cursor-pointer">  <!-- Item 2 -->
<div class="p-3 hover:bg-slate-50 cursor-pointer">  <!-- Item 3 -->
<div class="p-3 hover:bg-slate-50 cursor-pointer">  <!-- Item 4 -->
```
Tutti e tre mostrano `cursor-pointer` (aspettativa di interazione) ma mancano di onclick. Il pannello destro rimane fisso sul dettaglio dell'item 1 (Anna Verdi — Ferie).

**Fix:** Aggiungere onclick sugli item 2-4. Poiché il dettaglio è hardcoded, la soluzione minima per il prototipo è un toggle visivo (highlight dell'item selezionato). Esempio:
```html
<div class="p-3 hover:bg-slate-50 cursor-pointer"
     onclick="selectRequest(this, 'detail-luca')">
```
con function JS che aggiorni l'highlight e mostri il dettaglio corrispondente.

---

### BUG-03 — Screen 3: frecce navigazione settimana senza onClick (PARZIALE)
**Righe:** ~450-453
```html
<button class="p-1.5 rounded hover:bg-slate-100"><i data-lucide="chevron-left" ...></i></button>
<button class="p-1.5 rounded hover:bg-slate-100"><i data-lucide="chevron-right" ...></i></button>
<button class="text-xs text-blue-500 px-2 hover:underline">Oggi</button>
```
Pulsanti visivi senza onclick. Per un prototipo è accettabile, ma crea aspettative false nell'utente.

**Fix (prototipo):** Aggiungere `onclick="alert('navigazione settimana non implementata')"` oppure rimuovere il cursore pointer.

---

### BUG-04 — Screen 6: wizard step 1→2→3 non navigabile (PARZIALE)
La schermata hardcoda lo step 3 come stato attivo. Non esistono pannelli per step 1 e step 2. L'utente non può sperimentare il flusso Avanti.

**Fix:** Aggiungere tre `div` condizionali (uno per step) e bottoni Avanti/Indietro che alternino la visibilità via JS.

---

### BUG-05 — Screen 19: step 1 selezione tipo non interattivo (PARZIALE)
```html
<div class="grid grid-cols-4 gap-3 max-w-2xl opacity-50 pointer-events-none">
```
Le card tipo (Assenza, Scambio, Nuovo turno, Modifica turno) sono disabilitate. Non è possibile simulare la scelta del tipo e la transizione step1→step2.

**Fix:** Rimuovere `pointer-events-none opacity-50` e aggiungere una funzione JS che mostri il form step-2 al click.

---

## Raccomandazioni di fix prioritizzati

| Priorità | Bug | Sforzo |
|---|---|---|
| P1 — critico | BUG-02: Screen 13 items 2-4 non cliccabili | basso (aggiungere onclick + toggle highlight) |
| P1 — critico | BUG-01: Screen 6 Indietro senza onclick | minimo (1 attributo onclick) |
| P2 — parziale | BUG-04: Screen 6 wizard completo | medio (3 pannelli + JS step machine) |
| P2 — parziale | BUG-05: Screen 19 step 1 interattivo | basso (rimuovere pointer-events-none + JS) |
| P3 — cosmetic | BUG-03: Screen 3 frecce settimana | minimo (alert o cursore visivo) |

---

*Generato da functional-oracle — 2026-07-13*
