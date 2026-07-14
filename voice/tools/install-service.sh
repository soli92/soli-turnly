#!/usr/bin/env bash
# voice/tools/install-service.sh — Installa il canale vocale come LaunchAgent macOS.
#
# Il servizio si avvia automaticamente al login e si riavvia se crasha.
# L'API key viene salvata in ~/.config/soli-voice/env (permessi 600, mai nel plist).
#
# Uso:
#   bash voice/tools/install-service.sh
#   # oppure con API key già nell'ambiente:
#   ANTHROPIC_API_KEY=sk-... bash voice/tools/install-service.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LAUNCH_SCRIPT="$REPO_DIR/voice/tools/launch-voice.sh"
PLIST_LABEL="com.soli.voice-factory"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
ENV_DIR="$HOME/.config/soli-voice"
ENV_FILE="$ENV_DIR/env"
LOG_DIR="$HOME/Library/Logs/soli-voice"

echo "╔══════════════════════════════════════════════════╗"
echo "║   Soli Voice Factory — Installazione servizio   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Repo:   $REPO_DIR"
echo "Plist:  $PLIST_PATH"
echo "Logs:   $LOG_DIR/"
echo ""

# --- Verifica macOS ---
if [[ "$(uname)" != "Darwin" ]]; then
    echo "ERRORE: questo script supporta solo macOS (launchd)."
    echo "Su Linux usa systemd: crea /etc/systemd/user/voice-factory.service"
    exit 1
fi

# --- Trova Python3 con voice installato ---
PYTHON3="$(command -v python3)"
echo "Python: $PYTHON3 ($(python3 --version 2>&1))"

# Test che il pacchetto voice sia importabile
if ! "$PYTHON3" -c "import voice" 2>/dev/null; then
    echo ""
    echo "ATTENZIONE: il pacchetto 'voice' non è importabile."
    echo "Installa le dipendenze con:"
    echo "  cd $REPO_DIR && pip install -e '.[voice]'"
    echo ""
fi

# --- ANTHROPIC_API_KEY (opzionale se runtime provider = ollama) ---
# Controlla se già salvata nel file env (installazione precedente)
existing_key=""
if [[ -f "$ENV_FILE" ]]; then
    existing_key=$(grep -m1 '^ANTHROPIC_API_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
fi

if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    api_key="$ANTHROPIC_API_KEY"
    echo "✓ API key letta dall'ambiente"
elif [[ -n "$existing_key" ]]; then
    api_key="$existing_key"
    echo "✓ API key letta dal file precedente ($ENV_FILE)"
else
    api_key=""
    echo "⚠  ANTHROPIC_API_KEY non impostata — ok se runtime provider = ollama"
fi

# --- Crea env file protetto ---
mkdir -p "$ENV_DIR"
cat > "$ENV_FILE" <<EOF
# Soli Voice Factory — variabili d'ambiente per launchd
# Generato da install-service.sh il $(date '+%Y-%m-%d %H:%M:%S')
ANTHROPIC_API_KEY=${api_key}
PIPER_MODEL_DIR=${HOME}/.local/share/piper/voices
PYTHON3=${PYTHON3}
EOF
chmod 600 "$ENV_FILE"
echo "✓ Env salvato in $ENV_FILE (permessi 600)"

# --- Crea log dir ---
mkdir -p "$LOG_DIR"

# --- Rendi eseguibile lo script di lancio ---
chmod +x "$LAUNCH_SCRIPT"

# --- Unload eventuale istanza precedente ---
if launchctl list 2>/dev/null | grep -q "$PLIST_LABEL"; then
    echo "Servizio già presente — reload in corso..."
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi

# --- Genera plist ---
# Chiama Python direttamente (no shell wrapper) per evitare blocchi TCC macOS
# su script in ~/Documents. Le env var sono inline nel plist.
cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${PYTHON3}</string>
        <string>-m</string>
        <string>voice.app</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PIPER_MODEL_DIR</key>
        <string>${HOME}/.local/share/piper/voices</string>
        <key>ANTHROPIC_API_KEY</key>
        <string>${api_key}</string>
        <key>PYTHONUNBUFFERED</key>
        <string>1</string>
    </dict>
    <key>WorkingDirectory</key>
    <string>${REPO_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>Crashed</key>
        <true/>
    </dict>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/voice-factory.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/voice-factory.error.log</string>
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
PLIST

echo "✓ Plist generato in $PLIST_PATH"

# --- Carica il servizio ---
launchctl load "$PLIST_PATH"
echo "✓ Servizio avviato"
echo ""
echo "┌─────────────────────────────────────────────────┐"
echo "│  Canale vocale installato come LaunchAgent      │"
echo "│  Si avvia automaticamente ad ogni login         │"
echo "├─────────────────────────────────────────────────┤"
echo "│  Stato:    launchctl list | grep soli           │"
echo "│  Log:      tail -f $LOG_DIR/voice-factory.log"
echo "│  Stop:     launchctl unload $PLIST_PATH"
echo "│  Rimuovi:  bash voice/tools/uninstall-service.sh│"
echo "└─────────────────────────────────────────────────┘"
