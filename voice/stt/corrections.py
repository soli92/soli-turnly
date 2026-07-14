"""voice/stt/corrections.py — Dizionario di correzione post-STT per termini di dominio.

Applica sostituzioni esatte su token dopo la trascrizione faster-whisper.
Il modello medium trascrive in italiano "puro" e normalizza termini tecnici
inglesi verso parole italiane foneticamente simili (es. "task" → "tasche").

Fonte: sessione E2E 2026-07-10 (16 utterance, parlato italiano con termini factory).

Uso:
    from voice.stt.corrections import apply_corrections
    text = apply_corrections(raw_transcript)
"""
from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Tabella correzioni: {pattern_regex: sostituzione}
# Chiavi in lowercase; apply_corrections lavora su testo lowercased + ripristina case.
# Ordine: prima le sostituzioni più lunghe/specifiche per evitare conflitti.
# ---------------------------------------------------------------------------

_CORRECTIONS: dict[str, str] = {
    # Termini factory / kanban
    r"\btasche\b": "task",
    r"\btask[ei]\b": "task",          # "taski", "taske"
    r"\bcamman\b": "kanban",
    r"\bcamban\b": "kanban",
    r"\bcanban\b": "kanban",
    r"\bkamban\b": "kanban",

    # Acronimi tecnici voce
    r"\bvod\b": "VAD",
    r"\bvat\b": "VAD",               # possibile variante
    r"\bstt\b": "STT",
    r"\btts\b": "TTS",
    r"\bfsm\b": "FSM",

    # Keyword handsfree (varianti fonetiche rilevate)
    r"\bin spree\b": "handsfree",
    r"\binspree\b": "handsfree",
    r"\bspree\b": "handsfree",        # solo se isolata

    # Identificatori factory
    r"\bep\s*-\s*0(\d{2})\b": r"EP-0\1",   # "ep - 044" → "EP-044"
    r"\bus\s*-\s*(\d+)\b": r"US-\1",
    r"\btsk\s*-\s*(\d+)\b": r"TSK-\1",

    # Parole italiane mal trascritte
    r"\bdicionario\b": "dizionario",
    r"\bpedagoco\b": "pedagogo",
    r"\bpedagogo\b": "pedagogo",      # no-op ma esplicita
}

# Pre-compilazione regex per performance
_COMPILED: list[tuple[re.Pattern, str]] = [
    (re.compile(pattern, re.IGNORECASE), replacement)
    for pattern, replacement in _CORRECTIONS.items()
]


def apply_corrections(text: str) -> str:
    """Applica il dizionario di correzione al testo trascritto.

    Args:
        text: testo grezzo da faster-whisper.

    Returns:
        Testo corretto. Se nessuna correzione si applica, ritorna il testo invariato.
    """
    if not text:
        return text
    result = text
    for pattern, replacement in _COMPILED:
        result = pattern.sub(replacement, result)
    return result
