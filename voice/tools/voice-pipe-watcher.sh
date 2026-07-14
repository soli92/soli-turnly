#!/usr/bin/env bash
# voice/tools/voice-pipe-watcher.sh — Watcher visibilità voice channel (provider-agnostic).
#
# Monitora voice-in.json (utterance) e voice-state.json (stati FSM) e stampa
# eventi leggibili su stdout, pronti per essere ingestati dal Monitor tool di Claude Code.
#
# Funziona con QUALUNQUE provider runtime (claude-code, file-pipe, mock):
#   - voice-in.json   — scritto dalla FSM dopo ogni trascrizione confermata
#   - voice-state.json — scritto dalla FSM ad ogni transizione di stato
#
# Non scrive mai nulla: accesso puramente in lettura (observer pattern).
#
# Fix race condition (feedback #10 E2E 2026-07-10): 50ms delay dopo inbox touch.
#
# Emoji stato → etichetta leggibile in chat:
#   IDLE          → 🔇 In attesa
#   CATTURA       → 🎙️  Ascolto...
#   TRASCRIZIONE  → ✍️  Trascrivo...
#   ELABORAZIONE  → ⚙️  Elaboro... [testo]
#   PARLATO       → 🔊 Rispondo...
#
# Uso (via Monitor tool in Claude Code):
#   command: bash voice/tools/voice-pipe-watcher.sh

INBOX="$HOME/.local/share/soli-voice/voice-in.json"
STATE="$HOME/.local/share/soli-voice/voice-state.json"

# Inizializza mtime CORRENTI (ignora file già presenti al boot — evita fire immediato)
last_inbox_mtime=$(stat -f "%m" "$INBOX" 2>/dev/null || echo "0")
last_state_mtime=$(stat -f "%m" "$STATE" 2>/dev/null || echo "0")

_state_emoji() {
    case "$1" in
        IDLE)          echo "🔇 In attesa" ;;
        CATTURA)       echo "🎙️  Ascolto..." ;;
        TRASCRIZIONE)  echo "✍️  Trascrivo..." ;;
        ELABORAZIONE)  echo "⚙️  Elaboro..." ;;
        PARLATO)       echo "🔊 Rispondo..." ;;
        *)             echo "❓ $1" ;;
    esac
}

while true; do
    # --- Nuova utterance trascritta ---
    if [ -f "$INBOX" ]; then
        cur_inbox=$(stat -f "%m" "$INBOX" 2>/dev/null || echo "0")
        if [ "$cur_inbox" != "$last_inbox_mtime" ]; then
            sleep 0.05  # Fix race: attendi completamento scrittura
            if [ -f "$INBOX" ]; then
                text=$(python3 -c "import json,sys; d=json.load(open('$INBOX')); print(d.get('text',''))" 2>/dev/null)
                if [ -n "$text" ]; then
                    echo "🎤 Tu: $text"
                fi
            fi
            last_inbox_mtime="$cur_inbox"
        fi
    fi

    # --- Transizione FSM ---
    if [ -f "$STATE" ]; then
        cur_state=$(stat -f "%m" "$STATE" 2>/dev/null || echo "0")
        if [ "$cur_state" != "$last_state_mtime" ]; then
            state=$(python3 -c "import json,sys; d=json.load(open('$STATE')); print(d.get('state',''))" 2>/dev/null)
            if [ -n "$state" ] && [ "$state" != "IDLE" ]; then
                echo "$(_state_emoji "$state")"
            fi
            last_state_mtime="$cur_state"
        fi
    fi

    sleep 0.3
done
