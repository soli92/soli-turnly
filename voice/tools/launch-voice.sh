#!/usr/bin/env bash
# voice/tools/launch-voice.sh — Wrapper launchd: carica env e avvia il canale vocale.
#
# Chiamato dal LaunchAgent com.soli.voice-factory.plist.
# Legge le variabili d'ambiente da ~/.config/soli-voice/env (scritto da install-service.sh).
# Non usare direttamente: usa install-service.sh per configurare il servizio.

set -euo pipefail

ENV_FILE="$HOME/.config/soli-voice/env"

if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
else
    echo "[voice-factory] ERRORE: $ENV_FILE non trovato." >&2
    echo "[voice-factory] Esegui prima: bash voice/tools/install-service.sh" >&2
    exit 1
fi

# ANTHROPIC_API_KEY opzionale — richiesta solo con runtime provider: anthropic
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
    echo "[voice-factory] WARN: ANTHROPIC_API_KEY non impostata (ok con provider: ollama)" >&2
fi

if [[ -z "${PYTHON3:-}" ]]; then
    PYTHON3="$(command -v python3 2>/dev/null || echo "")"
fi
if [[ -z "$PYTHON3" ]]; then
    echo "[voice-factory] ERRORE: python3 non trovato" >&2
    exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

echo "[voice-factory] Avvio alle $(date '+%Y-%m-%d %H:%M:%S') | python: $PYTHON3"
exec "$PYTHON3" -m voice.app
