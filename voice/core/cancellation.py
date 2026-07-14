"""
voice/core/cancellation.py — Cancellazione e barge-in (Fase 3, TSK-300).

Implementa il rilevatore a due stadi RMS+VAD per il barge-in durante il
playback TTS e la sequenza asincrona di cancel propagato.

Architettura:
  BargeinDetector.process_frame()  — detector frame-by-frame (RMS pre-gate + VAD)
  BargeinDetector.monitor()        — loop asincrono che legge dalla queue audio
  cancel_turn()                    — sequenza di cancel: playback + TTS queue + runtime

Import lazy (DoD TSK-300):
  Il modulo non importa torch, webrtcvad o sounddevice a livello di modulo.
  VADBase proviene da voice.vad.base che ha solo stdlib; l'istanza concreta
  (SileroVAD o WebRTCVAD) viene iniettata via costruttore.
  numpy e' l'unica dipendenza pesante presente a livello di modulo; e' accettata
  perche' e' gia' usata ovunque nel layer voice/ e non richiede device specifici.

Gate backward-compat (AC6/US-144):
  Quando voice_channel.barge_in.enabled: false il BargeinDetector non viene
  istanziato dalla state machine (TSK-301); questo modulo resta importabile
  senza effetti collaterali.

Esportazioni principali:
    CancelToken      — flag di cancellazione sincrono (DoD US-143 AC2)
    BargeinDetector  — detector RMS+VAD a due stadi (DoD TSK-300)
    cancel_turn      — sequenza asincrona di cancel (playback + TTS + runtime)
"""
from __future__ import annotations

import asyncio
import logging
import queue as _queue_module
from typing import TYPE_CHECKING, Optional

import numpy as np

from voice.vad.base import VADBase

if TYPE_CHECKING:
    from voice.audio.capture import AudioCapture
    from voice.audio.playback import AudioPlayback
    from voice.runtime.factory_runtime import FactoryRuntime

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# CancelToken (DoD US-143 AC2)
# ---------------------------------------------------------------------------

class CancelToken:
    """Token di cancellazione sincrono per un turno vocale.

    In Fase 1 non viene mai impostato (nessun barge-in). Viene passato alla
    state machine che lo controlla prima di ogni chunk TTS in PARLATO.

    Uso:
        token = CancelToken()
        # da un altro thread/task (Fase 3):
        token.cancel()
        # nella state machine:
        if token.is_cancelled:
            break
    """

    def __init__(self) -> None:
        self.is_cancelled: bool = False

    def cancel(self) -> None:
        """Imposta il flag di cancellazione.

        Idempotente: chiamarlo piu' volte non causa effetti collaterali.
        Thread-safe in lettura; scrittura atomica su CPython (GIL).
        """
        self.is_cancelled = True

    def reset(self) -> None:
        """Azzera il flag (nuovo turno)."""
        self.is_cancelled = False

    def __repr__(self) -> str:  # pragma: no cover
        return f"CancelToken(is_cancelled={self.is_cancelled})"


# ---------------------------------------------------------------------------
# BargeinDetector (TSK-300 — Fase 3)
# ---------------------------------------------------------------------------

class BargeinDetector:
    """
    Rileva attivita' vocale durante il playback TTS e cancella il task corrente.

    Fase 3: rilevamento a due stadi
    1. Pre-gate RMS (rapido, no model) — calcola rms = sqrt(mean(frame**2));
       i frame sotto soglia sono scartati senza invocare il VAD.
    2. Conferma VAD (con debounce) — solo i frame sopra il pre-gate RMS passano
       al VAD; il barge-in scatta quando il VAD conferma voce per N frame
       consecutivi (evita trigger su singoli picchi).

    Il VAD viene ricevuto via costruttore (injection): il detector non importa
    torch o webrtcvad a livello di modulo (DoD TSK-300, backward-compat).

    In stato PARLATO il VAD dovrebbe essere gia' configurato con soglia piu'
    alta rispetto a CATTURA (config.barge_in.vad_threshold = 0.7, AC5/AC6):
    la responsabilita' e' del chiamante che istanzia il VAD con la soglia giusta.
    Il parametro vad_threshold nel costruttore documenta il valore atteso ma
    non sovrascrive la configurazione interna del VAD iniettato.

    Args:
        vad:             Istanza VADBase gia' configurata con la soglia corretta
                         per lo stato PARLATO (tipicamente threshold=0.7).
        capture:         AudioCapture in ascolto durante PARLATO; monitor() legge
                         dalla sua queue thread-safe.
        rms_threshold:   Pre-gate energia RMS (float32 normalizzato [-1,1]).
                         Frame con RMS < soglia sono scartati senza invocare VAD.
                         Default 0.01 (~ -40 dBFS).
        vad_threshold:   Soglia VAD attesa (documentazione; VAD gia' configurato).
                         Default 0.7 per stato PARLATO (vs 0.5 in CATTURA, AC5).
        debounce_frames: Numero di frame VAD consecutivi richiesti per confermare
                         il barge-in. Default 3 (~ 90 ms a 30 ms/frame).
        sample_rate:     Frequenza di campionamento attesa in Hz. Default 16000.
    """

    def __init__(
        self,
        vad: VADBase,
        capture: "AudioCapture",
        rms_threshold: float = 0.01,
        vad_threshold: float = 0.7,
        debounce_frames: int = 3,
        sample_rate: int = 16000,
    ) -> None:
        self._vad = vad
        self._capture = capture
        self._rms_threshold = rms_threshold
        self._vad_threshold = vad_threshold  # documentazione; VAD gia' pre-configurato
        self._debounce_frames = debounce_frames
        self._sample_rate = sample_rate
        # Contatore interno frame VAD consecutivi sopra soglia
        self._consecutive_vad_frames: int = 0

    # ------------------------------------------------------------------
    # process_frame — rilevamento a due stadi su singolo frame
    # ------------------------------------------------------------------

    def process_frame(self, frame: np.ndarray) -> bool:
        """Rilevamento a due stadi su un singolo frame audio.

        Stadio 1 — Pre-gate RMS:
            Calcola rms = sqrt(mean(frame**2)). Se rms < rms_threshold il frame
            viene scartato (reset del contatore VAD consecutivi) senza invocare
            il modello VAD: operazione puramente numpy, nessun overhead ML.

        Stadio 2 — Conferma VAD:
            Il frame che supera il pre-gate RMS viene convertito da float32 a
            PCM int16 bytes e passato a VADBase.is_speech(). Se il VAD conferma
            parlato, il contatore dei frame consecutivi viene incrementato; al
            raggiungimento di debounce_frames il metodo ritorna True.
            Se il VAD nega il parlato, il contatore viene azzerato.

        Args:
            frame: numpy array float32 di shape (blocksize,) mono oppure
                   (blocksize, channels); il primo canale viene usato per il calcolo.

        Returns:
            True se il barge-in e' confermato (N frame VAD consecutivi sopra
            soglia dopo il pre-gate RMS). False altrimenti.
        """
        # Flatten to mono: prende il primo canale se multi-canale
        audio: np.ndarray = frame[:, 0] if frame.ndim > 1 else frame

        # Stadio 1: Pre-gate RMS — economico, nessun ML
        rms = float(np.sqrt(np.mean(audio ** 2)))
        if rms < self._rms_threshold:
            # Sotto soglia: nessun parlato atteso, reset debounce
            self._consecutive_vad_frames = 0
            return False

        # Stadio 2: Conferma VAD
        # Converti float32 [-1.0, 1.0] → PCM int16 little-endian (formato VADBase)
        audio_int16 = (np.clip(audio, -1.0, 1.0) * 32767.0).astype(np.int16)
        frame_bytes: bytes = audio_int16.tobytes()

        try:
            is_speech: bool = self._vad.is_speech(frame_bytes, self._sample_rate)
        except Exception as exc:  # noqa: BLE001
            # Errore VAD (es. frame di lunghezza sbagliata per WebRTCVAD):
            # non triggera barge-in, reset contatore per sicurezza.
            logger.debug(
                "BargeinDetector: errore VAD su frame (%s); frame scartato", exc
            )
            self._consecutive_vad_frames = 0
            return False

        if is_speech:
            self._consecutive_vad_frames += 1
        else:
            self._consecutive_vad_frames = 0

        return self._consecutive_vad_frames >= self._debounce_frames

    # ------------------------------------------------------------------
    # reset — azzera lo stato interno (nuovo turno)
    # ------------------------------------------------------------------

    def reset(self) -> None:
        """Azzera il contatore dei frame VAD consecutivi.

        Chiamare prima di ogni nuovo turno (o all'inizio di ogni monitor())
        per evitare che lo stato residuo del turno precedente faccia scattare
        un falso barge-in all'inizio del successivo.
        """
        self._consecutive_vad_frames = 0

    # ------------------------------------------------------------------
    # monitor — loop asincrono di rilevamento durante playback
    # ------------------------------------------------------------------

    async def monitor(
        self,
        playback_task: asyncio.Task,
        playback: Optional["AudioPlayback"] = None,
    ) -> bool:
        """Monitora la cattura audio mentre playback_task e' attivo.

        Legge frame dalla queue di AudioCapture senza bloccare l'event loop
        (polling non-bloccante con get_nowait() + asyncio.sleep(0.005)).
        Per ogni frame chiama process_frame() che esegue il rilevamento a due
        stadi (RMS pre-gate → VAD debounce).

        Alla conferma del barge-in:
          1. Cancella playback_task (inietta CancelledError nell'asyncio task
             che sta eseguendo asyncio.to_thread(playback.play, ...)).
          2. Se playback e' fornito, chiama playback.abort() per drop immediato
             del buffer sounddevice (senza aspettare il drain del thread).
          3. Ritorna True.

        Se playback_task termina naturalmente prima del barge-in, ritorna False.

        Args:
            playback_task: Task asyncio che gestisce la riproduzione TTS.
                           Viene cancellato al rilevamento del barge-in.
            playback:      AudioPlayback opzionale. Se fornito, .abort() viene
                           chiamato immediatamente per stop audio istantaneo
                           (raccomandato per latenza AC4 < 300 ms).
                           Se None, il task viene solo cancellato: lo stop
                           audio avviene tramite cancel_turn() nella state machine.

        Returns:
            True  — barge-in rilevato (playback_task cancellato).
            False — playback terminato naturalmente senza barge-in.

        Raises:
            asyncio.CancelledError: se il task chiamante viene a sua volta
                                    cancellato (propagato correttamente).
        """
        self.reset()

        # Scarica frame residui nella queue (prodotti durante CATTURA/TRASCRIZIONE)
        # per evitare falsi trigger da audio precedente all'inizio del playback.
        _drained = 0
        while True:
            try:
                self._capture.queue.get_nowait()
                _drained += 1
            except _queue_module.Empty:
                break
        if _drained:
            logger.debug(
                "BargeinDetector: scaricati %d frame residui prima del monitor",
                _drained,
            )

        try:
            while not playback_task.done():
                # Poll non-bloccante: evita di bloccare l'event loop asyncio
                try:
                    frame: np.ndarray = self._capture.queue.get_nowait()
                except _queue_module.Empty:
                    # Nessun frame disponibile: cede il controllo per ~5 ms
                    # (intervallo minore del frame audio ~30 ms per non perdere frame)
                    await asyncio.sleep(0.005)
                    continue

                # Frame vuoto o invalido: salta senza invocare process_frame
                if frame is None or frame.size == 0:
                    continue

                # Rilevamento a due stadi: RMS pre-gate + VAD debounce
                if self.process_frame(frame):
                    logger.info(
                        "BargeinDetector: barge-in confermato"
                        " (%d frame VAD consecutivi, RMS pre-gate attivo);"
                        " cancello playback_task",
                        self._consecutive_vad_frames,
                    )
                    # Stop TTS task
                    playback_task.cancel()
                    # Stop immediato sounddevice (drop buffer, non drain)
                    if playback is not None:
                        playback.abort()
                    return True

            # Playback terminato naturalmente prima del barge-in
            logger.debug("BargeinDetector: playback terminato senza barge-in")
            return False

        except asyncio.CancelledError:
            # Il task chiamante (es. state machine) e' stato cancellato:
            # propaga senza sopprimere per non bloccare la catena di shutdown.
            logger.debug("BargeinDetector.monitor: CancelledError ricevuto, propagato")
            raise
        finally:
            # Cleanup sempre eseguito: azzera lo stato interno.
            # Il chiamante (state machine TSK-301) e' responsabile dello stop
            # di AudioCapture se necessario.
            self.reset()


# ---------------------------------------------------------------------------
# cancel_turn — sequenza asincrona di cancel propagato
# ---------------------------------------------------------------------------

async def cancel_turn(
    playback_task: asyncio.Task,
    tts_queue: "asyncio.Queue[object]",
    playback: "AudioPlayback",
    runtime: "FactoryRuntime",
    session_id: str,
) -> bool:
    """Sequenza di cancel barge-in: stop TTS + flush coda + cancel runtime.

    Esegue i tre passi della sequenza di cancel (US-144 Note Tecniche §Meccanismo
    di cancel via asyncio.Task) rispettando la tolleranza di ~500 ms (AC2):

    1. Stop TTS immediato:
       - playback_task.cancel() — inietta CancelledError nel task asyncio.
       - playback.abort()       — drop immediato del buffer sounddevice
                                  (abort != stop: non fa drain, e' istantaneo).
         Nota: AudioPlayback.abort() e' sincrono; non usa await.

    2. Flush coda TTS:
       Svuota tts_queue delle frasi non ancora pronunciate (e degli artefatti
       scartati da US-145): le elimina senza accodarle altrove.

    3. Propagazione cancel al runtime LLM:
       runtime.cancel(session_id) chiude in modo pulito lo stream LLM e gli
       eventuali tool in corso; idempotente (puo' essere chiamato piu' volte).

    L'intera sequenza deve completarsi entro ~500 ms per rispettare la tolleranza
    AC2 (US-144). I passi 1 e 2 sono sincroni e sub-millisecondi; il passo 3
    (await runtime.cancel) si completa entro il timeout del runtime.

    Args:
        playback_task: Task asyncio in esecuzione per la riproduzione TTS.
        tts_queue:     Coda asincrona con le frasi TTS non ancora pronunciate.
        playback:      AudioPlayback per il drop immediato del buffer audio.
        runtime:       FactoryRuntime da cui interrompere l'elaborazione LLM.
        session_id:    Identificatore del turno corrente da cancellare.

    Returns:
        True quando la sequenza e' completata.
    """
    # Passo 1: Stop TTS immediato
    # cancel() sul task asyncio + abort() sul device sounddevice (drop, non drain)
    playback_task.cancel()
    # abort() e' sincrono (threading.Event.set() + sd.stop()); non usa await.
    playback.abort()

    # Passo 2: Flush coda TTS — elimina frasi non ancora pronunciate
    flushed = 0
    while not tts_queue.empty():
        try:
            tts_queue.get_nowait()
            flushed += 1
        except Exception:  # noqa: BLE001
            # Queue vuota o chiusa nel frattempo: esci dal loop
            break
    if flushed:
        logger.debug("cancel_turn: %d chunk TTS scartati dalla coda", flushed)

    # Passo 3: Propaga cancel al runtime LLM
    await runtime.cancel(session_id)

    logger.info(
        "cancel_turn: sequenza completata (session_id=%s, tts_flushed=%d)",
        session_id,
        flushed,
    )
    return True
