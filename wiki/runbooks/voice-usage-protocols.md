# Voice Channel — Protocolli di Utilizzo

> Versione: v2.31 | Aggiornato: 2026-07-10 (post sessione E2E)

Questa pagina descrive le modalità di utilizzo del voice channel e il protocollo
operativo per ciascuna. Scegli la modalità in base al tuo contesto di lavoro.

---

## Modalità 1 — Handsfree Autonomo (default, raccomandato)

**Quando usarla:** uso quotidiano della factory senza guardare lo schermo. L'utente
parla, la factory risponde vocalmente. Zero interazione con tastiera o chat.

**Provider:** `claude-code` (spawna `claude -p` per ogni utterance, completamente autonomo)

**Avvio:**
```bash
open ~/.local/share/soli-voice/start-voice.command
# oppure: doppio click su start-voice.command dal Finder
```

**Flusso:**
```
Boot Mac → LaunchAgent avvia voice terminal (automatico)
→ Pronuncia "prometeus" → wake word rilevata → beep
→ Parla il comando → VAD endpoint → STT trascrive
→ claude -p elabora → risposta TTS
→ La conversazione continua (handsfree mode attivata dopo primo turno)
```

**Comandi vocali disponibili:**
| Detto | Azione |
|---|---|
| "handsfree" / "hands-free" / "mani libere" | Attiva modalità handsfree (no wake word richiesta) |
| "disattiva handsfree" / "modalità normale" | Torna a wake word per ogni turno |

**Config minima:**
```yaml
voice_channel:
  enabled: true
  phase: 2
  runtime:
    provider: claude-code
  wake_word:
    enabled: true
    keyword: prometeus
```

**Note:** le utterance vengono scritte in `~/.local/share/soli-voice/voice-in.json`
per visibilità opzionale via watcher (vedi Modalità 3).

---

## Modalità 2 — In-Session File-Pipe

**Quando usarla:** sessioni di sviluppo con Claude Code aperto; si vuole vedere
le utterance in chat e che Claude Code risponda inline (non via subprocess).
**Richiede che questa sessione Claude Code stia monitorando** — non è autonoma.

**Provider:** `file-pipe`

**Avvio (due passi):**

1. Avvia il terminale voice:
   ```bash
   open ~/.local/share/soli-voice/start-voice.command
   ```

2. Avvia il Monitor in Claude Code (chiedi a Claude di farlo):
   > "avvia il monitor voice"

   Claude esegue:
   ```bash
   bash voice/tools/voice-pipe-watcher.sh
   ```
   e risponde ad ogni utterance scrivendo su `voice-out.json`.

**Flusso:**
```
Voice terminal → voice-in.json + voice-ready
→ Monitor notifica Claude Code → Claude legge + risponde
→ voice-out.json → TTS
```

**Config:**
```yaml
voice_channel:
  runtime:
    provider: file-pipe
```

**Limitazioni:** se la sessione Claude Code si chiude o il Monitor non è attivo,
le utterance vanno in timeout dopo 180s.

---

## Modalità 3 — Visibilità In-Chat (overlay su Modalità 1)

**Quando usarla:** si vuole vedere in chat le utterance e gli stati FSM
mentre il sistema funziona autonomamente (provider `claude-code`).
È un overlay opzionale su Modalità 1, non cambia il runtime.

**Avvio:** con voice terminal già attivo, chiedi a Claude:
> "avvia il watcher voice in sola lettura"

Claude esegue il Monitor con:
```bash
bash voice/tools/voice-pipe-watcher.sh
```

In chat appariranno:
```
🎤 Tu: "quanti task aperti ci sono nel kanban?"
⚙️  Elaboro...
🔊 Rispondo...
```

La risposta effettiva viene elaborata autonomamente da `claude -p` nel terminale.

---

## Modalità 4 — Push-to-Talk (PTT)

**Quando usarla:** ambienti rumorosi dove il VAD farebbe trigger su rumore
di fondo; o quando si preferisce controllo esplicito sull'inizio/fine registrazione.

**Config:**
```yaml
voice_channel:
  phase: 1        # PTT: INVIO per start/stop
  wake_word:
    enabled: false
```

**Flusso:**
```
Premi INVIO nel terminale → registra (finché premi INVIO di nuovo)
→ STT → LLM → TTS
```

**Nessun VAD** — nessun rischio di endpoint precoce su pause.

---

## Modalità 5 — Mock/Test Pipeline

**Quando usarla:** testing della pipeline audio (microfono → VAD → STT → TTS)
senza chiamate LLM reali. Risposta deterministica: echo dell'utterance.

**Config:**
```yaml
voice_channel:
  runtime:
    provider: mock
```

**Avvio:**
```bash
/Library/Frameworks/Python.framework/Versions/3.12/bin/python3 -m voice
```

**Quando usarla:** calibrazione VAD threshold, test microfono, verifica TTS/audio device.

---

## Decision Tree

```
Vuoi lavorare senza guardare lo schermo?
  └─ Sì → Modalità 1 (Handsfree Autonomo)
       └─ Vuoi anche vedere le utterance in chat? → aggiungi Modalità 3

Vuoi che Claude Code risponda inline in chat?
  └─ Sì → Modalità 2 (File-Pipe) — nota: richiede Monitor attivo

Ambiente rumoroso o preferisci controllo manuale?
  └─ Sì → Modalità 4 (PTT)

Vuoi testare solo hardware/pipeline audio?
  └─ Sì → Modalità 5 (Mock)
```

---

## Problemi noti (sessione E2E 2026-07-10)

| Problema | Modalità | Fix applicato |
|---|---|---|
| Endpoint VAD precoce su pause intra-frase | 1,2,3 | `endpoint_silence_ms`: 500 → 700ms |
| STT: "task"→"tasche", "kanban"→"camman" | 1,2,3,5 | `voice/stt/corrections.py` |
| "handsfree"→"in spree" (STT) | 1,2,3 | `corrections.py` + keyword "hands-free" aggiunta |
| Errore TTS silenzioso | 1,2 | Error beep + print `❌ Errore TTS` |
| Race condition watcher | 2,3 | 50ms delay in `voice-pipe-watcher.sh` |
