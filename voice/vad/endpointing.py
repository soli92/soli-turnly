"""voice/vad/endpointing.py — Rilevamento fine-turno (endpointing) via VAD.

Accumula frame audio classificati dal VAD e segnala quando un utterance
e' completo (silenzio prolungato oltre la soglia configurata).

In Fase 1 (push-to-talk sequenziale) l'Endpointer non e' sul percorso attivo:
il turno termina al rilascio del tasto. Il modulo esiste e deve essere
importabile (US-143 AC1) per la Fase 2 (endpointing automatico, US-144).

Nessuna dipendenza esterna: stdlib soltanto.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from voice.vad.base import VADBase


class Endpointer:
    """Accumula frame VAD e segnala quando un utterance e' completo.

    Logica di fine-turno: dopo aver ricevuto almeno un frame di parlato,
    un silenzio continuo >= silence_threshold_ms ms viene interpretato come
    fine dell'utterance. Lo stato interno viene azzerato dopo ogni turn-end.

    Args:
        vad:                  Istanza VADBase concreta (SileroVAD / WebRTCVAD).
        silence_threshold_ms: Durata minima di silenzio per dichiarare fine-turno
                              in millisecondi (default 700 ms; range suggerito
                              500-800 ms per un'esperienza naturale).
        debounce_ms:          Finestra di debounce in millisecondi: un secondo
                              endpoint entro questo intervallo dal precedente viene
                              soppresso silenziosamente (US-155; default 500 ms).
                              Al primo turno (_last_endpoint_ts == 0.0) la
                              condizione e' sempre falsa — zero overhead nominale.
    """

    def __init__(
        self,
        vad: "VADBase",
        silence_threshold_ms: int = 700,
        debounce_ms: int = 500,
    ) -> None:
        if silence_threshold_ms <= 0:
            raise ValueError(
                f"silence_threshold_ms deve essere positivo, "
                f"ricevuto: {silence_threshold_ms}"
            )
        self._vad = vad
        self._silence_threshold_ms = silence_threshold_ms
        self._debounce_ms = debounce_ms

        # Stato interno
        self._accumulated: list[bytes] = []
        self._speech_started: bool = False
        self._silence_ms: int = 0
        # Timestamp dell'ultimo endpoint accettato (monotonic, secondi).
        # Inizializzato a 0.0: la condizione di debounce e' falsa al primo turno (AC5).
        self._last_endpoint_ts: float = 0.0

    # ------------------------------------------------------------------
    # Interfaccia pubblica
    # ------------------------------------------------------------------

    @property
    def speech_started(self) -> bool:
        """True se il VAD ha rilevato l'inizio del parlato nel turno corrente.
        Read-only — non altera il comportamento di feed_frame() né reset().
        """
        return self._speech_started

    def feed_frame(self, frame: bytes, samplerate: int) -> bool:
        """Processa un frame audio e aggiorna lo stato interno.

        Ogni chiamata accumula il frame e aggiorna il contatore di silenzio.
        Quando il silenzio supera la soglia e un utterance era in corso,
        lo stato viene azzerato e il metodo restituisce True.

        Args:
            frame:      Chunk di audio grezzo PCM a 16-bit little-endian.
            samplerate: Frequenza di campionamento in Hz.

        Returns:
            True se l'utterance e' terminato (fine-turno rilevata),
            False altrimenti.
        """
        # Durata del frame in ms (PCM 16-bit = 2 bytes/sample)
        num_samples = len(frame) // 2
        frame_ms = num_samples * 1000 // samplerate if samplerate > 0 else 0

        is_speech = self._vad.is_speech(frame, samplerate)

        if is_speech:
            # Parlato rilevato: azzera il contatore di silenzio, accumula il frame
            self._speech_started = True
            self._silence_ms = 0
            self._accumulated.append(frame)
        else:
            # Silenzio: accumula comunque il frame (per contesto), aggiorna il contatore
            self._accumulated.append(frame)
            if self._speech_started:
                self._silence_ms += frame_ms

        # Verifica fine-turno: silenzio prolungato dopo almeno un frame di parlato
        if self._speech_started and self._silence_ms >= self._silence_threshold_ms:
            now = time.monotonic()
            if (self._last_endpoint_ts > 0.0 and
                    (now - self._last_endpoint_ts) * 1000 < self._debounce_ms):
                # Endpoint spurio: arriva entro la finestra di debounce dal precedente.
                # Soppresso silenziosamente per evitare doppio turn-end (US-155 P1).
                self._reset()
                return False
            # Endpoint accettato: aggiorna il timestamp e segnala fine-turno.
            self._last_endpoint_ts = now
            self._reset()
            return True

        return False

    def get_accumulated(self) -> list[bytes]:
        """Restituisce i frame accumulati dall'ultimo reset.

        Returns:
            Lista di frame audio accumulati (copia difensiva).
        """
        return list(self._accumulated)

    def reset(self) -> None:
        """Azzera lo stato di accumulo (es. al rilascio del tasto in F1 o a inizio CATTURA).

        Resetta: _accumulated, _speech_started, _silence_ms.
        NON resetta _last_endpoint_ts: azzerarlo rimuoverebbe la protezione di debounce
        tra il turno N (fine PARLATO) e l'inizio di CATTURA turno N+1, dove la coda
        audio/eco genera l'endpoint spurio che e' la root cause di US-155 P1.
        """
        self._reset()

    # ------------------------------------------------------------------
    # Metodi privati
    # ------------------------------------------------------------------

    def _reset(self) -> None:
        """Azzera lo stato interno dopo un turn-end o su richiesta esplicita."""
        self._accumulated = []
        self._speech_started = False
        self._silence_ms = 0
        # Resetta lo stato del modello VAD sottostante (es. Silero hidden state).
        # Facoltativo: chiamato solo se il VAD espone reset().
        if hasattr(self._vad, "reset"):
            self._vad.reset()  # type: ignore[union-attr]
