"""
voice/voice_consumer.py — Bridge STT→tutor→TTS non supervisionato.

Monitora voice-out.json in modo event-driven (watchdog primario, polling
fallback) e invia ogni risposta LLM al TTS piper (PiperTTS + AudioPlayback).

Chiude il loop STT→tutor→TTS senza intervento manuale:
  1. La state machine (FSM) scrive la trascrizione su voice-in.json.
  2. Claude Code legge voice-in.json, elabora, scrive voice-out.json:
         {"id": "<turn_id>", "response": "<testo risposta LLM>"}
  3. VoiceConsumer legge voice-out.json → estrae "response" → TTS → audio.

Invarianti fondamentali (EP-046 C3, feedback_voice_pipe_response_field):
  - Campo letto: data.get("response", "") — MAI "text" (TTS silenzioso se "text").
  - Guard su stringa vuota: log WARNING + skip; nessun TTS silenzioso.
  - Loop event-driven: FSEvents su macOS / inotify su Linux via watchdog
    se disponibile; fallback su polling ogni pipe_poll_ms (default 100ms).
  - Errori TTS non propagati: log ERROR + continua il loop.
  - Compatibile con EP-046 C7 (session-owner stub via VoiceSessionManager).

Parametri TTS da config (voice_channel.tts.*):
  - tts.voice     — nome modello piper (default it_IT-riccardo-medium)
  - tts.model_dir — directory file .onnx (default: PIPER_MODEL_DIR o cwd)

Uso:
    from voice.voice_consumer import VoiceConsumer
    from voice.config import load_config

    cfg = load_config()
    consumer = VoiceConsumer(cfg)
    asyncio.run(consumer.run())

Oppure come processo standalone:
    python -m voice.voice_consumer [--config path/factory.config.yaml]
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING, Optional

# ---------------------------------------------------------------------------
# Import guard watchdog — opzionale (specchio di runtime/file_pipe_adapter.py)
# Nessun ImportError se watchdog non installato: si usa il percorso fallback.
# ---------------------------------------------------------------------------
try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    _WATCHDOG_AVAILABLE = True
except ImportError:
    _WATCHDOG_AVAILABLE = False

from voice.core.side_channel import SOLI_VOICE_DIR
from voice.core.session import VoiceSessionManager

if TYPE_CHECKING:
    from voice.config import VoiceConfig

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Path costanti — allineate a file_pipe_adapter.py e side_channel.py
# ---------------------------------------------------------------------------

_PIPE_DIR = SOLI_VOICE_DIR
_OUTBOX   = _PIPE_DIR / "voice-out.json"


# ---------------------------------------------------------------------------
# VoiceConsumer
# ---------------------------------------------------------------------------

class VoiceConsumer:
    """
    Consumer bridge STT→tutor→TTS non supervisionato (EP-046).

    Monitora voice-out.json per nuove risposte LLM e le invia al TTS piper
    via PiperTTS (sintesi) + AudioPlayback (riproduzione).

    Invarianti:
      - Campo letto: data.get("response", "") — MAI "text".
      - Guard su stringa vuota → log WARNING + skip.
      - Loop event-driven (watchdog primario, polling fallback).
      - Errori TTS → log ERROR, loop continua.
      - EP-046 C7: VoiceSessionManager stub no-op istanziato.

    Args:
        config: VoiceConfig caricata da factory.config.yaml.
    """

    def __init__(self, config: "VoiceConfig") -> None:
        self._config = config
        rt = config.runtime
        # Intervallo polling fallback in secondi (da pipe_poll_ms in config)
        self._poll_ms: float = getattr(rt, "pipe_poll_ms", 100) / 1000.0
        # Sample rate output piper-tts — allineato a state_machine.py (tts_sr)
        self._tts_sr: int = 22050
        # ID dell'ultimo turno processato — filtra duplicati su loop rapido
        self._last_id: Optional[str] = None
        # Session-owner stub (EP-046 C7, US-170): no-op nell'implementazione corrente
        self._session_manager = VoiceSessionManager()

        _PIPE_DIR.mkdir(parents=True, exist_ok=True)

        if not _WATCHDOG_AVAILABLE:
            logger.info(
                "watchdog non disponibile: VoiceConsumer usa polling a %dms",
                int(self._poll_ms * 1000),
            )

    # ------------------------------------------------------------------
    # Entry point pubblico
    # ------------------------------------------------------------------

    async def run(self) -> None:
        """Loop principale event-driven. Blocca fino a Ctrl+C.

        Inizializza TTS e Playback (lazy — nessun import piper/sounddevice
        a livello modulo), poi entra nel ciclo di attesa su voice-out.json.

        Per ogni nuova risposta:
          1. Legge data.get("response", "")
          2. Guard su vuoto → skip (nessun TTS silenzioso)
          3. Sintetizza via PiperTTS
          4. Riproduce via AudioPlayback
          5. Errori TTS → log ERROR + continua

        Raises:
            ImportError: se piper-tts o sounddevice non sono installati.
        """
        logger.info("VoiceConsumer: avvio — attesa risposte su %s", _OUTBOX)

        try:
            tts = self._build_tts()
            playback = self._build_playback()
        except ImportError as exc:
            logger.error("VoiceConsumer: dipendenze TTS non disponibili: %s", exc)
            raise

        logger.info(
            "VoiceConsumer: TTS inizializzato (voice=%r, sr=%d Hz)",
            self._config.tts.voice,
            self._tts_sr,
        )

        try:
            while True:
                data = await self._wait_for_response()
                await self._handle_response(data, tts, playback)
        except KeyboardInterrupt:
            logger.info("VoiceConsumer: interruzione da Ctrl+C — loop terminato")

    # ------------------------------------------------------------------
    # Lazy build dipendenze TTS e Playback
    # ------------------------------------------------------------------

    def _build_tts(self):
        """Istanzia PiperTTS con i parametri da voice_channel.tts.* in config.

        Import lazy: nessun import di piper-tts a livello modulo (backward compat
        con ambienti senza extras[voice]).
        """
        from voice.tts.piper_tts import PiperTTS  # noqa: PLC0415
        return PiperTTS(
            voice=self._config.tts.voice,
            model_dir=self._config.tts.model_dir,
        )

    def _build_playback(self):
        """Istanzia AudioPlayback con la VoiceConfig corrente.

        Import lazy: nessun import di sounddevice a livello modulo.
        """
        from voice.audio.playback import AudioPlayback  # noqa: PLC0415
        return AudioPlayback(self._config)

    # ------------------------------------------------------------------
    # Attesa event-driven o polling
    # ------------------------------------------------------------------

    async def _wait_for_response(self) -> dict:
        """Attende il prossimo voice-out.json valido e non duplicato.

        Usa watchdog (FSEvents su macOS / inotify su Linux) se disponibile;
        fallback su polling ogni pipe_poll_ms altrimenti.

        Non ritorna mai None: blocca fino a dato valido e nuovo.
        """
        if _WATCHDOG_AVAILABLE:
            return await self._wait_watchdog()
        return await self._wait_polling()

    async def _wait_watchdog(self) -> dict:
        """Attende voice-out.json via watchdog (event-driven, latenza < 10ms).

        Crea un Observer per ogni attesa; al receive dell'evento legge l'outbox.
        Se l'ID è già processato o il file non è valido, itera con pausa 100ms
        (evita busy-loop su edge case con file stale).

        Pattern speculare a file_pipe_adapter.py._await_watchdog().
        """
        while True:
            loop = asyncio.get_running_loop()
            ev = asyncio.Event()

            class _Handler(FileSystemEventHandler):  # type: ignore[misc]
                def on_modified(self_h, fs_ev) -> None:  # noqa: N805
                    if Path(fs_ev.src_path).name == _OUTBOX.name:
                        loop.call_soon_threadsafe(ev.set)

                def on_created(self_h, fs_ev) -> None:  # noqa: N805
                    if Path(fs_ev.src_path).name == _OUTBOX.name:
                        loop.call_soon_threadsafe(ev.set)

            observer = Observer()
            observer.schedule(_Handler(), str(_PIPE_DIR), recursive=False)
            observer.start()
            try:
                # Race-check: il file potrebbe essere già presente prima
                # che l'observer venga avviato — imposta subito l'evento.
                if _OUTBOX.exists():
                    ev.set()
                await ev.wait()
            finally:
                observer.stop()
                observer.join()

            data = self._read_outbox()
            if data is not None:
                return data
            # File presente ma ID già processato o JSON non valido — pausa
            # breve prima di rientrare nel loop per evitare busy-spin.
            await asyncio.sleep(0.1)

    async def _wait_polling(self) -> dict:
        """Attende voice-out.json via polling ogni _poll_ms.

        Percorso fallback quando watchdog non è disponibile.
        Loop con sleep ogni pipe_poll_ms (default 100ms).
        """
        while True:
            data = self._read_outbox()
            if data is not None:
                return data
            await asyncio.sleep(self._poll_ms)

    # ------------------------------------------------------------------
    # Lettura e validazione outbox
    # ------------------------------------------------------------------

    def _read_outbox(self) -> Optional[dict]:
        """Legge voice-out.json e filtra turni già processati.

        Invariante campo: legge "response" (non "text") — il campo viene
        estratto in _handle_response; qui si valida solo struttura e ID.

        Returns:
            dict con contenuto outbox se:
              - il file esiste
              - il JSON è valido
              - data["id"] è diverso da self._last_id (nuovo turno)
            None altrimenti (file assente / JSON non valido / ID duplicato).
        """
        if not _OUTBOX.exists():
            return None
        try:
            data = json.loads(_OUTBOX.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        # Filtra ID già processati — evita doppio TTS su file non ancora rimosso
        turn_id = data.get("id")
        if turn_id is not None and turn_id == self._last_id:
            return None
        return data

    # ------------------------------------------------------------------
    # Gestione risposta: TTS + playback
    # ------------------------------------------------------------------

    async def _handle_response(self, data: dict, tts, playback) -> None:
        """Estrae "response", fa guard su vuoto, sintetizza e riproduce.

        Invariante campo (feedback_voice_pipe_response_field):
            Legge data.get("response", "") — MAI data.get("text", "").
            Il campo "text" è quello scritto su voice-in.json (trascrizione
            STT); "response" è la risposta LLM su voice-out.json.
            Leggere il campo sbagliato produce TTS silenzioso.

        Guard stringa vuota: log WARNING + return (nessun TTS silenzioso).

        Errori TTS/Playback: log ERROR + return (non propagati — il loop
        deve continuare anche in caso di errore piper o sounddevice).

        Args:
            data:     dict letto da voice-out.json.
            tts:      PiperTTS istanza per la sintesi vocale.
            playback: AudioPlayback istanza per la riproduzione audio.
        """
        turn_id = data.get("id")
        # Aggiorna last_id prima del TTS: se TTS crasha, non rielaboriamo
        # lo stesso turno al prossimo giro (guard duplicati).
        self._last_id = turn_id

        # Invariante campo "response" (NON "text") — feedback_voice_pipe_response_field
        response = data.get("response", "")

        # Guard su stringa vuota → nessun TTS silenzioso (DoD invariante)
        if not response or not response.strip():
            logger.warning(
                "VoiceConsumer: risposta vuota per turno %r — skip TTS "
                "(nessun audio silenzioso)",
                turn_id,
            )
            return

        logger.info(
            "VoiceConsumer: turno %r — risposta %d caratteri → sintetizzo TTS",
            turn_id, len(response),
        )

        # Rimuove l'outbox dopo lettura (pulizia protocollo file-pipe)
        try:
            _OUTBOX.unlink(missing_ok=True)
        except OSError as exc:
            logger.debug("VoiceConsumer: pulizia outbox fallita (non bloccante): %s", exc)

        # Sintesi TTS + riproduzione audio.
        # Errori non propagati: il loop deve continuare su errori TTS (DoD).
        try:
            audio = await asyncio.to_thread(tts.synthesize, response)
            if audio is not None and len(audio) == 0:
                logger.warning(
                    "VoiceConsumer: sintesi TTS ha prodotto audio vuoto "
                    "per turno %r — skip playback",
                    turn_id,
                )
                return
            await asyncio.to_thread(playback.play, audio, self._tts_sr)
            logger.info(
                "VoiceConsumer: turno %r — riproduzione completata", turn_id
            )
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "VoiceConsumer: errore TTS/playback per turno %r: %s", turn_id, exc
            )
            # Non propagare: il loop deve continuare su errori TTS (DoD)


# ---------------------------------------------------------------------------
# Entry point CLI standalone
# ---------------------------------------------------------------------------

def _cli_main() -> None:
    """Entry point per esecuzione standalone: python -m voice.voice_consumer."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(
        description=(
            "VoiceConsumer — bridge STT→tutor→TTS non supervisionato (EP-046).\n"
            "Monitora voice-out.json e invia ogni risposta LLM al TTS piper."
        )
    )
    parser.add_argument(
        "--config",
        default=None,
        metavar="PATH",
        help=(
            "Percorso esplicito a factory.config.yaml "
            "(default: risale il filesystem dalla cwd)"
        ),
    )
    parser.add_argument(
        "--log-level",
        default=None,
        metavar="LEVEL",
        help="Override log level: DEBUG | INFO | WARNING (default: da voice_channel.log_level)",
    )
    args = parser.parse_args()

    from voice.config import load_config  # noqa: PLC0415

    cfg = load_config(args.config)

    if not cfg.enabled:
        print(
            "voice_channel.enabled: false in factory.config.yaml — "
            "VoiceConsumer non avviato.\n"
            "Imposta voice_channel.enabled: true per abilitare il canale vocale.",
            file=sys.stderr,
        )
        sys.exit(1)

    log_level = (args.log_level or cfg.log_level or "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )

    consumer = VoiceConsumer(cfg)
    asyncio.run(consumer.run())


if __name__ == "__main__":
    _cli_main()
