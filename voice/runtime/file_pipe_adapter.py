"""
voice/runtime/file_pipe_adapter.py — Adapter file-pipe per Claude Code in-session.

Invece di lanciare `claude -p` come subprocess, scrive la trascrizione vocale
su un file inbox che la sessione Claude Code corrente monitora. La risposta
viene scritta dalla sessione corrente su un file outbox che questo adapter legge.

Questo permette al voice channel di integrarsi con la chat Claude Code attiva,
facendo apparire le interazioni vocali direttamente nella conversazione corrente.

Protocollo file:
  inbox:  ~/.local/share/soli-voice/voice-in.json   {"id": str, "text": str, "ts": float}
  outbox: ~/.local/share/soli-voice/voice-out.json  {"id": str, "response": str}
  ready:  ~/.local/share/soli-voice/voice-ready     touch file — segnala nuovo input

Config (voice_channel.runtime):
  provider: file-pipe
  pipe_timeout: 180     # secondi max attesa risposta dalla sessione
  pipe_poll_ms: 100     # intervallo polling outbox in millisecondi (fallback watchdog)

Notifica outbox:
  - Percorso primario  (watchdog disponibile): FSEvents su macOS, inotify su Linux.
    Latenza tipica < 10ms. Nessun polling attivo.
  - Percorso fallback  (watchdog assente):     polling ogni pipe_poll_ms (default 100ms).
    Il fallback viene annunciato con un log INFO una sola volta all'inizializzazione.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, AsyncGenerator

# ---------------------------------------------------------------------------
# Import guard watchdog — opzionale; nessun ImportError se assente (AC4)
# ---------------------------------------------------------------------------
try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    _WATCHDOG_AVAILABLE = True
except ImportError:
    _WATCHDOG_AVAILABLE = False

from voice.runtime.factory_runtime import (
    Acknowledgment,
    Done,
    Error,
    FactoryRuntime,
    RuntimeEvent,
    SpokenSummary,
    Artifact,
)
from voice.core.side_channel import (
    CONSUMER_ALIVE,
    INBOX,
    atomic_write_json,
    SCHEMA_VERSION,
)

if TYPE_CHECKING:
    from voice.config import VoiceConfig

logger = logging.getLogger(__name__)

_PIPE_DIR = Path.home() / ".local/share/soli-voice"
# _INBOX rimosso: sostituito da INBOX (voice.core.side_channel) — TSK-370
_OUTBOX  = _PIPE_DIR / "voice-out.json"
_READY   = _PIPE_DIR / "voice-ready"


class FilePipeAdapter(FactoryRuntime):
    """
    Adapter che relay ogni utterance vocale alla sessione Claude Code attiva
    tramite file-pipe bidirezionale.

    Attende la risposta dalla sessione via watchdog (FSEvents/inotify) quando
    disponibile; cade in fallback su polling ogni ``_poll_ms`` altrimenti.
    """

    def __init__(self, config: "VoiceConfig") -> None:
        self._config = config
        rt = config.runtime
        self._timeout: int   = getattr(rt, "pipe_timeout", 180)
        # default 100ms (fallback polling); TSK-344 formalizza pipe_poll_ms in RuntimeConfig
        self._poll_ms: float = getattr(rt, "pipe_poll_ms", 100) / 1000.0
        _PIPE_DIR.mkdir(parents=True, exist_ok=True)
        # Pulisce outbox residuo da sessioni precedenti
        _OUTBOX.unlink(missing_ok=True)
        # Log una sola volta se watchdog non disponibile (AC3)
        if not _WATCHDOG_AVAILABLE:
            logger.info(
                "watchdog non disponibile: file-pipe usa polling a %dms",
                int(self._poll_ms * 1000),
            )

    def is_consumer_alive(self) -> bool:
        """True se CONSUMER_ALIVE esiste e mtime <= consumer_alive_ttl_s secondi.
        False se il file non esiste. Default True se liveness_check disabilitato in config.

        Usa getattr difensivo su self._config.runtime fino a quando TSK-371
        (RuntimeConfig) non formalizza i campi liveness_check e consumer_alive_ttl_s.
        """
        liveness_check = getattr(getattr(self._config, "runtime", None), "liveness_check", True)
        if not liveness_check:
            return True
        consumer_alive_ttl_s = getattr(
            getattr(self._config, "runtime", None), "consumer_alive_ttl_s", 10
        )
        if not CONSUMER_ALIVE.exists():
            return False
        age = time.monotonic() - CONSUMER_ALIVE.stat().st_mtime
        return age <= consumer_alive_ttl_s

    # ------------------------------------------------------------------
    # Interfaccia FactoryRuntime (AC5: firma invariata)
    # ------------------------------------------------------------------

    async def submit(
        self, text: str, session_id: str
    ) -> AsyncGenerator[RuntimeEvent, None]:
        turn_id = str(uuid.uuid4())[:8]

        # Scrive inbox atomicamente (US-165 F5)
        atomic_write_json(INBOX, {
            "id": turn_id,
            "text": text,
            "ts": time.time(),
            "schema_version": SCHEMA_VERSION,
        })
        # Touch ready file — segnala alla sessione Claude Code che c'è input
        _READY.touch()

        yield Acknowledgment("in attesa della sessione Claude Code...")

        # Attende risposta: percorso event-driven o fallback polling
        if _WATCHDOG_AVAILABLE:
            data = await self._await_watchdog(turn_id)
        else:
            data = await self._await_polling(turn_id)

        if data is None:
            yield Error(
                f"Timeout: la sessione Claude Code non ha risposto in {self._timeout}s."
            )
            return

        # Risposta ricevuta — pulizia file di protocollo
        _OUTBOX.unlink(missing_ok=True)
        INBOX.unlink(missing_ok=True)
        _READY.unlink(missing_ok=True)

        response = data.get("response", "")
        if not response:
            yield Error("Risposta vuota dalla sessione.")
            return

        yield SpokenSummary(response[:500])
        yield Artifact(kind="text", content=response)
        yield Done()

    async def cancel(self, session_id: str) -> None:
        _OUTBOX.unlink(missing_ok=True)
        INBOX.unlink(missing_ok=True)
        _READY.unlink(missing_ok=True)

    async def aclose(self) -> None:
        pass

    # ------------------------------------------------------------------
    # Percorso event-driven (AC1)
    # ------------------------------------------------------------------

    async def _await_watchdog(self, turn_id: str) -> dict | None:
        """
        Attende ``voice-out.json`` tramite watchdog (FSEvents su macOS / inotify su Linux).
        Latenza tipica < 10ms.  Ritorna il dict outbox se l'id corrisponde, None su timeout.
        """
        loop = asyncio.get_running_loop()
        event = asyncio.Event()

        class _OutboxHandler(FileSystemEventHandler):  # type: ignore[misc]
            def on_modified(self_h, fs_event) -> None:  # noqa: N805
                if Path(fs_event.src_path).name == _OUTBOX.name:
                    loop.call_soon_threadsafe(event.set)

            def on_created(self_h, fs_event) -> None:  # noqa: N805
                if Path(fs_event.src_path).name == _OUTBOX.name:
                    loop.call_soon_threadsafe(event.set)

        observer = Observer()
        observer.schedule(_OutboxHandler(), str(_PIPE_DIR), recursive=False)
        observer.start()
        try:
            # Race check: il file potrebbe già essere presente prima che observer parta
            if _OUTBOX.exists():
                event.set()
            await asyncio.wait_for(event.wait(), timeout=self._timeout)
        except asyncio.TimeoutError:
            return None
        finally:
            observer.stop()
            observer.join()

        return self._read_outbox(turn_id)

    # ------------------------------------------------------------------
    # Percorso fallback polling (AC3)
    # ------------------------------------------------------------------

    async def _await_polling(self, turn_id: str) -> dict | None:
        """
        Attende ``voice-out.json`` via polling ogni ``_poll_ms`` (default 100ms).
        Usato quando watchdog non è disponibile.
        """
        deadline = time.monotonic() + self._timeout
        while time.monotonic() < deadline:
            await asyncio.sleep(self._poll_ms)
            data = self._read_outbox(turn_id)
            if data is not None:
                return data
        return None

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def _read_outbox(self, turn_id: str) -> dict | None:
        """
        Legge e valida ``voice-out.json``.
        Ritorna il dict se il campo ``id`` corrisponde a ``turn_id``, None altrimenti.
        """
        if not _OUTBOX.exists():
            return None
        try:
            data = json.loads(_OUTBOX.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        if data.get("id") != turn_id:
            return None
        return data
