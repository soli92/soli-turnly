"""
voice/core/router.py — EventRouter: unico choke point tra runtime e coda TTS.

Posizione nella catena eventi (US-145, contratto §4.2):

    runtime.submit() ──stream eventi──▶ EventRouter ──┬──▶ tts_queue   (SpokenSummary, Acknowledgment, Question, Error)
                                                       └──▶ visual_sink (Artifact, Progress, Done)

Invariante non negoziabile (EP-041 §Vincolo artefatti mai al TTS, US-145 AC3):
    Artifact.content NON ha percorso di codice verso la coda TTS.
    Il router lo scarta (visual_sink) e logga WARNING se raggiunge il percorso TTS
    per errore di programmazione (difesa in profondita', AC5).
"""
from __future__ import annotations

import asyncio
import logging
import re
import sys
from typing import TextIO

from voice.runtime.factory_runtime import (
    Acknowledgment,
    Artifact,
    Done,
    Error,
    Progress,
    Question,
    RuntimeEvent,
    SpokenSummary,
)

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Allowlist TTS-safe (invariante §4.2, US-145 AC3)
# ---------------------------------------------------------------------------

# SOLO questi tipi vengono accodati al sintetizzatore vocale.
# Artifact e Done non compaiono qui: non hanno percorso verso tts_queue.
TTS_ALLOWED: frozenset[type] = frozenset(
    {SpokenSummary, Acknowledgment, Question, Error, Progress}
)

# ---------------------------------------------------------------------------
# Regex per spoken_summary_extractor (US-145 AC2)
# ---------------------------------------------------------------------------

# Qualunque fence markdown: ```lang\n...\n```
# Il contenuto dei fence e' artefatto; il testo fuori dai fence e' candidato parlato.
_FENCE_RE = re.compile(r"```[^\n]*\n(.*?)```", re.DOTALL)

# Fence spoken-specifico: ```spoken\n...\n```
_SPOKEN_FENCE_RE = re.compile(r"```spoken\n(.*?)```", re.DOTALL)

# Commento HTML spoken: <!-- spoken: <testo> -->
_SPOKEN_COMMENT_RE = re.compile(r"<!--\s*spoken:\s*(.*?)\s*-->", re.DOTALL)


# ---------------------------------------------------------------------------
# Module-level extractor (US-145 AC2)
# ---------------------------------------------------------------------------

def spoken_summary_extractor(raw_text: str) -> tuple[list[str], list[str]]:
    """
    Separa testo libero da blocchi markdown fence (```lang...```).

    Il testo fuori dai fence e' candidato parlato (SpokenSummary);
    il contenuto dei fence e' artefatto (codice, diff, log, JSON...) — MAI al TTS.
    Fallback: testo senza fence → tutto in parlato_list.

    Questo hook implementa il contratto separatore sintattico (US-145 AC2, Opzione A):
    il pattern fence e' quello che l'LLM produce spontaneamente per codice/diff
    e non collide col parlato normale.

    Args:
        raw_text: testo grezzo prodotto dall'LLM (potenzialmente misto testo + fence).

    Returns:
        (parlato_list, artefatto_list) dove:
            parlato_list:   lista di segmenti di testo pronunciabile (fuori dai fence).
            artefatto_list: lista di contenuti fence (codice, diff...) − MAI inviati al TTS.
    """
    if not raw_text or not raw_text.strip():
        return ([], [])

    artefatto_list: list[str] = []
    parlato_parts: list[str] = []

    last_end = 0
    for match in _FENCE_RE.finditer(raw_text):
        before = raw_text[last_end : match.start()].strip()
        if before:
            parlato_parts.append(before)
        fence_content = match.group(1).rstrip()
        if fence_content:
            artefatto_list.append(fence_content)
        last_end = match.end()

    after = raw_text[last_end:].strip()
    if after:
        parlato_parts.append(after)

    # Fallback: nessun fence trovato → tutto il testo e' candidato parlato
    if not artefatto_list and not parlato_parts and raw_text.strip():
        parlato_parts = [raw_text.strip()]

    return (parlato_parts, artefatto_list)


# ---------------------------------------------------------------------------
# EventRouter
# ---------------------------------------------------------------------------

class EventRouter:
    """
    EventRouter e' l'UNICO componente autorizzato a scrivere sulla coda TTS;
    nessun altro modulo (stt, runtime, state_machine) vi accede direttamente.

    Applica l'allowlist TTS-safe (non denylist, EP-041 §Vincolo): solo i tipi in
    TTS_ALLOWED possono raggiungere tts_queue. Artifact e' instradato esclusivamente
    al canale visivo (US-145 AC3). Il controllo difensivo in _to_tts garantisce che
    nessun tipo non-parlato raggiunga il TTS anche in caso di errore di chiamata
    (AC5: WARNING + scarto).
    """

    def __init__(
        self,
        tts_queue: asyncio.Queue,
        visual_sink: TextIO | None = None,
    ) -> None:
        """
        Args:
            tts_queue:   coda asincrona verso il sintetizzatore TTS (piper_tts).
            visual_sink: sink testuale per il canale visivo; default sys.stdout.
                         Accetta qualunque oggetto con metodo .write(str) per testabilita'.
        """
        self._tts_queue = tts_queue
        self._sink: TextIO = visual_sink if visual_sink is not None else sys.stdout

    async def route(self, event: RuntimeEvent) -> bool:
        """
        Instrada un RuntimeEvent sul canale corretto (TTS o visual_sink).

        Tabella di instradamento (US-145 AC1):
            SpokenSummary  → tts_queue (event.text)
            Acknowledgment → tts_queue (event.text)
            Question       → tts_queue (event.text)
            Error          → tts_queue (breve) + visual_sink (dettaglio); chiude turno
            Progress       → visual_sink; annuncio TTS opzionale se testo presente
            Artifact       → visual_sink ESCLUSIVAMENTE; mai al TTS (AC3)
            Done           → visual_sink; chiude turno

        Args:
            event: evento tipizzato emesso da FactoryRuntime.submit().

        Returns:
            True  — il turno continua (altri eventi attesi).
            False — il turno e' terminato (Done o Error ricevuto).

        Note (AC5): se _to_tts riceve un tipo non in TTS_ALLOWED (per errore di
        chiamata esterna), lo scarta con WARNING senza accodare al TTS.
        """
        match event:
            case SpokenSummary():
                await self._to_tts(event, event.text)
                return True

            case Acknowledgment():
                await self._to_tts(event, event.text)
                return True

            case Question():
                await self._to_tts(event, event.text)
                return True

            case Error():
                # Errore: canale visivo (dettaglio) + TTS (versione breve pronunciabile).
                # Contratto runtime §7 e factory_runtime.py: destinazione TTS + visivo.
                self._sink.write(f"[ERROR] {event.message}\n")
                await self._to_tts(event, f"Errore: {event.message}")
                return False

            case Progress():
                pct_str = f" {event.pct:.0%}" if event.pct is not None else ""
                self._sink.write(f"[PROGRESS{pct_str}] {event.text}\n")
                # Annuncio TTS breve opzionale (abilitare se UX richiede feedback vocale).
                # La specifica lo lascia opzionale (TSK-302 DoD); il default e' solo visivo.
                # if event.text:
                #     await self._to_tts(event, event.text)
                return True

            case Artifact():
                # INVARIANTE: Artifact va SOLO al canale visivo. Mai al TTS (AC3).
                # _to_tts non viene chiamato in questo ramo per design.
                self._sink.write(f"[ARTIFACT kind={event.kind}]\n{event.content}\n")
                return True

            case Done():
                self._sink.write("[DONE]\n")
                return False

            case _:
                # Tipo sconosciuto (future extension): scarta silenziosamente con WARNING.
                log.warning(
                    "EventRouter: evento sconosciuto scartato: %s",
                    type(event).__name__,
                )
                return True

    async def _to_tts(self, event: RuntimeEvent, text: str) -> None:
        """
        Accoda testo al TTS solo se il tipo e' in TTS_ALLOWED.

        Difesa in profondita' (AC5): se chiamato con un tipo non in TTS_ALLOWED
        (es. per errore di refactoring), logga WARNING e scarta senza accodare.
        Questo e' l'unico percorso verso tts_queue nell'intero modulo.
        """
        if type(event) not in TTS_ALLOWED:
            log.warning(
                "EventRouter: tipo non-parlato scartato: %s",
                type(event).__name__,
            )
            return
        await self._tts_queue.put(text)

    def extract_spoken_summary(self, artifact_text: str) -> str | None:
        """
        Estrae la sintesi parlata da un blocco markdown se presente.

        Pattern supportati (in ordine di priorita'):
          1. ```spoken\\n<testo>\\n```
          2. <!-- spoken: <testo> -->

        Usato come fallback sintattico quando il runtime produce testo misto non
        ancora strutturato in eventi tipizzati (US-145 §Contratto separatore sintattico,
        Opzione A complementare).

        Args:
            artifact_text: testo markdown grezzo (output LLM non strutturato).

        Returns:
            Testo parlato estratto (stripped), oppure None se nessun pattern trovato.
        """
        m = _SPOKEN_FENCE_RE.search(artifact_text)
        if m:
            return m.group(1).strip() or None

        m = _SPOKEN_COMMENT_RE.search(artifact_text)
        if m:
            return m.group(1).strip() or None

        return None
