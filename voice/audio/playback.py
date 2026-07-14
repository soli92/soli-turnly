"""
voice/audio/playback.py — Riproduzione audio sincrona via sounddevice (PortAudio).

Design:
- `play()` e' sincrono: blocca finche' i dati sono stati riprodotti.
  In Fase 1 la sequenzialita' e' voluta (US-143 Note Tecniche).
  Per l'uso dentro `asyncio`, wrapparlo con `asyncio.to_thread(playback.play, ...)`.
- `abort()` interrompe immediatamente il playback (barge-in Fase 3, US-144).
  In Fase 1 viene usato per flush su errore.
- `stop()` effettua un drain ordinato e poi chiude il device.
- `sounddevice` e' importato lazily dentro ogni metodo che ne ha bisogno.
- `PlaybackFarEndSink` (US-147 Fase 4): buffer circolare thread-safe che riceve
  ogni frame TTS in riproduzione, esposto all'AECProcessor come reference far-end
  per la cancellazione eco (cattura → AEC → VAD → STT).

Uso tipico (Fase 1, sequenziale):
    playback = AudioPlayback(config)
    playback.play(audio_array, samplerate=22050)
    # blocca finche' l'audio e' terminato

    # Interruzione di emergenza (es. barge-in Fase 3):
    playback.abort()
"""
from __future__ import annotations

import collections
import logging
import threading
from typing import TYPE_CHECKING, Optional

log = logging.getLogger(__name__)

if TYPE_CHECKING:
    import numpy as np


# ---------------------------------------------------------------------------
# PlaybackFarEndSink — buffer circolare thread-safe per il segnale far-end
# ---------------------------------------------------------------------------

class PlaybackFarEndSink:
    """
    Buffer circolare thread-safe per i frame audio TTS in riproduzione.

    Fornisce la reference far-end all'AECProcessor: AudioPlayback notifica ogni
    frame TTS riprodotto tramite `push()`; AudioCapture legge il frame piu'
    recente tramite `get_latest()` nel callback real-time per usarlo come
    segnale di riferimento AEC (US-147 Fase 4).

    Thread-safety: push() e get_latest() sono protetti da threading.Lock.
    Il buffer e' una deque con maxlen fisso (circolare): i frame piu' vecchi
    vengono scartati automaticamente quando il buffer e' pieno.

    Args:
        maxlen: capacita' massima del buffer circolare (default 32 frame).
                A 30 ms/frame @ 16kHz, 32 frame = ~960 ms di storia.
    """

    def __init__(self, maxlen: int = 32) -> None:
        self._buffer: collections.deque = collections.deque(maxlen=maxlen)
        self._lock = threading.Lock()

    def push(self, frame: "np.ndarray") -> None:
        """Aggiunge un frame audio al buffer circolare (thread-safe).

        Args:
            frame: PCM float32, shape (N,) mono — frame TTS in riproduzione.
        """
        with self._lock:
            self._buffer.append(frame)

    def get_latest(self) -> "Optional[np.ndarray]":
        """Restituisce il frame piu' recente, o None se il buffer e' vuoto.

        Thread-safe: chiamabile dal thread real-time del callback PortAudio.
        """
        with self._lock:
            if self._buffer:
                return self._buffer[-1]
            return None


class AudioPlayback:
    """
    Riproduzione sincrona di audio numpy via sounddevice.

    Thread-safety: `abort()` e' progettato per essere chiamato da un thread
    diverso rispetto a `play()`. Lo stato interno e' protetto da `threading.Event`.
    """

    def __init__(self, config: "VoiceConfig") -> None:  # noqa: F821
        """
        Inizializza AudioPlayback con il config vocale.

        Args:
            config: VoiceConfig da `voice.config`. In Fase 1 il config e'
                    usato per potenziali override futuri (device output, ecc.).
        """
        self._config = config
        # Device di output: stringa nome device o None (default sistema)
        self._output_device = config.audio.output_device  # type: ignore[attr-defined]
        self._abort_event = threading.Event()
        # Far-end sink per AEC (Fase 4, US-147): None di default (nessun AEC attivo).
        # Impostato via set_far_end_sink() dall'assembler (voice/app.py) quando
        # config.aec.enabled=True.
        self._far_end_sink: Optional["PlaybackFarEndSink"] = None

    def set_far_end_sink(self, sink: "PlaybackFarEndSink") -> None:
        """Imposta il sink far-end per l'AEC (US-147 Fase 4).

        Ogni frame audio TTS in riproduzione viene inviato al sink via push()
        prima che il playback inizi. AudioCapture legge il frame piu' recente
        dal sink come reference far-end per l'AECProcessor nel suo callback.

        Args:
            sink: PlaybackFarEndSink istanza condivisa con AudioCapture.
        """
        self._far_end_sink = sink

    # ------------------------------------------------------------------
    # API pubblica
    # ------------------------------------------------------------------

    def play(self, audio_data: "np.ndarray", samplerate: int = 22050) -> None:
        """
        Riproduce un array numpy in modo sincrono (bloccante).

        Pulisce il flag di abort prima di avviare la riproduzione in modo che
        una chiamata precedente ad `abort()` non contamini la riproduzione
        successiva.

        Args:
            audio_data:  numpy array float32 con i campioni audio. Shape
                         `(n_samples,)` mono o `(n_samples, channels)` stereo.
            samplerate:  frequenza di campionamento in Hz (default 22050,
                         tipico output TTS piper).

        Raises:
            ImportError: se sounddevice non e' installato.
        """
        try:
            import sounddevice as sd  # noqa: PLC0415
        except ImportError as exc:
            raise ImportError(
                "sounddevice non trovato. "
                "Installa le dipendenze vocali: pip install '.[voice]'"
            ) from exc

        # Reset del flag: abort() chiamato prima di play() non deve fermare
        # il play corrente.
        self._abort_event.clear()

        # Far-end sink (AEC Fase 4, US-147): notifica il frame TTS come reference
        # far-end prima che il playback inizi. AudioCapture legge il frame piu'
        # recente dal sink durante il callback AEC. Normalizzato a mono (N,) float32.
        if self._far_end_sink is not None:
            import numpy as _np  # noqa: PLC0415  # lazy: evitato quando AEC disabilitato
            _ref = _np.asarray(audio_data, dtype=_np.float32)
            if _ref.ndim > 1:
                _ref = _ref[:, 0]
            self._far_end_sink.push(_ref)

        # sounddevice.play() e' non-bloccante; sounddevice.wait() blocca
        # finche' il playback e' terminato (o finche' abort() chiama stop()).
        sd.play(audio_data, samplerate=samplerate)
        try:
            # Polling loop per onorare l'evento di abort senza busy-wait.
            # sounddevice.wait() blocca senza timeout; usiamo get_stream per
            # controllare il flag di abort con granularita' di 50 ms.
            import time as _time  # noqa: PLC0415

            while sd.get_stream().active:
                if self._abort_event.is_set():
                    sd.stop()
                    break
                _time.sleep(0.05)
        except Exception as _poll_exc:  # noqa: BLE001
            # Stream già chiuso o altro errore non critico — non propaga.
            # Log WARNING per rendere visibile PaErrorCode -9986 e simili.
            log.warning("AudioPlayback: errore polling stream: %s", _poll_exc)

    def abort(self) -> None:
        """
        Interrompe immediatamente il playback in corso (drop dei buffer).

        Thread-safe: puo' essere chiamato da qualsiasi thread.
        Se non c'e' playback in corso, e' un no-op.
        """
        try:
            import sounddevice as sd  # noqa: PLC0415
        except ImportError:
            return

        self._abort_event.set()
        try:
            sd.stop()
        except Exception:  # noqa: BLE001
            pass

    def stop(self) -> None:
        """
        Attende il termine del playback corrente (drain ordinato) poi chiude.

        A differenza di `abort()`, non interrompe i buffer gia' avviati.
        Usato per shutdown pulito del modulo.
        """
        try:
            import sounddevice as sd  # noqa: PLC0415
        except ImportError:
            return

        try:
            sd.wait()
        except Exception:  # noqa: BLE001
            pass
